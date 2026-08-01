-- add_meta_cloud_channel_fields
--
-- Extiende communication_channels (definida en 002_communication_channels.sql,
-- BIGSERIAL id) para poder persistir el estado del canal meta-cloud por
-- usuario/dispositivo, sin tocar ninguna columna usada por Evolution.
--
-- Nota de auditoría: server/communicationChannelStore.ts define su propia
-- tabla `communication_channels` con id TEXT y columnas distintas
-- (pairing_code, instance_name NOT NULL). Esa definición nunca se aplicó en
-- producción (sus funciones de escritura no tienen ningún caller en el
-- repositorio) y diverge de este esquema real. Esta migración extiende
-- ÚNICAMENTE el esquema real (BIGSERIAL, el de 002/004/005), que es el que
-- usan communicationResolver.ts y los scripts de operación en scripts/.
--
-- `provider` sigue significando "tipo de canal" (siempre 'whatsapp' aquí),
-- no "backend de WhatsApp". Se añade whatsapp_backend como columna nueva y
-- distinta para esa segunda dimensión (evolution | meta-cloud).

ALTER TABLE communication_channels
  ADD COLUMN IF NOT EXISTS whatsapp_backend TEXT
    CHECK (whatsapp_backend IN ('evolution', 'meta-cloud')),
  ADD COLUMN IF NOT EXISTS mode TEXT
    CHECK (mode IN ('simulation', 'test', 'production')),
  ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS waba_id TEXT,
  ADD COLUMN IF NOT EXISTS masked_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS webhook_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inbound_forwarding_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_disconnected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_outbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

-- `connected_at` (002) y `last_seen_at` (002) se reutilizan tal cual para
-- meta-cloud como "último connect" / "última actividad de sesión"; no se
-- duplican con columnas nuevas.

DO $migration$
DECLARE
  status_constraint_name TEXT;
BEGIN
  SELECT conname INTO status_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'communication_channels'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE communication_channels DROP CONSTRAINT %I',
      status_constraint_name
    );
  END IF;

  ALTER TABLE communication_channels
    ADD CONSTRAINT communication_channels_status_check
    CHECK (status IN (
      'not_configured',
      'pending',
      'connecting',
      'configuring',
      'connected',
      'disconnected',
      'disabled',
      'revoked',
      'error'
    ));
END;
$migration$;

CREATE INDEX IF NOT EXISTS communication_channels_phone_number_idx
  ON communication_channels (phone_number)
  WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_channels_whatsapp_backend_idx
  ON communication_channels (whatsapp_backend)
  WHERE whatsapp_backend IS NOT NULL;

-- Filas existentes (todas Evolution hasta ahora) quedan etiquetadas
-- explícitamente. Backfill puramente aditivo: no borra ni cambia ningún
-- otro dato de esas filas.
UPDATE communication_channels
SET whatsapp_backend = 'evolution'
WHERE provider = 'whatsapp'
  AND whatsapp_backend IS NULL;

-- La unicidad (user_code, device_code, provider) de 005_communication_channel_device_scope.sql
-- solo permitía UNA fila de WhatsApp por usuario/dispositivo, sin importar el
-- backend. Eso impediría conservar el estado de Evolution al probar
-- meta-cloud (y viceversa) y rompería el rollback: cambiar WHATSAPP_PROVIDER
-- de vuelta a evolution debe restaurar su última conexión conocida, no una
-- fila que meta-cloud sobrescribió. Se amplía la unicidad para que cada
-- backend tenga su propia fila; qué backend es "el efectivo" lo decide la
-- aplicación (WHATSAPP_PROVIDER), no la base de datos.
DROP INDEX IF EXISTS communication_channels_user_device_provider_idx;

CREATE UNIQUE INDEX IF NOT EXISTS communication_channels_user_device_provider_backend_idx
  ON communication_channels (user_code, device_code, provider, whatsapp_backend);

-- ROLLBACK (manual — este proyecto no ejecuta migraciones DOWN
-- automáticamente; aplicar con el mismo runner que 002/004/005 si hace
-- falta revertir):
--
-- ALTER TABLE communication_channels
--   DROP COLUMN IF EXISTS whatsapp_backend,
--   DROP COLUMN IF EXISTS mode,
--   DROP COLUMN IF EXISTS enabled,
--   DROP COLUMN IF EXISTS phone_number_id,
--   DROP COLUMN IF EXISTS waba_id,
--   DROP COLUMN IF EXISTS masked_phone_number,
--   DROP COLUMN IF EXISTS display_name,
--   DROP COLUMN IF EXISTS webhook_enabled,
--   DROP COLUMN IF EXISTS automation_enabled,
--   DROP COLUMN IF EXISTS inbound_forwarding_enabled,
--   DROP COLUMN IF EXISTS last_disconnected_at,
--   DROP COLUMN IF EXISTS last_inbound_at,
--   DROP COLUMN IF EXISTS last_outbound_at,
--   DROP COLUMN IF EXISTS last_error_code,
--   DROP COLUMN IF EXISTS last_error_at;
-- DROP INDEX IF EXISTS communication_channels_phone_number_idx;
-- DROP INDEX IF EXISTS communication_channels_whatsapp_backend_idx;
-- ALTER TABLE communication_channels DROP CONSTRAINT IF EXISTS communication_channels_status_check;
-- ALTER TABLE communication_channels
--   ADD CONSTRAINT communication_channels_status_check
--   CHECK (status IN ('not_configured','pending','connecting','connected','disconnected','revoked','error'));
-- DROP INDEX IF EXISTS communication_channels_user_device_provider_backend_idx;
-- CREATE UNIQUE INDEX IF NOT EXISTS communication_channels_user_device_provider_idx
--   ON communication_channels (user_code, device_code, provider);
-- -- El backfill de whatsapp_backend='evolution' no se revierte (es informativo,
-- -- no rompe nada dejarlo); si hace falta, UPDATE communication_channels SET whatsapp_backend = NULL WHERE whatsapp_backend = 'evolution'.

# 03 Database

## Resumen

El proyecto usa dos capas de persistencia con responsabilidades distintas:

- IndexedDB con Dexie para la operativa local de la app.
- Neon PostgreSQL para licencias, dispositivos, canales y soporte de automatización.

## Base local Dexie

La base FinanceDB está definida en src/database/db.ts y llega actualmente a la versión 23.

### Tablas locales confirmadas

- services.
- expenses.
- appointments.
- settings.
- exchangeRates.
- cutoffReports.
- earningPeriods.
- licenses.
- automationOutbox.
- communicationChannels.
- deviceIdentity.
- financialSnapshots.

### Finalidad de tablas clave

- services: ingresos y servicios completados.
- expenses: egresos y ajustes.
- appointments: agenda y citas.
- settings: configuración global del negocio y del dispositivo.
- exchangeRates: tasas históricas y fallback offline.
- cutoffReports: snapshots o cierres de reportes.
- earningPeriods: temporadas / periodos del modo Profesional.
- licenses: licencia local validada.
- automationOutbox: cola local de eventos hacia Vercel/n8n.
- communicationChannels: estado local del canal de comunicación en cliente.
- deviceIdentity: userCode y deviceCode persistidos localmente.
- financialSnapshots: artefactos Financial Snapshot sellados, persistidos de forma local y append-only; no forma parte del libro financiero operativo.

### Financial Snapshot local (v23)

`financialSnapshots` usa `snapshotId` content-addressed como clave primaria. Sus índices son `snapshotKey`, el índice único compuesto `[snapshotKey+revision]`, `sealedAt`, `status`, `scopeKind`, `scopePeriodStart` y `fingerprintValue`. Los campos de scope y fingerprint están denormalizados únicamente para consulta.

La tabla admite exclusivamente inserciones. Hooks Dexie rechazan `update`, `put` sobre una identidad existente, `delete` y `clear`. El repositorio asigna la revisión dentro de una transacción de lectura-escritura y conserva todas las revisiones; no existe retención destructiva automática. La tabla queda deliberadamente fuera de los flujos de reset e importación/exportación del libro operativo, para que esos flujos no puedan reescribir ni eliminar la auditoría.

La migración desde v22 solo crea la tabla, sin transformar ni borrar registros existentes. El rollback conceptual consiste en desplegar una versión que deje de leer/escribir la tabla v23 conservando IndexedDB; Dexie no ofrece downgrade automático y no se debe borrar la base para retroceder.

## Neon PostgreSQL

### Tablas confirmadas por código servidor

- communication_channels.
- licenses.
- license_devices.

### communication_channels

Gestionada desde server/automation/communicationResolver.ts y server/communicationChannelStore.ts.

Campos observados:

- user_code.
- device_code.
- provider.
- instance_name.
- instance_id.
- phone_number.
- status.
- preferences.
- provider_metadata.
- owner_jid.
- profile_name.
- profile_photo.
- connected_at.
- created_at.
- updated_at.
- last_seen_at.

Índices observados:

- índice único por user_code + device_code + provider.
- índice por user_code + provider.
- índice por status.

### license_devices

Se usa para autorizar dispositivos y para resolver userCode a partir de deviceCode.

Uso confirmado:

- authorizeLicenseDevice durante activación.
- resolveUserCodeFromDeviceCode en automatización.

## Cadena de resolución de canal

Flujo confirmado por código:

1. El evento llega con userCode o deviceCode.
2. Si falta userCode, el servidor lo intenta resolver desde license_devices usando deviceCode.
3. Con userCode resuelto, busca el canal activo en communication_channels.
4. El payload a n8n incorpora communicationChannel, instanceName y whatsappNumber cuando existe.

## Legacy detectado en workflows

Los workflows 01 Device Provisioning y 03 WhatsApp Status siguen mostrando referencias a tablas legacy como:

- app_user.
- device.
- whatsapp_channel.

Estas referencias no sustituyen la arquitectura actual basada en communication_channels y license_devices y deben considerarse pendientes de consolidación.

## Riesgos conocidos

- Parte del conocimiento de base remota vive en workflows n8n además del código TypeScript.
- Hay divergencia entre tablas modernas del servidor y tablas legacy observadas en workflows antiguos.

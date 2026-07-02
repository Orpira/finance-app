# Registro de dispositivos por licencia

Las licencias firmadas V2 mantienen su firma ECDSA y su fecha de expiración. El
servidor obtiene `license_key` como una huella SHA-256 del código firmado; el
código de activación nunca se guarda en PostgreSQL.

Por defecto una licencia permite varios dispositivos. El límite se configura
en Vercel con:

```text
MAX_DEVICES_PER_LICENSE=3
```

El backend crea las tablas `licenses` y `license_devices` de forma idempotente.
La función PostgreSQL `authorize_license_device` bloquea la fila de licencia
durante el alta para evitar superar el límite con activaciones simultáneas.

Cada dispositivo conserva su `deviceCode`. Al activar una licencia:

- un dispositivo activo actualiza `last_seen_at`;
- un dispositivo nuevo ocupa una plaza disponible;
- un dispositivo revocado se rechaza;
- una licencia revocada se rechaza;
- si no quedan plazas se devuelve `Límite de dispositivos alcanzado`.

Para emitir excepcionalmente una licencia ligada solo al dispositivo inicial:

```bash
node scripts/generate-signed-license.mjs DEVICE_CODE lifetime --single-device
```

Las licencias ya emitidas sin `devicePolicy` se interpretan como
multidispositivo para mantenerlas válidas. Las licencias V1 conservan su
comportamiento anterior de un solo dispositivo.

Revocar un dispositivo:

```sql
UPDATE license_devices
SET status = 'revoked', last_seen_at = NOW()
WHERE license_key = 'HUELLA_SHA256' AND device_code = 'PB-DEVICE-UUID';
```

Revocar una licencia completa:

```sql
UPDATE licenses
SET status = 'revoked', updated_at = NOW()
WHERE license_key = 'HUELLA_SHA256';
```

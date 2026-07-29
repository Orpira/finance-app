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

## Prueba gratuita de 7 días (trial autoservicio)

A diferencia de las licencias de pago (que requieren generar manualmente un
código con `generate-signed-license.mjs` y enviárselo al usuario), el trial
se auto-provisiona sin intervención humana, pensado para distribución pública
masiva:

1. La app genera su `deviceCode` en silencio en el primer arranque (ya
   ocurría antes; no es nuevo). El usuario nunca ve ni copia nada.
2. `LicenseGuard` detecta que no existe ninguna licencia local y llama a
   `POST /api/trial-start` con ese `deviceCode` y el `userCode`.
3. El servidor firma un código de licencia V2 normal (`PB-LIC-V2...`),
   `licenseType: 'trial'`, `devicePolicy: 'single'`, expiración a 7 días,
   usando una **clave privada de firma dedicada solo a trials**
   (`TRIAL_LICENSE_PRIVATE_KEY_JWK`), y lo registra en `license_devices`
   igual que cualquier otra licencia.
4. El cliente activa ese código localmente con el mismo mecanismo que una
   licencia de pago (`activateSignedLicense`), así que expiración,
   detección de manipulación de reloj (`clock-tampered`) y el resto de la
   validación se reutilizan sin cambios.

### Por qué una clave de firma separada para trials

La clave privada de licencias de pago se usa **solo offline**, a mano, por
el propietario (`generate-signed-license.mjs`). Nunca toca un servidor.

La clave de trial, en cambio, **debe** vivir como variable de entorno en el
runtime de Vercel para poder firmar automáticamente en cada solicitud —
eso la expone a un vector de ataque que la clave de pago nunca tiene. Por
eso son pares de claves EC completamente distintos: si la clave de trial se
filtrara, el daño se limita a permitir generar pruebas gratuitas de 7 días,
nunca licencias de pago ni acceso indefinido. El cliente verifica cada
licencia firmada contra la clave pública que corresponde a su
`licenseType` (ver `src/services/signedLicenseService.ts`).

### Configuración necesaria en Vercel

```text
TRIAL_LICENSE_PRIVATE_KEY_JWK={"kty":"EC","crv":"P-256","d":"...","x":"...","y":"..."}
```

Generar el par de claves una sola vez (nunca commitear el archivo privado):

```bash
node scripts/generate-license-keys.mjs trial-private-key.json trial-public-key.json
```

Después:
- Pegar el contenido de `trial-private-key.json` como valor de
  `TRIAL_LICENSE_PRIVATE_KEY_JWK` en las variables de entorno de Vercel.
- Copiar los campos (`kty`, `x`, `y`, `crv`) de `trial-public-key.json` en
  `trialPublicLicenseKeyJwk`, tanto en
  `server/trialLicenseSecurity.ts` como en
  `src/services/signedLicenseService.ts` (deben coincidir exactamente).

### Anti-abuso: un trial por dispositivo

Una nueva tabla `trial_grants` (clave primaria `device_code`) impide que el
mismo dispositivo reclame un segundo trial, incluso después de que el
primero expire o sea revocado — el intento simplemente devuelve
`409 Este dispositivo ya usó su prueba gratuita de 7 días.`.

Esto **no** impide que alguien borre los datos de la app (o reinstale) para
generar un `deviceCode` nuevo y reclamar otro trial: es una limitación
conocida y aceptada, coherente con el objetivo de atracción masiva de
usuarios más que blindaje anti-piratería. Si en el futuro se requiere cerrar
ese hueco, las opciones son limitar por IP en `api/trial-start.ts`, pedir un
email al iniciar el trial, o migrar el trial al sistema nativo de prueba de
las tiendas (Google Play Billing / StoreKit vía RevenueCat), que gestiona
esto a nivel de cuenta de la tienda.

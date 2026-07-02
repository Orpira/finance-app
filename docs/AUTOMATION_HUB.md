# Automation Hub: Private Balance -> Vercel -> n8n

## Arquitectura

```text
IndexedDB + automationOutbox
            |
            | POST /api/automation-token
            | licencia firmada V2 -> JWT en memoria (max. 15 minutos)
            v
POST /api/automation (Vercel Function)
            |
            | Authorization: Bearer <N8N_INTERNAL_TOKEN>
            | Idempotency-Key: <eventId>
            v
Webhook de producción n8n
```

Los movimientos se guardan junto con su evento en una única transacción Dexie.
La red nunca forma parte de esa transacción. Los fallos se conservan en
`automationOutbox` y se reintentan con espera exponencial, al recuperar conexión
y al iniciar la aplicación.

El frontend web publicado llama siempre al mismo origen. El APK y la web
ejecutada desde `localhost` utilizan la URL pública de Vercel configurada en
`VITE_API_BASE_URL`. El cliente envía la
licencia V2 exclusivamente a `/api/automation-token`; Vercel valida su firma y
su vinculación al dispositivo antes de emitir el JWT. El JWT se conserva solo
en memoria, se renueva antes de expirar y se solicita una única vez cuando
varias entregas coinciden. Nunca se guarda en IndexedDB ni `localStorage`.

## Variables

Frontend Android/Capacitor (es una URL pública y puede formar parte del bundle):

```env
VITE_API_BASE_URL=https://private-balance.orpira.es
```

Servidor Vercel (nunca usar el prefijo `VITE_`):

```env
N8N_AUTOMATION_WEBHOOK_URL=https://n8n.orpira.es/webhook/private-balance
N8N_DEVICE_PROVISIONING_WEBHOOK_URL=https://n8n.orpira.es/webhook/private-balance-device
N8N_WHATSAPP_WEBHOOK_URL=https://n8n.orpira.es/webhook/private-balance-whatsapp
N8N_INTERNAL_TOKEN=<token-rotado-de-n8n>
AUTOMATION_JWT_SECRET=<64-caracteres-hex-aleatorios>
PRIVATE_BALANCE_ALLOWED_ORIGINS=https://private-balance.orpira.es
```

Cada cambio de variables de Vercel requiere un nuevo despliegue.

Está prohibido definir `VITE_N8N_WEBHOOK_URL`,
`VITE_N8N_WHATSAPP_WEBHOOK_URL`, `VITE_PRIVATE_BALANCE_TOKEN` o
`VITE_EVOLUTION_API_KEY`. El build comprueba estas variables y falla si detecta
alguna. Las variables `N8N_*` y `AUTOMATION_JWT_SECRET` solo pueden
existir en Vercel o en un entorno local de servidor. Las licencias V1 siguen
siendo válidas para el uso local de la
aplicación, pero no pueden autenticarse contra Automation Hub: este flujo exige
una licencia firmada V2.

En desarrollo, `vercel dev` sirve los endpoints locales `/api/*`. Si se usa
`npm run dev`, Vite no sirve Functions y el cliente usa automáticamente
`VITE_API_BASE_URL`; el proxy admite orígenes loopback con cualquier
puerto, pero sigue exigiendo licencia V2 y JWT. Para Android, la URL configurada
debe usar HTTPS. Solo se acepta HTTP para `localhost` durante desarrollo.

## Contrato enviado a n8n

El gateway usa este router interno:

| Eventos | Variable de destino |
| --- | --- |
| `income.created`, `expense.created`, `calendar.created` | `N8N_AUTOMATION_WEBHOOK_URL` |
| `device.provision.requested` | `N8N_DEVICE_PROVISIONING_WEBHOOK_URL` |
| `device.whatsapp.connect.requested`, `communication.whatsapp.*` | `N8N_WHATSAPP_WEBHOOK_URL` |

La respuesta JSON de n8n se devuelve sin envoltorios y conservando su status
HTTP. Los errores JSON también se propagan con su status original.

```json
{
  "eventId": "uuid-v4",
  "event": "income.created | expense.created | calendar.created | device.provision.requested | device.whatsapp.connect.requested | communication.whatsapp.*",
  "createdAt": "2026-06-27T12:00:00.000Z",
  "schemaVersion": 1,
  "data": {},
  "deviceCode": "PB-XXXX-XXXX-XXXX",
  "receivedAt": "2026-06-27T12:00:01.000Z",
  "source": "private-balance-pwa"
}
```

Los eventos interactivos del módulo de comunicación son:

- `device.whatsapp.connect.requested`
- `communication.whatsapp.status.requested`
- `communication.whatsapp.disconnect.requested`
- `communication.whatsapp.test.requested`
- `communication.whatsapp.preferences.updated`

El provisionamiento inicial usa `device.provision.requested` e incluye
`userCode`, `deviceCode`, `deviceName`, `platform` y `appVersion` dentro de
`data`; el proxy los expone en el nivel superior para ese workflow. La conexión
de WhatsApp se limita a `event`, `userCode` y `deviceCode`. El evento anterior
`communication.whatsapp.qr.requested` solo se admite para compatibilidad con
eventos ya encolados.

`device.whatsapp.connect.requested` se enruta exclusivamente a
`N8N_WHATSAPP_WEBHOOK_URL`. El proxy añade el Bearer con
`N8N_INTERNAL_TOKEN` y envía a ese workflow exactamente:

```json
{
  "event": "device.whatsapp.connect.requested",
  "userCode": "PB-USER-<uuid>",
  "deviceCode": "PB-DEVICE-<uuid>"
}
```

La llamada es síncrona: el Gateway espera a n8n y devuelve su JSON a la PWA. El
workflow no debe responder solo `{ "accepted": true }`; para una conexión
correcta debe devolver `success`, `event`, `instanceName`, `status`, `qrCode` y
`pairingCode`.

Si ese workflow responde `422`, el proxy registra el cuerpo en los logs del
servidor y lo devuelve al cliente para mostrarlo en la consola de depuración.

Para QR y estado, el workflow debe responder JSON. Puede incluir `status`,
`connectedNumber` y `qrCode` o `base64`; el QR debe ser una imagen HTTPS, un
data URL PNG/JPEG/WebP o el base64 de un PNG. La API Key de Evolution se
configura únicamente como credencial de n8n. La PWA persiste el QR recibido y
lo representa como imagen. Si `status` es `connected` u `open`, limpia cualquier
QR anterior y presenta el canal como conectado aunque `qrCode` sea `null`.

## Configuración obligatoria en n8n

1. Configura cada nodo **Webhook** con `POST`, URL de producción y
   **Header Auth**:
   - Nombre: `Authorization`.
   - Valor: `Bearer <N8N_INTERNAL_TOKEN>`.
   - La autenticación integrada se ejecuta antes de los nodos Code. En esta
     versión de n8n, una credencial ausente o incorrecta responde `403`.
2. Publica el workflow; la URL configurada en Vercel debe ser la URL de
   producción, no la URL temporal de pruebas.
3. Crea una Data Table llamada `private_balance_events` con estas columnas:
   - `event_id` (string).
   - `event` (string).
   - `device_code` (string).
   - `received_at` (date/string).
   - `status` (string).
4. Antes de ejecutar efectos externos, usa **Data Table -> If Row Exists** con:
   - Columna: `event_id`.
   - Valor: `{{$json.body.eventId}}`.
5. Si existe, responde `409` sin repetir efectos. El proxy interpreta `409`
   como entrega idempotente correcta.
6. Si no existe, inserta primero `event_id`, `event`, `deviceCode`,
   `receivedAt` y `status=processing`; después enruta por `event` y ejecuta la
   automatización.
7. Al terminar, actualiza `status=completed` y responde `2xx`.

Para concurrencia estricta, usa PostgreSQL con `event_id` como clave única y
`INSERT ... ON CONFLICT DO NOTHING`; la comprobación e inserción separadas de
una Data Table no sustituyen una restricción única de base de datos.

## Rotación de secretos

El token que alguna vez haya usado el prefijo `VITE_` debe considerarse
expuesto. La rotación debe hacerse coordinadamente:

1. Genera un token aleatorio nuevo.
2. Actualiza la credencial Header Auth del Webhook en n8n.
3. Actualiza `N8N_INTERNAL_TOKEN` en Vercel.
4. Redespliega y prueba un evento.
5. Revoca el token anterior.

La clave privada de licencias no participa en este flujo y debe continuar fuera
del repositorio, frontend, APK y Vercel.

## Controles aplicados

- JWT HS256 de vida corta, vinculado al código de dispositivo y con expiración
  limitada también por la fecha final de la licencia.
- Validación estricta del contrato con Zod y límites de tamaño de entrada y de
  respuesta.
- CORS restringido, `POST`/JSON obligatorio, cabeceras defensivas y caché
  deshabilitada.
- HTTPS obligatorio hacia n8n y Bearer privado añadido únicamente en Vercel.
- `eventId` UUID e `Idempotency-Key` para evitar efectos duplicados.
- Una respuesta `401` provoca una sola renovación del JWT; no existen bucles de
  reautorización.

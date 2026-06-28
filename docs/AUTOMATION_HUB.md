# Automation Hub: Private Balance -> Vercel -> n8n

## Arquitectura

```text
IndexedDB + automationOutbox
            |
            | licencia V2 -> JWT de 15 minutos
            v
POST /api/automation (Vercel Function)
            |
            | Authorization: Bearer <PRIVATE_BALANCE_TOKEN>
            | Idempotency-Key: <eventId>
            v
Webhook de producción n8n
```

Los movimientos se guardan junto con su evento en una única transacción Dexie.
La red nunca forma parte de esa transacción. Los fallos se conservan en
`automationOutbox` y se reintentan con espera exponencial, al recuperar conexión
y al iniciar la aplicación.

## Variables

Frontend (puede formar parte del bundle):

```env
VITE_AUTOMATION_API_URL=https://private-balance.orpira.es
```

Servidor Vercel (nunca usar el prefijo `VITE_`):

```env
N8N_WEBHOOK_URL=https://n8n.example.com/webhook/private-balance
PRIVATE_BALANCE_TOKEN=<token-rotado-de-n8n>
AUTOMATION_JWT_SECRET=<64-caracteres-hex-aleatorios>
PRIVATE_BALANCE_ALLOWED_ORIGINS=https://private-balance.orpira.es
```

Cada cambio de variables de Vercel requiere un nuevo despliegue.

## Contrato enviado a n8n

```json
{
  "eventId": "uuid-v4",
  "event": "income.created | expense.created | calendar.created | communication.whatsapp.*",
  "createdAt": "2026-06-27T12:00:00.000Z",
  "schemaVersion": 1,
  "data": {},
  "deviceCode": "PB-XXXX-XXXX-XXXX",
  "receivedAt": "2026-06-27T12:00:01.000Z",
  "source": "private-balance-pwa"
}
```

Los eventos interactivos del módulo de comunicación son:

- `communication.whatsapp.qr.requested`
- `communication.whatsapp.status.requested`
- `communication.whatsapp.disconnect.requested`
- `communication.whatsapp.test.requested`
- `communication.whatsapp.preferences.updated`

Para QR y estado, el workflow debe responder JSON. Puede incluir `status`,
`connectedNumber` y `qrCode` o `base64`; el QR debe ser una imagen HTTPS, un
data URL PNG/JPEG/WebP o el base64 de un PNG. La API Key de Evolution se
configura únicamente como credencial de n8n.

## Configuración obligatoria en n8n

1. Configura el nodo **Webhook** con `POST`, URL de producción y
   **Header Auth**:
   - Nombre: `Authorization`.
   - Valor: `Bearer <PRIVATE_BALANCE_TOKEN>`.
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
3. Actualiza `PRIVATE_BALANCE_TOKEN` en Vercel.
4. Redespliega y prueba un evento.
5. Revoca el token anterior.

La clave privada de licencias no participa en este flujo y debe continuar fuera
del repositorio, frontend, APK y Vercel.

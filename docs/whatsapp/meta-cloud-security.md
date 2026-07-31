# Seguridad del backend de comunicaciones (WhatsApp Cloud API)

> Fase 3. Complementa `docs/architecture/11_SECURITY.md` (seguridad general
> del proyecto) con los mecanismos específicos de
> `server/communication/*` y `api/communication/*`.

## Secretos

| Secreto | Dónde vive | Nunca debe |
|---|---|---|
| `META_APP_SECRET` | Solo servidor (Vercel) | Aparecer en logs, respuestas HTTP, o en el cliente |
| `META_ACCESS_TOKEN` | Solo servidor (Vercel) | Aparecer en logs, respuestas HTTP, o en el cliente |
| `META_VERIFY_TOKEN` | Solo servidor (Vercel) | Registrarse, ni el recibido ni el esperado, en éxito o en fallo |
| `N8N_COMMUNICATION_API_KEY` | Solo servidor (Vercel) + credencial de n8n | Registrarse ni pasarse por query params |

Ninguna variable con estos valores debe llevar el prefijo `VITE_`. El guard
de build existente en `vite.config.ts` (`FORBIDDEN_CLIENT_SECRETS`) cubre
las variables de n8n/Evolution; si en una fase futura se expone cualquier
variable Meta al bundle cliente por error, ese guard deberá ampliarse — en
esta fase ninguna variable `META_*` se lee nunca desde `src/` ni desde
código que se empaquete para el cliente, así que no hace falta tocarlo
todavía.

## Autenticación n8n → backend

`authenticateAutomationClient` (`server/communication/security/authenticateAutomationClient.ts`):

- Exige `Authorization: Bearer <N8N_COMMUNICATION_API_KEY>`. No se acepta la
  clave en query params ni en ningún otro header.
- Comparación en tiempo constante (`crypto.timingSafeEqual`) — evita que la
  duración de la respuesta filtre información sobre cuántos caracteres
  coinciden.
- Mensaje de error idéntico (`"Solicitud no autorizada."`) tanto si falta la
  cabecera como si la clave es incorrecta: no revela cuál de los dos casos
  ocurrió.
- Nunca registra la clave recibida, ni siquiera en fallos.
- Rotación: cambiar `N8N_COMMUNICATION_API_KEY` en Vercel y en la credencial
  correspondiente de n8n; no hay caché de proceso que sobreviva a un
  redeploy.

### Limitación conocida del rate limiting

`server/communication/security/rateLimiter.ts` implementa un limitador de
tasa **en memoria de proceso**, aplicado a intentos de autenticación
fallidos (ventana de 5 minutos, máximo 20 fallos). Es una capa adicional de
defensa en profundidad, no el mecanismo principal de protección:

- En el runtime serverless de Vercel, cada instancia fría arranca con el
  contador vacío — no es un límite distribuido ni resistente a ráfagas desde
  múltiples instancias en paralelo.
- La comparación de clave en tiempo constante sigue siendo la protección
  principal contra fuerza bruta (con una clave de longitud razonable, el
  espacio de búsqueda hace inviable un ataque de fuerza bruta práctico
  incluso sin límite de tasa).
- La mitigación real para producción (bloqueo de IPs abusivas, límites por
  ventana distribuidos) debe aplicarse a nivel de borde — el firewall/WAF de
  Vercel — no dentro de la función serverless.

Esta limitación se documenta explícitamente en vez de fingir una protección
distribuida que esta fase no implementa.

## Firma de webhooks de Meta

Ver [meta-cloud-webhooks.md](meta-cloud-webhooks.md) para el detalle
completo. Resumen de seguridad:

- HMAC-SHA256 sobre el body **crudo** (bytes originales, antes de cualquier
  parseo), con `META_APP_SECRET`.
- Comparación en tiempo constante.
- Firma inválida → `401`, sin procesar el evento, sin guardar el payload.
- El header de firma nunca se registra en logs.

## Redacción de logs

`redactCommunicationData` / `logCommunicationEvent`
(`server/communication/security/redactCommunicationData.ts`) — no existe un
logger dedicado en el repositorio; se reutiliza `console.*`, igual que el
resto del backend (`webhookDispatcher.ts` usa `console.error`, por ejemplo).
Antes de cualquier `console.info`, los campos pasan por redacción:

- Claves sensibles (`accessToken`, `appSecret`, `verifyToken`, `apiKey`,
  `authorization`, `text`, `body`, `components`, `password`, `token`, y sus
  variantes en snake_case) se sustituyen por `"[redacted]"`.
- Cualquier string que parezca un número de teléfono (`/^\+?\d{7,20}$/`) se
  sustituye por un hash corto no reversible (`phone_<hex>`), nunca por el
  número en claro.
- El resto de campos (operación, status HTTP, duración, códigos de error de
  Meta) se registran sin modificar — son los únicos datos necesarios para
  depurar sin poder reconstruir información sensible.

Ejemplo de log real emitido por `metaCloudClient`:

```json
{"event":"meta_cloud.request_failed","operation":"enviar texto","status":429,"metaCode":80007,"durationMs":312}
```

Nunca se emite un `console.log` con el payload completo enviado a o recibido
de Meta. El `console.log` de depuración detectado en `api/automation.ts`
durante la Fase 1 (líneas 116-117) es de otro módulo (el gateway de
automatización hacia n8n, no el backend de comunicaciones) y permanece sin
modificar — es deuda técnica documentada, no ampliada ni reutilizada aquí.

## Retención de datos

- `communication_idempotency_keys.expires_at` — controlado por
  `WHATSAPP_IDEMPOTENCY_RETENTION_DAYS` (30 días por defecto). Cada
  `saveIdempotencyRecord` purga oportunistamente las filas ya vencidas
  (`DELETE ... WHERE expires_at <= NOW()`); no hay un cron dedicado en esta
  fase, la purga ocurre como efecto secundario de la siguiente escritura.
- `communication_message_statuses` — no aplica todavía una purga automática
  (`WHATSAPP_MESSAGE_RETENTION_DAYS=0` por defecto, sin implementar la
  purga). Solo contiene metadatos técnicos mínimos (ver
  [meta-cloud-backend.md](meta-cloud-backend.md)): nunca texto de mensajes,
  balances, ni el nombre completo del destinatario.
- `communication_service_windows` — una fila por número de contacto,
  sobrescrita en cada mensaje entrante nuevo; no crece de forma no acotada.

## Qué nunca se persiste ni se devuelve al cliente

- Texto completo de los mensajes salientes o entrantes.
- El payload íntegro devuelto por Meta.
- Tokens, app secret, verify token, ni la clave de n8n.
- Cabeceras `Authorization`.
- Objetos financieros completos (bloqueado ya en la validación Zod de
  entrada con `.strict()`, ver [meta-cloud-backend.md](meta-cloud-backend.md)).

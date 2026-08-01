# Pruebas — WhatsApp Cloud API (Meta)

> Fase 3. Ningún test de este repositorio usa credenciales reales de Meta ni
> envía mensajes reales. `npm run test` ejecuta toda la suite con Vitest.

## Cómo probar sin credenciales reales

1. **Modo simulación (recomendado para probar el flujo completo end-to-end
   sin tocar Meta):** `WHATSAPP_CLOUD_ENABLED=true`,
   `WHATSAPP_CLOUD_ALLOW_REAL_SEND=false` (valor por defecto). Los endpoints
   de envío validan, aplican idempotencia y ventana de conversación, y
   devuelven `{ status: "simulated", simulation: true }` sin llamar a Meta.
2. **Envío real controlado (solo en un entorno de pruebas con el número de
   prueba de Meta, nunca con el número personal):**
   `WHATSAPP_CLOUD_ALLOW_REAL_SEND=true` + credenciales `META_*` del número
   de prueba proporcionado por Meta for Developers. Fuera del alcance de
   esta fase (el documento de migración exige no migrar el número real
   todavía).
3. **Tests automatizados:** mockean siempre `fetch`, el cliente de Meta, o
   la configuración — nunca hacen una petición HTTP real hacia
   `graph.facebook.com`.

## Cobertura por módulo

| Área | Archivo de test | Qué cubre |
|---|---|---|
| Validación de variables | `test/metaCloudConfig.test.ts` | Cloud deshabilitado no exige variables; habilitado exige las 6 obligatorias una por una; rechazo de `META_GRAPH_API_VERSION=latest` en producción; mensajes de error sin fugas |
| Cliente Graph API | `test/metaCloudClient.test.ts` | Construcción de URL y cabecera Authorization; payloads de texto/plantilla/mark-read; mapeo de errores 401/403/429/4xx/5xx/timeout/red caída; ausencia del token en los logs |
| Firma de webhooks | `test/verifyMetaSignature.test.ts` | Firma correcta, secreto incorrecto, body reserializado ≠ firma válida, firma ausente/mal formada, lectura de raw body byte a byte, límite de tamaño |
| Normalización de webhooks | `test/metaWebhookContract.test.ts` | Mensajes de texto y no-texto, tipos desconocidos → `"unknown"`, estados con y sin error, estados desconocidos, payloads completamente ajenos a la forma esperada sin lanzar error |
| Autenticación n8n → backend | `test/authenticateAutomationClient.test.ts` | Bearer correcto/ausente/incorrecto, mensaje genérico uniforme, bloqueo por límite de intentos |
| Idempotencia | `test/communicationIdempotency.test.ts` | Ejecución y guardado en clave nueva, réplica en clave repetida con mismo payload, conflicto `409` con payload distinto, no se guarda nada si `execute()` falla |
| Idempotencia (capa Neon) | `test/communicationIdempotencyRepository.test.ts` | Lectura/escritura contra el mismo mock de `@neondatabase/serverless` usado en `test/licenseRegistry.test.ts` |
| Ventana de conversación | `test/serviceWindowService.test.ts` | Cerrada sin inbound previo, abierta dentro de 24h, cerrada pasadas 24h |
| `MetaCloudWhatsAppProvider` | `test/metaCloudWhatsAppProvider.test.ts` | Capacidades reales, QR/pairing rechazados explícitamente, connect/status/disconnect/preferences según configuración, `test.requested` en modo simulación y con envío real controlado |
| Factory (Fase 2 + 3) | `test/whatsAppProviderFactory.test.ts` | `meta-cloud` resuelve a `MetaCloudWhatsAppProvider`, sin fallback a Evolution |
| Rutas de envío | `test/communicationOutboundRoutes.test.ts` | Servicio deshabilitado, auth inválida, payload inválido (incluye rechazo de objetos financieros completos), modo simulación en los 3 endpoints |
| Rutas de estado | `test/communicationStatusRoutes.test.ts` | `health` sin secretos y sin auth, `status` autenticado solo cuando hay clave configurada |
| Ruta de webhook | `test/metaWebhookRoute.test.ts` | Verificación `GET` correcta/incorrecta/deshabilitada, firma `POST` válida/inválida/ausente, error de procesamiento no filtra al cliente (sigue respondiendo `200`) |

## Qué NO cubre esta fase

- Pruebas contra el número de prueba real de Meta for Developers (requiere
  credenciales que no existen en este repositorio ni en CI).
- Pruebas de carga o de rate limiting distribuido (el limitador es en
  memoria de proceso, ver `docs/whatsapp/meta-cloud-security.md`).
- Pruebas end-to-end del flujo completo n8n → backend → Meta → webhook →
  backend, porque n8n no está conectado a estos endpoints todavía (fuera de
  alcance de esta fase, ver `docs/whatsapp/meta-cloud-backend.md`, sección
  "Alcance de esta fase").

## Ejecutar la suite

```bash
npm run test        # vitest run — toda la suite
npm run typecheck   # tsc -p tsconfig.app.json && tsc -p tsconfig.api.json
npm run lint         # eslint .
npm run build        # tsc -b && vite build
```

Al cierre de la Fase 3: 149 archivos de test, 1900 tests en verde (98 tests
nuevos sobre la base de 1802 heredada de la Fase 2), typecheck limpio, lint
limpio, build de producción exitoso.

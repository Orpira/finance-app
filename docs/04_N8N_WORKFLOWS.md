# 04 N8N Workflows

## Fuente de esta documentación

Este inventario se generó en modo solo lectura inspeccionando los workflows disponibles en n8n vía MCP/API el 2026-07-06.

## Inventario actual

### 1. Private Balance - 01 Device Provisioning

- ID: eWObSVyDVhKLP67c.
- Estado: activo.
- Webhook: POST private-balance-device.
- Propósito: provisionar identidad inicial en tablas remotas asociadas al dispositivo.
- Eventos que recibe: device.provision.requested.
- Nodos principales:
	- Validar Provisioning.
	- Upsert Usuario.
	- Upsert Device.
	- Upsert WhatsApp Channel.
	- Respond to Webhook.
- Dependencias:
	- PostgreSQL remoto desde n8n.
- Respuesta final:
	- Termina en Respond to Webhook.
- Riesgos conocidos:
	- Usa tablas legacy app_user, device y whatsapp_channel.
	- Pendiente de validar alineación completa con communication_channels y license_devices.

### 2. Private Balance - 02 WhatsApp Management

- ID: QtH8KvmfUJCDwnI9.
- Estado: activo.
- Webhook: POST private-balance-whatsapp.
- Propósito: alta, conexión, desconexión, prueba y actualización de preferencias del canal WhatsApp.
- Eventos que recibe:
	- device.whatsapp.connect.requested.
	- communication.whatsapp.status.requested.
	- communication.whatsapp.disconnect.requested.
	- communication.whatsapp.test.requested.
	- communication.whatsapp.preferences.updated.
	- communication.whatsapp.qr.requested para compatibilidad.
- Nodos principales:
	- Validar solicitud.
	- Asegurar esquema Neon.
	- Buscar canal Neon.
	- Resolver contexto.
	- Enrutar evento.
	- Listar instancias Evolution.
	- Crear instancia Evolution.
	- Conectar instancia Evolution.
	- Guardar canal Neon.
	- Guardar preferencias Neon.
	- Responder canal / Responder directo / Responder preferencias.
- Dependencias:
	- communication_channels en Neon.
	- Evolution API.
- Respuesta final:
	- Todas las ramas observadas terminan en un nodo Respond to Webhook.
- Riesgos conocidos:
	- SQL ejecutado desde n8n con fragmentos generados dinámicamente en algunos nodos; requiere revisión continua de seguridad.
	- La lógica operativa real depende tanto de código TypeScript como del workflow.

### 3. Private Balance - 03 WhatsApp Status

- ID: 3HukI2LLNn91DmUV.
- Estado: activo.
- Webhook: POST evolution-whatsapp-status.
- Propósito: recibir cambios de estado desde Evolution y persistirlos.
- Eventos que recibe:
	- callbacks de estado de Evolution API.
- Nodos principales:
	- Normalizar Evolution Status.
	- Actualizar WhatsApp Channel.
	- Respond to Webhook.
- Dependencias:
	- Evolution API.
	- PostgreSQL remoto desde n8n.
- Respuesta final:
	- Termina en Respond to Webhook.
- Riesgos conocidos:
	- La consulta detectada actualiza whatsapp_channel, no communication_channels.
	- Pendiente de validar convergencia con el modelo actual del backend.

### 4. Private Balance - Nuevo Ingreso

- ID: 5jlogg6fSggyZ9Qq.
- Estado: activo.
- Webhook: POST private-balance.
- Propósito: registrar eventos financieros y disparar notificaciones WhatsApp.
- Eventos que recibe:
	- income.created.
	- expense.created.
	- calendar.created.
	- backup.run.
	- communication.whatsapp.qr.requested.
	- una rama adicional de fallback observada en el switch y pendiente de validar.
- Nodos principales:
	- Code in JavaScript.
	- Controlar Evento Idempotente.
	- Enrutar Idempotencia.
	- Registrar Event Log.
	- Switch.
	- Normalizar Ingreso / Income.
	- Normalizar Egreso / Expense.
	- Normalizar Agenda / Calendar.
	- Buscar Canal WhatsApp Activo / Buscar Canal WhatsApp Activo1.
	- Canal WhatsApp contextual Ingreso / Canal WhatsApp contextual Egreso.
	- Respuesta sin canal WhatsApp Ingreso / Respuesta sin canal WhatsApp Egreso.
	- Preparar WhatsApp Ingreso / Preparar WhatsApp Egreso.
	- HTTP Request WhatsApp / HTTP Request WhatsApp1.
	- Marcar Evento Procesado.
	- Respond to Webhook.
- Dependencias:
	- PostgreSQL desde n8n.
	- Evolution API.
- Idempotencia:
	- El workflow obtiene `eventId` con prioridad `X-Private-Balance-Event-Id`, `Idempotency-Key`, `payload.eventId`.
	- Antes de `event_log`, `Income`, `Expense`, `Calendar` o Evolution, reclama el evento en `processed_events`.
	- `processed_events.event_id` es unico y actua como barrera de infraestructura; `event_log` sigue siendo solo auditoria.
	- `payload_hash` es SHA256 del payload funcional normalizado (`event`, `source`, `createdAt`, `schemaVersion`, `data`, `userCode`, `deviceCode`, `timezone`, `locale`), excluyendo metadatos volatiles como `receivedAt` y `origin_ip`.
	- Si el `eventId` ya existe con el mismo `payload_hash`, responde `200 OK` con `duplicate: true` y no continua.
	- Si el `eventId` ya existe con otro `payload_hash`, responde `409 Conflict` y no continua.
	- Si el evento es nuevo, continua el flujo normal y al final marca `processed_events.status = processed`.
- Respuesta final:
	- income.created responde vía Respuesta OK -> Respond to Webhook.
	- expense.created responde vía Respuesta OK1 -> Respond to Webhook.
	- Duplicado idempotente responde `{ success: true, duplicate: true, eventId, message: "Event already processed." }`.
	- Conflicto idempotente responde `409` con `Event already exists with different payload.`
	- Si no hay canal contextual conectado en ingreso/egreso, responde con fallback controlado (`code: 404`, `whatsapp: skipped`, `status: not_configured`) sin llamar Evolution API.
	- Se detectaron ramas sin respuesta final para calendar.created y Create Instance -> HTTP Request2.
- Riesgos conocidos:
	- El riesgo de duplicacion por reenvio de Outbox queda mitigado por `processed_events` antes de cualquier escritura financiera o llamada a Evolution.
	- El riesgo de selección global de canal quedó mitigado en ingreso/egreso mediante lookup contextual `deviceCode -> license_devices -> user_code -> communication_channels`.
	- Ramas sin respuesta final al webhook.
	- Nodos HTTP con credenciales sensibles embebidas; no documentar valores ni reutilizarlos fuera de n8n.

## Dependencias de workflows

- n8n.
- Neon PostgreSQL.
- Evolution API.
- Variables N8N_* en Vercel para el gateway.

## Regla operativa consolidada

Los canales de comunicación deben resolverse por deviceCode -> userCode -> communication_channels. Cualquier workflow que use búsqueda global por recencia debe considerarse desalineado con la arquitectura objetivo.

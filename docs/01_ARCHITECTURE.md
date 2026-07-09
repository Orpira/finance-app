# 01 Architecture

## Vista general

Private Balance combina una arquitectura local-first en cliente con un backend serverless mínimo para licencias y automatización.

```text
PWA / APK (React + Dexie + Capacitor)
	|
	| eventos de automatización
	v
automationOutbox (IndexedDB)
	|
	| JWT corto emitido por Vercel
	v
Vercel Functions (/api/*)
	|
	| webhooks autenticados
	v
n8n
	|
	+--> processed_events (idempotency barrier)
	+--> Neon PostgreSQL
	+--> Evolution API
```

## Capas

### Cliente

- src/pages: pantallas funcionales por dominio.
- src/services: casos de uso locales y coordinación de persistencia.
- src/database/db.ts: definición Dexie y migraciones.
- src/store y hooks: estado y utilidades de UI.

### Edge / serverless

- api/automation-token.ts: valida licencia y emite JWT temporal.
- api/automation.ts: valida el evento y lo reenvía a n8n.
- api/communication-channel.ts: expone el canal resuelto para un userCode + deviceCode autenticado.
- api/license-activate.ts: autoriza un dispositivo contra el registro de licencias.

### Integración y automatización

- server/automation: validación de eventos, resolución de canal y despacho a webhooks.
- server/communicationChannelStore.ts: acceso a communication_channels en Neon.
- server/licenseDeviceRegistry.ts: autorización de dispositivos por licencia.
- scripts/: utilidades operativas y despliegue de workflows.

### Idempotencia de automatización

- Los eventos asíncronos salen de `automationOutbox` con `eventId` estable.
- `/api/automation` resuelve el identificador con prioridad `X-Private-Balance-Event-Id`, `Idempotency-Key`, `payload.eventId`.
- El gateway reenvía ese identificador a n8n en `Idempotency-Key` y `X-Private-Balance-Event-Id`.
- El workflow `Private Balance - Nuevo Ingreso` reclama el evento en `processed_events` antes de `event_log`, escrituras financieras o WhatsApp.
- `processed_events.event_id` es `UNIQUE`; `payload_hash` protege contra reutilizar un `eventId` con contenido distinto.
- Un duplicado idéntico devuelve `200 OK` con `duplicate: true`; un duplicado con payload distinto devuelve `409 Conflict`.
- `event_log` no se usa para deduplicar; permanece como auditoría.

## Tecnologías identificadas

- React 19.
- TypeScript 6.
- Vite 8.
- Tailwind CSS 4.
- Capacitor 8.
- Dexie 4 + IndexedDB.
- React Router 7.
- Zustand.
- Zod.
- Neon Serverless Postgres.
- jsPDF y jspdf-autotable.
- Vitest.
- ESLint.

## Carpetas principales

- src/pages/Income: alta, listado y gestión de ingresos.
- src/pages/Expenses: alta, listado y gestión de egresos.
- src/pages/Agenda: citas, recordatorios y conversión a ingreso.
- src/pages/Reports: reportes y exportaciones.
- src/pages/Seasons: temporadas del modo Profesional.
- src/pages/License: activación y estado de licencia.
- src/pages/Settings: configuración, backups y seguridad.
- server: capa de integración con Neon y automatización.
- api: endpoints serverless públicos.
- docs: documentación operativa y técnica.

## Decisiones arquitectónicas confirmadas

- La persistencia financiera principal en cliente es local con Dexie.
- Neon se usa para licencias, dispositivos y canales del backend de automatización.
- n8n es el motor de orquestación externa.
- Evolution API no se consume desde el frontend; se encapsula en n8n.
- MCP se usa como herramienta de auditoría y desarrollo, no como runtime de producción.
- La idempotencia de eventos remotos se resuelve en infraestructura (`processed_events`) antes de ejecutar efectos financieros o notificaciones.

## Riesgos arquitectónicos detectados

- Existen workflows legacy que aún referencian tablas antiguas como whatsapp_channel, app_user y device.
- El workflow Private Balance - Nuevo Ingreso mitigó la selección global de canal WhatsApp en ingreso/egreso con resolución contextual por `deviceCode`; permanece pendiente cerrar ramas sin respuesta en flujos no cubiertos por esa mitigación.

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

## Riesgos arquitectónicos detectados

- Existen workflows legacy que aún referencian tablas antiguas como whatsapp_channel, app_user y device.
- El workflow Private Balance - Nuevo Ingreso tiene ramas sin respuesta y selección global de canal WhatsApp; requiere corrección fuera de esta tarea documental.


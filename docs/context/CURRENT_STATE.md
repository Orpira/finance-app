# Current State

## 1) Estado global del sistema

Private Balance se encuentra en estado operativo con arquitectura local-first estable y una capa de automatización remota funcional.

## 2) Estado por componente

### Cliente

- React + TypeScript + Vite activos.
- Guardias de licencia, PIN y modo de uso operativos.
- Rutas principales activas para Home, Income, Expenses, Agenda, Reports, Settings e Insights.

### Persistencia local

- Dexie en versión 24.
- Tablas financieras operativas estables.
- Snapshots financieros y de conocimiento append-only.

### Serverless/API

- Endpoints activos para token de automatización, dispatch de eventos, canal de comunicación y activación de licencia.
- Validación de request con límites de seguridad y CORS defensivo.

### Automatización

- n8n operativo para provisión, WhatsApp management, status y eventos financieros.
- Idempotencia soportada por `processed_events` en workflows.

### Backend remoto

- Neon como base principal de licencias/dispositivos/canales.
- Resolución contextual de canal implementada por `deviceCode -> userCode -> communication_channels`.

### AI Foundation

- Adapter financiero + shadow/promotion controlados.
- Snapshot/Knowledge pipelines implementados como derivados.
- Dashboard Insights (7F) integrado en modo profesional.

## 3) Estado de calidad

- Suite de tests extensa disponible.
- Build TypeScript/Vite operativo.
- Persisten deudas conocidas de lint/operación n8n documentadas.

## 4) Estado documental

- Constitución, ADRs y changelog canónicos disponibles.
- Paquete architecture/context/handoff creado y alineado.

## 5) Restricciones operativas relevantes

- no exponer secretos en cliente;
- no alterar balances históricos;
- no usar canal global sin contexto;
- no confundir arquitectura objetivo con implementación actual.

## 6) Veredicto de fase documental

Estado de entrega documental: completo y listo para certificación de la fase definida como 8A.

# 03 - Data Model

## 1) Principio de modelado

El sistema separa estrictamente:

- datos financieros operativos locales (fuente canónica);
- datos derivados de análisis (append-only);
- datos remotos de licencia/dispositivo/canal para automatización.

## 2) Persistencia local Dexie (v24)

### Tablas operativas

- `services`: ingresos y servicios.
- `expenses`: egresos y ajustes.
- `appointments`: agenda y ejecución de citas.
- `settings`: configuración de negocio y dispositivo.
- `exchangeRates`: tasas históricas.
- `cutoffReports`: cortes/reportes periódicos.
- `earningPeriods`: temporadas/modos de operación.
- `licenses`: licencia activa local.
- `automationOutbox`: cola de eventos a gateway.
- `communicationChannels`: cache local de estado de canal.
- `deviceIdentity`: vínculo `userCode/deviceCode` local.

### Tablas derivadas append-only

- `financialSnapshots`
- `knowledgeSnapshots`

Reglas:

- hooks Dexie bloquean `update`/`delete`;
- identidad por key de snapshot + revisión;
- idempotencia por fingerprint;
- no forman parte del reset/import-export financiero operativo.

## 3) Invariantes de datos locales

- `services` + `expenses` sostienen balances oficiales.
- snapshots/knowledge no reemplazan fuente oficial global.
- migraciones son aditivas y preservan historial.
- importación valida consistencia antes de limpiar datos existentes.

## 4) Persistencia remota Neon

### Tablas principales

- `licenses`: estado de licencia, tipo, expiración y política de dispositivos.
- `license_devices`: dispositivos autorizados por licencia.
- `communication_channels`: canal por usuario/dispositivo/proveedor.
- `processed_events` (workflow SQL): barrera de idempotencia para eventos.

### Índices y claves relevantes

- único `license_key` en `licenses`.
- único `(license_key, device_code)` en `license_devices`.
- único `(user_code, device_code, provider)` en `communication_channels`.
- único `event_id` en `processed_events`.

## 5) Cadena de resolución contextual de canal

1. evento aporta `deviceCode` o `userCode`;
2. si falta `userCode`, resolver desde `license_devices` por `deviceCode`;
3. consultar `communication_channels` para canal WhatsApp conectado;
4. adjuntar metadatos de canal al payload n8n.

## 6) Modelo de envelope de automatización

Campos de frontera:

- `eventId`
- `event`
- `createdAt`
- `schemaVersion`
- `data`
- `deviceCode` / `userCode` (según evento)
- `source`, `timezone`, `locale`

## 7) Relación modelo local vs remoto

- Local: sistema de registro financiero y operación offline.
- Remoto: autorización, resolución de canal y ejecución automatizada.
- Acoplamiento: mínimo y contractual por API gateway.

## 8) Riesgos de modelo actuales

- coexistencia de referencias legacy en algunos workflows n8n;
- ramas de workflow con respuesta incompleta;
- dependencia de consistencia operativa entre SQL runtime y flujos n8n.

## 9) Controles de consistencia

- validación Zod en frontera API.
- validación criptográfica de licencias V2.
- fail-closed en shadow/promotion pipelines.
- idempotencia en eventos por `eventId` + `payload_hash`.

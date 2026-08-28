# 03 - Data Model

## 1) Principio de modelado

El sistema separa estrictamente:

- datos financieros operativos locales (fuente canónica);
- datos derivados de análisis (append-only);
- datos remotos de licencia/dispositivo/canal para automatización.

## 2) Persistencia local Dexie (v31)

### Tablas operativas

- `services`: ingresos y servicios. Cada ingreso de tipo servicio guarda un
  snapshot inmutable del método de cálculo usado (`incomeCalculationMethod`:
  `service_duration` | `hourly_workday`, PB-IS-0007) y los parámetros con los
  que se calculó (`hourlyRateApplied`, `workedTime`/`workedTimeUnit`,
  `additionalsTotal`), para que cambios posteriores en Configuración nunca
  alteren ingresos históricos. `totalIncome` es un campo legado opcional y no
  autoritativo; el total se deriva al leer.
- `expenses`: egresos y ajustes.
- `appointments`: agenda y ejecución de citas.
- `settings`: configuración de negocio y dispositivo, incluyendo el método
  de cálculo del ingreso por defecto, la unidad de tiempo, el valor por hora
  (PB-IS-0007) y el estado reanudable y versionado del onboarding v2.
- `exchangeRates`: tasas históricas.
- `cutoffReports`: cortes/reportes periódicos.
- `earningPeriods`: temporadas/modos de operación. Desde v31 admite la fecha
  informativa de finalización prevista (`plannedEndDate`) y la meta económica
  opcional (`economicGoal`); ninguna de las dos cierra o altera una temporada.
- `financialGoals`: objetivos financieros persistidos, incorporados en v30 e
  incluidos en backup/restauración.
- `licenses`: licencia activa local.
- `automationOutbox`: cola de eventos a gateway.
- `communicationChannels`: cache local de estado de canal.
- `deviceIdentity`: vínculo `userCode/deviceCode` local.
- `incomeAdditionals` (PB-IS-0007): 0..N importes positivos ("Adicionales")
  vinculados a un ingreso vía `incomeId`. `additionalsTotal` conserva su
  snapshot informativo, pero los Adicionales no modifican `realGain` ni
  `totalAmount`; se agregan a Ingresos y balance general mediante
  `getStoredIncomeValue`, y se excluyen de Ganancia mediante
  `getStoredIncomePrincipalValue`. Se eliminan en cascada cuando se borra el
  ingreso padre, a diferencia de los ajustes en `expenses`, que bloquean ese
  borrado.

### Evolución reciente del esquema

- v30 añade `financialGoals` de forma aditiva y lo integra en
  backup/restauración.
- v31 añade el índice `plannedEndDate` a `earningPeriods`. Su migración conserva
  movimientos y temporadas válidos y elimina únicamente valores opcionales
  inválidos de `plannedEndDate` o `economicGoal`; no recalcula importes ni
  modifica balances históricos.

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

### Compatibilidad de backup

La importación JSON reconoce dos envelopes propios de Private Balance:

- `DatabaseSnapshot`, con `exportedAt` y `settings` como array;
- `BackupData` histórico, con `appName`, `version`, `generatedAt` y `settings`
  como objeto.

Ambos se normalizan al snapshot vigente antes de abrir la transacción Dexie.
Las colecciones opcionales ausentes se sustituyen por arrays vacíos, pero las
colecciones financieras base y las relaciones entre ajustes, Adicionales e
ingresos deben ser válidas. Ante cualquier inconsistencia se rechaza toda la
restauración y se conserva la base local existente.

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

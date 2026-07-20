# 09 - Design Patterns

## 1) Local-First Core

Patrón: el libro financiero vive localmente y la app sigue operativa offline.

Aplicación:

- persistencia Dexie como fuente primaria;
- UI basada en lectura local inmediata;
- automatización desacoplada por outbox.

## 2) Outbox + Retry

Patrón: transacción local primero, envío remoto después.

Aplicación:

- eventos `income/expense/calendar` se guardan con el dato de negocio;
- reintentos escalonados ante fallas de red;
- idempotencia en servidor/workflow para evitar duplicados.

## 3) Fail-Closed

Patrón: ante duda o inconsistencia, bloquear y no degradar integridad.

Aplicación:

- validaciones de licencia/JWT/contratos en API;
- rechazo de snapshots/knowledge inconsistentes;
- estados `rejected/error` en dashboard insights;
- fallback controlado a legacy en adapter financiero.

## 4) Append-Only for Derived Artifacts

Patrón: no sobrescribir historial derivado; crear revisión nueva.

Aplicación:

- `financialSnapshots` y `knowledgeSnapshots`;
- hooks Dexie que impiden update/delete;
- trazabilidad por `supersedes*`.

## 5) Ports and Adapters

Patrón: fronteras explícitas entre dominios y adaptadores.

Aplicación:

- Runtime Adapter entre Knowledge y Insight Runtime;
- Execution Service como orquestador 7D;
- Read Models como frontera 7E para UI.

## 6) Composition Root

Patrón: ensamblar dependencias fuera de componentes presentacionales.

Aplicación:

- `insightDashboardComposition.ts` crea dependencias;
- UI recibe solo estado/proyección, no repositorios internos.

## 7) Feature Flag Controlado

Patrón: activación reversible por bandera explícita.

Aplicación:

- `VITE_FINANCIAL_ENGINE_HOME_ENABLED`
- `VITE_FINANCIAL_SNAPSHOT_SHADOW_ENABLED`
- `VITE_FINANCIAL_SNAPSHOT_HOME_ENABLED`
- `VITE_FINANCIAL_SNAPSHOT_REPORTS_ENABLED`
- `VITE_KNOWLEDGE_SHADOW_ENABLED`

## 8) Security-by-Design

Patrón: secretos y validaciones críticas fuera del cliente.

Aplicación:

- guardas de build para bloquear `VITE_*` sensibles;
- JWT temporal en memoria;
- credenciales n8n/Evolution solo server/workflow.

## 9) Anti-patrones explícitamente evitados

- canal WhatsApp global por recencia sin contexto;
- IA con escritura automática en finanzas;
- acoplar UI a repositorios internos de dominio;
- ejecutar lógica financiera crítica dentro de workflows n8n.

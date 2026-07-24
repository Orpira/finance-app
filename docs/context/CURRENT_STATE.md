# Current State

## 1) Estado global del sistema

Private Balance se encuentra en estado operativo con arquitectura local-first estable y una capa de automatización remota funcional.

## 2) Estado por componente

### Cliente

- React + TypeScript + Vite activos.
- Guardias de licencia, PIN y modo de uso operativos.
- Rutas principales activas para Home, Income, Expenses, Agenda, Reports, Settings e Insights.

### Persistencia local

- Dexie en versión 26.
- Tablas financieras operativas estables.
- Snapshots financieros y de conocimiento append-only.
- Memoria conversacional local persistente por sesion con restauracion en reapertura.

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
- Vertical Slice conversacional 9H integrado en UI con AIConversationService.
- Prompt Builder 10A implementado como dominio independiente provider-neutral con agregado estructurado, segmentos tipados, prioridades, validador fail-closed y builder inmutable.
- Context Builder 10B implementado como dominio independiente provider-neutral con agregado estructurado, secciones tipadas, sources explicitos, prioridades, validador fail-closed y builder inmutable.
- Context Resolution 10C implementado como dominio independiente provider-neutral con AIResolvedContext inmutable, estrategias explicitas y resolver determinista fail-closed.
- AI Provider Adapter 10D implementado como dominio independiente provider-neutral con `AIProvider`, request/response/capabilities canónicos, factory centralizada y adaptador OpenAI desacoplado del dominio.
- AI Execution Pipeline 10E implementado como dominio de orquestación determinista con `execute()`, puertos inyectables y coordinación estricta entre conversación, contexto, prompt y provider.
- AI Execution Inspector 10F implementado como observador pasivo del pipeline con trazas, stages, snapshots inmutables, exportación read-only y pantalla Debug dedicada.
- AI Conversation Integration 11A implementado como `AIConversationApplicationService` sobre `AIExecutionPipeline`, con `ConversationPage` desacoplada del motor y consumo real del flujo completo de IA.
- AI Provider Production Activation 11B implementado reutilizando el `OpenAIProviderAdapter` certificado mediante una composition root dedicada y un proxy serverless autorizado que mantiene la API key solo en servidor/edge.
- AI Long-Term Conversation Memory 11C implementado con `AIConversationMemoryPort` + `LocalConversationRepository`, carga/guardado/listado/eliminacion/limpieza de sesiones via `AIConversationApplicationService` y estados de memoria en el controller sin acceso directo de UI a Dexie.
- AI Tool Calling Infrastructure 11D implementado como dominio provider-neutral `ai-tools` con `AIToolRegistry` + `AIToolExecutor`, catalogo cerrado de fallos, validacion fail-closed de nombre/schema/argumentos/resultado, permisos declarativos (`read-only`, `write`, `dangerous`, `future-confirmation-required`) e integracion por composicion en `AIExecutionPipeline` mediante `tool_call -> tool_result` sin acoplar herramientas al provider ni a Conversation.
- Knowledge Retrieval Tooling 11E implementado como modulo `src/application/knowledge` con contratos readonly/JSON-safe, `LocalKnowledgeRepository` sobre Dexie (`knowledgeDocuments` + `knowledgeChunks`), indexacion configurable, ranking determinista y `KnowledgeSearchTool` registrada en `AIToolRegistry` sin acceso documental directo desde provider ni pipeline.
- PB-IS-012A.1 Financial Tool Contracts scaffolded as a contract-only module under `src/intelligence/ai-tools/financial`, with public types for balance, transactions, budget, goals, investments and reports, without business logic, executors or pipeline integration.
- PB-IS-012A.2 Balance Tool implemented as a read-only adapter over existing financial services, reusing `buildBalanceReport`, `getSettings`, `listServiceIncomes` and `listExpenses` without touching Dexie or the execution pipeline.
- PB-IS-012A.3 Transactions Tool implemented as a read-only adapter over existing financial listing services, exposing structured transaction history via financial contracts without modifying Tool Calling infrastructure.
- PB-IS-012A.4 Budget Tool implemented as a read-only adapter over existing cutoff reporting services, reusing `listCutoffReports` and `getSettings` to expose structured budget status via financial contracts without adding new financial persistence paths or modifying Tool Calling infrastructure.
- PB-IS-012A.5 Goals Tool implemented as a read-only adapter over earning period domain services, reusing `listEarningPeriods`, `getSeasonStatistics` and `getSettings` to expose structured goals status via financial contracts without creating new financial entities or modifying AI infrastructure.
- PB-IS-012A.6 Reports Tool implemented as a read-only adapter over consolidated domain reporting services, reusing `listCutoffReports`, `listEarningPeriods`, `getSeasonStatistics` and `getSettings` to expose structured report sections via financial contracts without recalculating domain statistics or modifying AI infrastructure.
- PB-IS-012A.7 Financial Insights Tool implemented as a read-only adapter over existing financial indicators, reusing `getActiveEarningPeriod`, `listClosedEarningPeriods`, `getSeasonStatistics`, `listCutoffReports` and `getSettings` to expose structured insights and season comparison sections without introducing new metrics or changing AI infrastructure.
- PB-IS-012A.8 Financial Catalog Integration implemented by introducing `financialToolsCatalog` as the single discovery source for certified financial tools and wiring it into the existing `AIToolRegistry` composition root, preserving tool independence and fail-closed registration without creating parallel registries.
- PB-IS-013.1 AI Tool Resolver implemented as a provider-neutral infrastructure service (`createAIToolResolver`) that resolves tools by identifier from a certified catalog over the existing `AIToolRegistry`, validates catalog integrity/uniqueness/type before activation, and exposes controlled fail-closed behavior for unknown tools without executing tools or adding registry side effects.
- PB-IS-013.2 AI Conversation Orchestrator implemented as a provider-neutral coordination service (`createConversationOrchestrator`) that receives structured execution requests, validates order and payload integrity, resolves tools exclusively through `AIToolResolver`, executes them through `AIToolExecutor` in deterministic sequence, captures per-step outcomes (success/failure) and returns a consistent `ConversationExecutionResult` without prompt building, intent inference or LLM provider coupling.
- PB-IS-013.3 AI Prompt Context Builder implemented as a provider-neutral transformation layer (`createPromptContextBuilder`) that consumes `ConversationExecutionResult`, normalizes ordered tool outcomes into a serializable `PromptContext`, preserves execution metadata and per-step traceability, validates both source result and built context fail-closed, and keeps prompt construction deferred to a future layer without provider coupling or natural-language generation.

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

Estado de entrega documental: completo para 11E y listo para iniciar 12A sobre infraestructura de retrieval ya integrada via tool calling.

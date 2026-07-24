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
- PB-IS-013.4 AI Response Composer implemented as a provider-neutral transformation layer (`createConversationResponseComposer`) that consumes `PromptContext`, preserves the full context snapshot, organizes structured summary and step blocks into a serializable `ConversationResponse`, validates prompt-context integrity and block consistency fail-closed, and leaves natural-language generation to a later provider-facing milestone.
- PB-IS-013.5 AI Conversation Facade implemented as a provider-neutral entry point (`createAIConversationFacade`) that coordinates the certified Orchestrator, Prompt Context Builder and Response Composer behind a single API, preserves the full structured pipeline end-to-end, validates each boundary with reused validators and returns a final `ConversationResponse` without introducing provider coupling, prompt templates or UI logic.
- PB-IS-013.6 AI Developer Playground implemented in `src/pages/Debug/AIDeveloperPlaygroundPage.tsx` as a development-only visual tool that executes requests through `AIConversationFacade` and renders four read-only JSON panels (Conversation Request, Conversation Execution Result, Prompt Context, Conversation Response) with controlled stage-aware error reporting, route integration under `/debug/ai-developer-playground`, and no direct provider or prompt-template coupling.
- PB-IS-013.7 Mock Conversational Renderer implemented in `src/intelligence/mock-conversational-renderer` as a deterministic strategy-based renderer that transforms `ConversationResponse` into a serializable `ChatMessage`, with fail-closed validation of rules/messages, explicit financial tool render rules (balance, transactions, goals, budget, reports, insights), controlled error rendering, and integration into AI Developer Playground as Panel 5 (Rendered Conversation) without provider dependencies.
- PB-IS-013.8 Mock Conversational Chat Integration implemented in `src/pages/Conversation` by replacing the main `/conversation` data source with the certified conversational pipeline (`AIConversationFacade -> ConversationResponse -> Mock Conversational Renderer -> ChatMessage`), preserving existing chat UI bubbles, keeping local history in UI state, handling failures as controlled assistant bubbles, and removing direct participation of the previous provider-based conversation flow.
- PB-IS-014.1 Intent Resolution Contracts implemented in `src/intelligence/intent-resolver` with stable provider-neutral contracts (`IntentResolutionRequest`, `IntentResolutionResult`, `IntentResolver`), fail-closed validator and factory (`createIntentResolver`) defaulting to `DeterministicIntentResolver`, plus extraction of deterministic intent rules out of `Conversation` composition so `/conversation` now resolves intent through strategy before invoking `AIConversationFacade`.
- PB-IS-014.2 AI Provider Contracts implemented in `src/intelligence/ai-provider` with provider-neutral metadata/capabilities and separated interfaces (`IntentResolverProvider`, `ConversationGeneratorProvider`), fail-closed validators and `createAIProvider()` factory defaulting to `MockAIProvider`; conversation composition now depends on provider contracts while `MockAIProvider` delegates only to certified components (`DeterministicIntentResolver` and `Mock Conversational Renderer`) without external SDKs or HTTP calls.
- PB-IS-014.4 AI Conversation Service implemented in `src/intelligence/ai-conversation/provider-orchestration` as provider-coordination layer (`processConversation`) with configurable confidence policy, fail-closed fallback to `MockAIProvider`, secure observability metrics (`provider`, `duration`, `operation`, `fallbackUsed`, `success/error`) and unified provider/facade error handling; Conversation composition now delegates AI provider orchestration to this service while keeping `AIConversationFacade` as certified domain entry and preserving existing Conversation UI contracts.
- PB-IS-014.5 Intelligent Conversation Activation Engine implemented in `src/intelligence/ai-conversation/provider-orchestration` with dedicated decision contracts (`ActivationDecision`), configurable policy (`minimumConfidence`, `enableFallback`, `enableAIExplanation`, `enableDirectTools`), routing strategy over `AIToolResolver`, activation types (`DIRECT_TOOL`, `DIRECT_AI`, `TOOL_WITH_AI`, `FALLBACK`, `INVALID_REQUEST`), safe observability metrics and fail-closed validation; `AIConversationService` now executes a precomputed activation decision instead of deciding provider/tool flow, and conversation composition injects the engine using Intent Resolver + Tool Resolver while preserving UI contracts unchanged.
- PB-IS-015.1 Financial Conversation Skills implemented in `src/intelligence/ai-conversation/provider-orchestration` with a dedicated skill-planning layer (`financialConversationSkill`, `financialConversationExecutionPlan`, `financialConversationSkillRegistry`, `financialConversationSkillResolver`, `financialConversationValidator`, `financialConversationFactory`) and six initial skills (`balance`, `transactions`, `budget`, `goals`, `reports`, `insights`); orchestration flow now follows Activation Engine decision -> Skill Resolver selection -> Skill execution-plan build -> AI Conversation Service execution, preserving fail-closed boundaries and provider/tool/UI contracts.
- PB-IS-015.2 Contextual Conversation Memory implemented in `src/intelligence/ai-conversation/provider-orchestration` as an ephemeral enrichment layer over the financial conversation execution flow, with serializable `ConversationMemorySnapshot`, interchangeable `ConversationMemoryStore` (initial `InMemory` implementation), `ConversationContextResolver`, factory/validator contracts and 30-minute configurable expiration; the flow now follows `Activation Engine -> Financial Conversation Skill -> Execution Plan -> Conversation Context Resolver -> AI Conversation Service`, preserving Activation Engine authority, avoiding financial logic inside memory and keeping UI/providers/tools unchanged.
- PB-IS-015.3 Proactive Financial Insights Engine implemented in `src/intelligence/ai-conversation/provider-orchestration` as a rule-engine layer over the certified Financial Insights Tool, with serializable `FinancialInsight` contracts, registry/prioritizer/validator/factory, six evaluators (`budget overspending`, `savings goal risk`, `expense trend`, `income stability`, `subscription opportunity`, `financial health`) and integration into `financialConversationExecutionPlan.ts` + `aiConversationService.ts` so insights enrich the conversation response context without altering Activation Engine, Financial Tools or UI.

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

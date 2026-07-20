# Changelog

<!-- markdownlint-configure-file {"MD024": {"siblings_only": true}} -->

All notable changes to Private Balance are documented in this file.

This project follows Keep a Changelog and uses the Constitution as the canonical source for architecture and rules.

## [Unreleased]

### Added

- Milestone 7F — Insight Dashboard Integration como capa UI desacoplada (`InsightDashboardPage`) sobre fronteras publicas certificadas 7D (`createInsightExecutionService`) y 7E (`createInsightReadModels`), con composition root dedicada, controlador de estado discriminado readonly (`idle/loading/success/empty/rejected/error`), hook de suscripcion con limpieza por unmount, render accesible para loading/empty/error/rejected, listado y resumen basados solo en Read Models, mapeo fail-closed de fallos de ejecucion/proyeccion, descarte de resultados obsoletos por secuencia de requests, bloqueo de ejecucion duplicada durante loading, sin acceso directo a Runtime interno, Builder, Validator, Repository, Orchestrator, Dexie, IndexedDB, persistencia, IA/LLM ni logica de dominio en componentes presentacionales.
- Milestone 7E — Insight Read Models como frontera de proyeccion determinista (`createInsightReadModels`) para transformar exclusivamente respuestas publicas de Insight Runtime en DTOs readonly y JSON-safe para UI, incluyendo resumen general, lista de insights, agrupacion por categoria/severidad, estadisticas, indicadores de confianza, metadata de actualizacion y trazabilidad minima navegable, con salida inmutable por congelacion profunda, fail-closed ante contratos invalidos y sin acceso a Runtime interno, Builder, Validator, Repository, Orchestrator, Dexie, IndexedDB, persistencia, UI/React ni IA/LLM.
- Milestone 7D — Insight Execution Service como orquestador determinista de aplicacion (`createInsightExecutionService`) para componer exclusivamente los puertos publicos de 7B (`SnapshotKnowledgeIntegration`) y 7C (`KnowledgeIntegration`), con request/result/failure/stage/traceability explicitos, validacion minima de frontera, ejecucion maximo-una-vez por etapa, propagacion fail-closed de rechazos y excepciones controlables, rechazo de resultados inconsistentes o mismatches de trazabilidad entre Snapshot -> Knowledge -> Runtime, sin acceso directo a InsightRuntime, Runtime Adapter, Builder, Validator, Repository, Orchestrator interno, Dexie, IndexedDB, persistencia, UI/React ni IA/LLM.
- Milestone 7C — Knowledge Integration como frontera determinista `Knowledge Layer -> Runtime Adapter` (`createKnowledgeIntegration`) con contratos publicos de request/result/failure/traceability, validacion minima de frontera para `KnowledgeCollection` (estado, estructura, protocolo y versiones compatibles), adaptacion readonly al request de ejecucion del Runtime Adapter, delegacion unica y fail-closed ante dependencia ausente, excepciones controlables o respuestas inconsistentes, preservando trazabilidad completa entre `KnowledgeCollection` y runtime sin acceso directo a InsightRuntime, Builder, Validator, Repository, Dexie, IndexedDB, UI/React o IA/LLM.
- Milestone 7B — Snapshot Integration como frontera determinista `FinancialSnapshot -> Knowledge Layer` (`createSnapshotKnowledgeIntegration`) con contratos publicos explicitos de request/result/failure/traceability, validacion minima de compatibilidad estructural y de version/protocolo del snapshot canonico, delegacion unica por puerto a la API publica de Knowledge Layer, verificacion de coherencia de `KnowledgeCollection` + trazabilidad snapshot-coleccion y fail-closed estricto con codigos estables, sin Dexie/IndexedDB, sin Runtime Adapter, sin InsightRuntime, sin persistencia, sin UI/React y sin IA/LLM.
- Milestone 7A — Runtime Adapter de integracion determinista (`createRuntimeAdapter`) para conectar Financial Snapshot y Knowledge Layer con la API publica de Insight Runtime, construyendo `KnowledgeCollection` valida via contratos existentes (`buildKnowledgeCollectionFromSnapshot` + `validateKnowledgeCollection`), delegando exclusivamente en `runtime.execute`, propagando respuestas de Runtime en resultado estable de integracion y aplicando fail-closed con codigos explicitos de adaptacion sin logica de negocio, sin acceso directo al Insight Repository/Builder/Validator, sin IndexedDB/Dexie directo, sin UI/React y sin IA/LLM.
- Milestone 6G — Insight Runtime como frontera estable de aplicacion (`createInsightRuntime`) sobre el Insight Engine Orchestrator, con contrato explicito de ejecucion (`InsightRuntimeRequest`), respuesta publica determinista (`InsightRuntimeResponse` con `InsightRuntimeSuccess`/`InsightRuntimeFailure`), codigos de fallo estables, consultas de lectura delegadas al Repository (`getSnapshot/getAll/getById/query/count/exists`), validaciones fail-closed para request/knowledge/rules/dependencias/resultados inconsistentes y preservacion estricta del estado del Repository ante fallos, sin persistencia, sin Dexie, sin IndexedDB, sin UI/React y sin IA/LLM.
- Milestone 6F — Insight Engine Orchestrator determinista (`createInsightEngine`) como Application Service de dominio para coordinar el pipeline `KnowledgeCollection -> Builder -> Validator -> Repository`, con dependencias inyectables por interfaces, actualizacion de repositorio solo con validacion valida, rechazo fail-closed cuando la validacion falla o rompe invariantes, resultado de ejecucion tipado (`InsightEngineResult`) y sin persistencia, sin Dexie, sin IndexedDB, sin UI, sin React y sin IA/LLM.
- Milestone 6E — Insight Repository determinista en memoria (`createInsightRepository`) con interfaces de dominio y operaciones puras `replace/getAll/getById/exists/count/clear/getByCategory/getBySeverity/getByStatus/getByScope/getByRule/filterByConfidence/getStatistics`, resumen estadistico determinista sin cache, fail-closed y sin dependencias de persistencia, IndexedDB, API, backend, UI, React ni IA/LLM.
- Milestone 6D — Insight Validator determinista (`validateInsightCollection`) para certificar `InsightCollection` sin construir/modificar insights, con `ValidationIssue` + `ValidationReport`, validacion fail-closed de estructura, ids unicos, evidence, confidence, referencias de regla, compatibilidad de versiones, categorias, scope, status, severity, ausencia de duplicados y consistencia interna, sin persistencia, sin runtime scheduler y sin IA/LLM.
- Milestone 6C — Insight Builder determinista (`buildInsightCollection`) para transformar `KnowledgeCollection` validada en `InsightCollection` mediante `InsightRuleDescriptor`, con evaluacion de compatibilidad rule/input, ejecucion solo de reglas habilitadas, evidencia trazable Knowledge->Rule->Evidence->Insight, calculo de confidence (`fixed-score`, `bounded-score`, `evidence-derived` via interfaz inyectada), comportamiento fail-closed, sin persistencia, sin acceso a IndexedDB, sin UI y sin dependencias de IA/LLM.
- Milestone 6B — Insight Rule Model con contratos declarativos de regla (`insightRule`), identidad determinista (`ruleId`, `ruleVersion`, `protocolVersion`), dependencias explicitas hacia Knowledge Layer, compatibilidad versionada, metadata y catalogo vacio fail-closed, sin runtime, sin Builder, sin Validator, sin Repository, sin persistencia, sin IA y sin LLM.
- Knowledge Promotion Executor controlado (Milestone 5J) con `executeKnowledgePromotion`, feature flag independiente `VITE_KNOWLEDGE_PROMOTION_ENABLED`, resolucion contextual fail-closed desde `KnowledgeSnapshotRepository`, validacion de cadena/revision/integridad/versiones, fallback seguro sin persistencia y sin convertir Knowledge en fuente visible de Home, Reports ni Insight Engine.
- Knowledge Promotion Policy pura (Milestone 5I) con `assessKnowledgeSnapshotPromotion`, contratos pasivos de assessment/checks/warnings/failures, matriz cerrada de checks estructurales y de version para `SealedKnowledgeSnapshot`, evaluacion deterministicamente fail-closed, sin repository, sin Dexie, sin IndexedDB, sin promotion efectiva y sin Promotion Executor.
- Knowledge Shadow Mode observacional (Milestone 5H) con `knowledgeShadowModeService`, feature flag independiente `VITE_KNOWLEDGE_SHADOW_ENABLED`, punto unico de integracion inmediatamente despues de Snapshot Shadow Mode, deduplicacion local por snapshot+versiones, pipeline completo builder/validator/canonicalizer/fingerprint/sealer/repository, comparacion segura de metadata, logs solo en desarrollo, aislamiento total de fallos y sin convertir Knowledge en fuente oficial.
- Knowledge Repository local append-only (Milestone 5G) con `KnowledgeSnapshotRepository`, contrato `PersistedKnowledgeSnapshot`, tabla Dexie `knowledgeSnapshots`, primary key `knowledgeSnapshotId`, índice único `[knowledgeSnapshotKey+revision]`, revisión transaccional (`latest + 1`), validación estricta de supersedes inmediato, idempotencia por `knowledgeSnapshotId`, hooks append-only para bloquear `update/delete`, suite unitaria dedicada y validación IndexedDB real sin cambios sobre tablas financieras.
- Knowledge Sealer deterministico (Milestone 5F) con `sealCanonicalKnowledgeDocument` y `deriveKnowledgeSnapshotKey`, verificacion estricta del fingerprint oficial (algoritmo/encoding/domain/version/canonicalization/value), reglas explicitas de `revision` y `supersedesKnowledgeSnapshotId`, validacion fail-closed de `sealedAt` provisto por caller, salida contractual `SealedKnowledgeSnapshot` con estado fijo `sealed`, sin persistencia, sin repository, sin Insight Engine y sin LLM, y suite dedicada de 54 tests.
- Knowledge Fingerprint determinista (Milestone 5E) con `fingerprintCanonicalKnowledgeDocument`, Web Crypto SHA-256, preimagen UTF-8 con domain separator exclusivo `private-balance:knowledge:fingerprint:v1:`, salida `hex-lower` y suite dedicada de 30+ tests, sin sellado ni persistencia.
- Knowledge Canonicalization versionada (Milestone 5D) con `canonicalizeValidatedKnowledgeCollection`, documento canonico `knowledge-c14n/1.0.0`, orden determinista de objetos/facts/relationships/evidence references, normalizacion numerica `-0 -> 0` y serializacion determinista `serializeCanonicalKnowledgeDocument`, sin fingerprint, sin sellado y sin persistencia.
- Knowledge Collection Validator deterministico (Milestone 5C) con `validateKnowledgeCollection`, separacion estricta Draft/Validated, matriz cerrada de versiones, matriz de contradicciones, rechazo de estructuras no serializables/tipos no permitidos de relacion y suite dedicada de 50+ tests fail-closed sin generacion de nuevos facts.
- Knowledge Facts Builder deterministico (Milestone 5B) con `buildKnowledgeCollectionFromSnapshot`, catalogo inicial cerrado de facts, IDs estables por snapshot sellado y suite dedicada de 50 tests de invariantes/no-IO.
- Knowledge Layer Foundation contracts as a deterministic, append-only, local-first domain model derived from sealed Financial Snapshot, without runtime behavior, persistence, builders, repositories, insights or LLM execution.
- Deterministic, read-only Financial Engine adapter with parity characterization.
- Reports shadow mode, which observes parity while keeping legacy official.
- Reversible Home balance-summary pilot controlled only by the exact Vite build value `VITE_FINANCIAL_ENGINE_HOME_ENABLED=true`.
- Observational Financial Snapshot shadow mode for Home's current-month balance, disabled by default and enabled only by exact `VITE_FINANCIAL_SNAPSHOT_SHADOW_ENABLED=true`.
- Complete local Snapshot pipeline with embedded material evidence, validation, canonicalization, fingerprinting, sealing, append-only persistence, revision comparison and in-flight deduplication.
- Pure deterministic Snapshot Promotion Policy assessment with closed version compatibility, structured checks and no automatic promotion.
- Controlled Home current-month Snapshot promotion execution, enabled only by exact `VITE_FINANCIAL_SNAPSHOT_HOME_ENABLED=true`, with repository-chain, integrity, scope, version and mandatory policy checks.
- Controlled Reports current-month Snapshot promotion pilot, enabled only by exact `VITE_FINANCIAL_SNAPSHOT_REPORTS_ENABLED=true`, with read-only repository validation, policy enforcement and fail-closed fallback to the existing Reports flow.
- Canonicalization V2 (`financial-snapshot-c14n/2.0.0`) with explicit separation between material payload and operational metadata.
- Fingerprint V2 (`financial-snapshot-fingerprint/2.0.0`) with domain separation `private-balance:financial-snapshot:fingerprint:v2:` and `material-payload` preimage declaration.
- Real IndexedDB validation for five equivalent shadow executions with varying `generatedAt`, `sealedAt`, `persistedAt` and render `asOf` producing a single material revision.

### Changed

- The documentation hierarchy was normalized so [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md) is the single canonical source.
- [MCP_RULES.md](MCP_RULES.md) now acts as a short operational summary for agents.
- [DECISIONS.md](DECISIONS.md) was aligned with ADR structure and references the Constitution explicitly.
- AI Foundation documentation now separates implemented pilot behavior from target architecture. Legacy remains the default official source; Financial Engine is not global, and rollback of the Home pilot requires rebuild and redeploy.
- Financial Snapshot remains derived and non-official; shadow failures are isolated and production emits no Snapshot logs or telemetry.
- Snapshot promotion eligibility is evaluated without repository access, persistence, consumers, score, clock, network or randomness.
- Snapshot promotion execution is read-only and fail-closed: the current result remains the immediate fallback, rollback is rebuild/redeploy, production emits no logs, and Snapshot is still not a global source.
- Monthly Snapshot material identity no longer depends on render-time `asOf` or `generatedAt`; those values are now operational-only in V2.
- Snapshot promotion compatibility is now explicit by matrix: V1 remains readable/verifiable but is no longer eligible for the Home pilot; V2 is the only promotable lineage.
- Knowledge remains derived and non-official after Milestone 5H; no Promotion Policy, Promotion Executor, Insight Engine or LLM runtime were added.
- Knowledge remains derived and non-official after Milestone 5I; Promotion Policy exists only as pure assessment and Promotion Executor still does not exist.
- Knowledge remains derived and non-official after Milestone 5J; the controlled Promotion Executor exists only as a contextual resolver with rollback by flag disable, and there is still no visible consumer, Insight Engine, IA or LLM runtime.

### Removed

- The obsolete 06_MCP_RULES.md document is no longer part of the tree.

## [2026-07-06]

### Added

- The initial documentation set from [00_PROJECT_VISION.md](00_PROJECT_VISION.md) through [08_DEPLOYMENT.md](08_DEPLOYMENT.md).
- [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md) as the master document.
- [docs/README.md](README.md) as the documentation index.

### Fixed

- Cross-document governance and canonical references for documentation.

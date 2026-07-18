# Changelog

All notable changes to Private Balance are documented in this file.

This project follows Keep a Changelog and uses the Constitution as the canonical source for architecture and rules.

## [Unreleased]

### Added

- Milestone 6A — Insight Engine Foundation con contratos iniciales de `Insight` e `InsightCollection`, identidad determinista conceptual, trazabilidad hacia Knowledge Layer y versionado explicito; sin runtime, sin consumidor visible, sin persistencia, sin reglas ejecutables, sin IA y sin LLM.
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

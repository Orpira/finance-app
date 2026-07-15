# Changelog

All notable changes to Private Balance are documented in this file.

This project follows Keep a Changelog and uses the Constitution as the canonical source for architecture and rules.

## [Unreleased]

### Added

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

### Removed

- The obsolete 06_MCP_RULES.md document is no longer part of the tree.

## [2026-07-06]

### Added

- The initial documentation set from [00_PROJECT_VISION.md](00_PROJECT_VISION.md) through [08_DEPLOYMENT.md](08_DEPLOYMENT.md).
- [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md) as the master document.
- [docs/README.md](README.md) as the documentation index.

### Fixed

- Cross-document governance and canonical references for documentation.

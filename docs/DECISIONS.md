# Decisions

Architecture Decision Records for Private Balance.

Format used: one ADR per section with Context, Decision, Status and Consequences.

## ADR-001: Neon as the primary backend database

- Status: accepted.
- Context: the project needs a lightweight backend for automation and licensing without turning the app into an online-first system.
- Decision: Neon PostgreSQL is the main backend database for licenses, devices and channels.
- Consequences: Supabase is not the primary reference unless a future explicit decision says otherwise.

## ADR-002: n8n as the automation engine

- Status: accepted.
- Context: business events leave the PWA through the outbox and are dispatched through Vercel to webhooks.
- Decision: n8n orchestrates external automation.
- Consequences: critical workflows must always end in Respond to Webhook and must document response behavior.

## ADR-003: Evolution API as the WhatsApp provider

- Status: accepted.
- Context: the PWA and APK must not contain secrets or integrate directly with WhatsApp endpoints.
- Decision: Evolution API handles WhatsApp.
- Consequences: Evolution is encapsulated inside n8n and its credentials remain in server-side scope.

## ADR-004: MCP as an audit/development tool, not production runtime

- Status: accepted.
- Context: the project needs assisted inspection and documentation without introducing an operational dependency in production.
- Decision: MCP is used for audit, inspection and development assistance only.
- Consequences: production changes still rely on TypeScript, Vercel, Neon, n8n and Evolution.

## ADR-005: Contextual channel resolution is mandatory

- Status: accepted.
- Context: the backend can resolve userCode from license_devices and then look up the active channel by context.
- Decision: channel resolution must follow deviceCode -> userCode -> communication_channels.
- Consequences: global recency searches are discouraged and should be considered invalid unless explicitly justified.

## ADR-006: Private Balance Constitution as the canonical source

- Status: accepted.
- Context: the repository needed a single source of truth to consolidate vision, architecture, rules and decisions.
- Decision: [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md) becomes the master document.
- Consequences: [MCP_RULES.md](MCP_RULES.md) is only an operational summary and legacy 06_MCP_RULES.md stays obsolete.

## ADR-007: Documentation index in docs/README.md

- Status: accepted.
- Context: the documentation tree needs a discoverability entry point.
- Decision: [docs/README.md](README.md) explains the purpose of each document.
- Consequences: newcomers and agents can navigate the docs without guessing the structure.

## ADR-008: Controlled Financial Engine adoption

- Status: accepted for the AI Foundation milestone.
- Context: the deterministic adapter needs production-shaped validation without changing the official financial source globally.
- Decision: legacy remains official by default; Reports runs only in shadow mode, and the Home balance-summary pilot is enabled exclusively by the exact Vite build value `VITE_FINANCIAL_ENGINE_HOME_ENABLED=true`.
- Consequences: there is no programmatic override or runtime toggle. Absence, `false` and invalid values select legacy. Rollback requires rebuild and redeploy. Financial Engine is not a global source, no additional consumer is migrated, and Financial Snapshot, Rule Registry, Knowledge Layer and Insight Engine remain unimplemented target architecture.

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


## ADR-009: System Architecture Master as the integrated architecture map

- Status: accepted.
- Context: the Constitution is normative, but the repository also needs one current map connecting implemented architecture, bounded contexts, dependency rules, quality gates, risks and roadmap.
- Decision: [`00_SYSTEM_ARCHITECTURE_MASTER.md`](00_SYSTEM_ARCHITECTURE_MASTER.md) is adopted as the integrated architecture map and mandatory onboarding document immediately after the Constitution.
- Consequences: the Constitution remains the highest normative authority; the Master must distinguish implemented capabilities from target architecture and be updated whenever a structural milestone, source of truth, major risk or roadmap state changes.

## ADR-032: Season goal uses realized net result

- Status: accepted on 2026-08-27; the Additions clause was superseded by ADR-033 on 2026-08-28.
- Canonical record: [ADR-032-SEASON-GOAL-REALIZED-NET-RESULT.md](adr/ADR-032-SEASON-GOAL-REALIZED-NET-RESULT.md).
- Context: Agenda, manual income entry, Home, Movements, Seasons and Reports did not all present or aggregate the same stored financial value. Season goal progress counted income but did not subtract realized expenses, and negative results were normalized to zero.
- Decision: for `service_duration`, the season percentage is the professional's participation and is applied exactly once as `realGain = totalAmount * percentage / 100`. Therefore, 100 at 30 % produces 30, while 0 % produces 0; choosing "No aplica porcentaje" persists 100 %. `hourly_workday` remains outside this percentage rule. The realized season result is `stored principal non-adjustment income - stored non-adjustment expenses`; ADR-033 excludes Additions and adjustments remain separate. Progress is `result / economicGoal * 100` and may be negative or exceed 100 %, although the visual bar is limited to 0–100 %.
- Consequences: Agenda and manual `service_duration` registration use the same calculation Strategy; Home, Movements, Seasons and Reports consume persisted monetary snapshots without recomputing historical exchange rates. No Dexie schema change, data migration or historical rewrite is required. Records using the historical `seasonPeriodId` alias remain readable, and inconsistent dual season identifiers fail closed in the financial derivation.

## ADR-033: Additions count as Income, not Profit

- Status: accepted with explicit owner authorization on 2026-08-28.
- Canonical record: [ADR-033-ADDITIONALS-INCOME-NOT-PROFIT.md](adr/ADR-033-ADDITIONALS-INCOME-NOT-PROFIT.md).
- Decision: Income is principal plus Additions; real Profit is principal; net Profit, Saving and Season Goal are principal minus expenses; general balance retains Additions and explicit adjustment impact. Net movement/cutoff balances retain Additions because they represent cash balance rather than Profit.
- Consequences: consumers choose `getStoredIncomeValue` for Income or `getStoredIncomePrincipalValue` for Profit. `totalIncome` remains a non-authoritative legacy field, no Dexie migration or historical rewrite is performed, and insufficient currency evidence fails closed.

## ADR-034: Copilot proactive notifications scope

- Status: accepted; Fase 1 implemented on 2026-08-30 (`src/notifications/`).
- Canonical record: [ADR-034-Copilot-Proactive-Notifications.md](adr/ADR-034-Copilot-Proactive-Notifications.md).
- Context: the Copilot can detect relevant situations (goal risk, unusual expenses, income drops, season closing, agenda actions, data inconsistencies) without the user asking first, but no architectural decision defined when a detected insight is allowed to become a proactive notification.
- Decision: every candidate notification must pass through a mandatory `Notification Policy Engine` (relevance, priority P0–P3, confidence ≥ 0.70, user preferences, deduplication via `dedupKey`, frequency caps, cooldown, revalidation against current state, expiration, privacy) before it can be shown; the Copilot itself never emits a notification directly. `Insight ≠ Notification`. The Copilot may detect, explain and recommend, but a notification can never execute a financial action automatically, and `P1` notifications must always carry an associated action.
- Consequences: introduces a new `Notification Policy Engine` and local notification state/repository (IndexedDB) that any future proactive-notification feature must go through; implementation is staged (Fase 1 deterministic season/agenda events, Fase 2 financial insights, Fase 3 complex Copilot-detected relationships) and this ADR does not itself require immediate implementation of any phase.

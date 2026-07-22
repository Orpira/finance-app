# Índice Documental Operativo

Este índice centraliza la documentación canónica existente y el paquete de handoff creado para certificación técnica del hito 8A.

## 1) Fuentes canónicas existentes

- `docs/PRIVATE_BALANCE_CONSTITUTION.md`: constitución técnica y reglas inmutables.
- `docs/DECISIONS.md`: ADRs vigentes.
- `docs/CHANGELOG.md`: historial de cambios por hitos.
- `docs/03_DATABASE.md`: estado de persistencia Dexie + Neon.
- `docs/04_N8N_WORKFLOWS.md`: inventario de workflows y riesgos.
- `docs/AUTOMATION_HUB.md`: contrato operativo PWA -> Vercel -> n8n.
- `docs/09_AI_CORE_ARCHITECTURE.md`: arquitectura objetivo del AI Core (no implica implementación completa).
- `docs/25_INSIGHT_DASHBOARD_INTEGRATION.md`: integración UI de Insights (hito 7F).

## 2) Paquete `docs/architecture`

- `docs/architecture/00_PROJECT_OVERVIEW.md`: visión técnica consolidada y alcance real.
- `docs/architecture/01_ARCHITECTURE.md`: arquitectura por capas, límites y flujos.
- `docs/architecture/02_FOLDER_STRUCTURE.md`: estructura de carpetas y responsabilidad por módulo.
- `docs/architecture/03_DATA_MODEL.md`: modelo de datos local/remoto e invariantes.
- `docs/architecture/04_APPLICATION_FLOW.md`: flujos end-to-end principales.
- `docs/architecture/05_SERVICES.md`: catálogo de servicios de aplicación.
- `docs/architecture/06_REPOSITORIES.md`: repositorios de snapshot/knowledge/insight.
- `docs/architecture/07_STATE_MANAGEMENT.md`: gestión de estado en UI y runtime.
- `docs/architecture/08_DEPENDENCIES.md`: dependencias y criterios de uso.
- `docs/architecture/09_DESIGN_PATTERNS.md`: patrones arquitectónicos aplicados.
- `docs/architecture/10_CODING_RULES.md`: reglas de implementación y límites.
- `docs/architecture/11_SECURITY.md`: modelo de seguridad, controles y superficies de ataque.
- `docs/architecture/12_TESTING.md`: estrategia de pruebas y cobertura observable.
- `docs/architecture/13_TECHNICAL_DEBT.md`: deuda técnica priorizada.
- `docs/architecture/14_DECISIONS.md`: decisiones estructurales operativas.
- `docs/architecture/15_CHANGELOG.md`: línea de tiempo técnica consolidada.

## 3) Paquete `docs/context`

- `docs/context/CURRENT_STATE.md`: estado verificable actual del sistema.
- `docs/context/NEXT_TASK.md`: siguiente trabajo recomendado y secuencia.
- `docs/context/KNOWN_ISSUES.md`: problemas conocidos y estado.
- `docs/context/TODO.md`: backlog de ejecución técnica.
- `docs/context/ROADMAP.md`: hoja de ruta por fases.
- `docs/context/RISKS.md`: registro de riesgos con mitigaciones.

## 4) Documentos de traspaso IA

- `docs/AI_CONTEXT.md`: contexto operativo para agentes IA y handoff técnico.
- `docs/HANDOFF.md`: resumen ejecutivo de traspaso y criterio de cierre 8A.

## 5) Orden de lectura recomendado

1. `docs/PRIVATE_BALANCE_CONSTITUTION.md`
2. `docs/00_SYSTEM_ARCHITECTURE_MASTER.md`
3. `docs/AI_CONTEXT.md`
4. `docs/architecture/01_ARCHITECTURE.md`
5. `docs/architecture/03_DATA_MODEL.md`
6. `docs/architecture/04_APPLICATION_FLOW.md`
7. `docs/context/CURRENT_STATE.md`
8. `docs/HANDOFF.md`

## 6) Regla de gobernanza documental

Si hay conflicto entre documentos:

1. Constitución técnica.
2. ADRs de `docs/DECISIONS.md`.
3. Este paquete architecture/context/handoff.
4. Documentación auxiliar restante.

## Engineering Governance and AI Interaction Platform

- [Engineering Governance](./02_ENGINEERING_GOVERNANCE.md)
- [Roadmap Master](./03_ROADMAP_MASTER.md)
- [Official Glossary](./04_GLOSSARY.md)
- [AI Interaction Architecture](./architecture/AI_INTERACTION_ARCHITECTURE.md)
- [ADR-010 — AI Interaction Platform](./adr/ADR-010-AI-INTERACTION-PLATFORM.md)
- [ADR-011 — AI Interaction Policies](./adr/ADR-011-AI-INTERACTION-POLICIES.md)
- [ADR-012 — AI Interaction Lifecycle](./adr/ADR-012-AI-Interaction-Lifecycle.md)
- [ADR-013 — AI Conversation Contracts](./adr/ADR-013-AI-Conversation-Contracts.md)
- [ADR-014 — AI Conversation Session](./adr/ADR-014-AI-Conversation-Session.md)
- [ADR-015 — AI Conversation Message](./adr/ADR-015-AI-Conversation-Message.md)
- [ADR-016 — AI Conversation Service](./adr/ADR-016-AI-Conversation-Service.md)
- [ADR-017 — AI Conversation Vertical Slice](./adr/ADR-017-AI-Conversation-Vertical-Slice.md)
- [ADR-018 — AI Prompt Builder](./adr/ADR-018-AI-Prompt-Builder.md)
- [ADR-019 — AI Context Builder](./adr/ADR-019-AI-Context-Builder.md)
- [ADR-020 — AI Context Resolution](./adr/ADR-020-AI-Context-Resolution.md)
- [ADR-021 — AI Provider Adapter](./adr/ADR-021-AI-Provider-Adapter.md)
- [ADR-022 — AI Execution Pipeline](./adr/ADR-022-AI-Execution-Pipeline.md)
- [ADR-023 — AI Execution Inspector](./adr/ADR-023-AI-Execution-Inspector.md)
- [ADR-024 — AI Conversation Integration](./adr/ADR-024-AI-Conversation-Integration.md)
- [ADR-025 — AI Provider Production Activation](./adr/ADR-025-AI-Provider-Production-Activation.md)
- [AI Interaction Domain](./domains/ai-interaction/README.md)
- [AI Conversation Domain](./domains/ai-conversation/README.md)
- [Prompt Builder Domain](./domains/prompt-builder/README.md)
- [Context Builder Domain](./domains/context-builder/README.md)
- [Context Resolution Domain](./domains/context-resolution/README.md)
- [Provider Adapter Domain](./domains/provider/README.md)
- [Execution Pipeline Domain](./domains/execution-pipeline/README.md)
- [Execution Inspector Domain](./domains/execution-inspector/README.md)

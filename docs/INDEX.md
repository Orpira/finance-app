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
2. `docs/AI_CONTEXT.md`
3. `docs/architecture/01_ARCHITECTURE.md`
4. `docs/architecture/03_DATA_MODEL.md`
5. `docs/architecture/04_APPLICATION_FLOW.md`
6. `docs/context/CURRENT_STATE.md`
7. `docs/HANDOFF.md`

## 6) Regla de gobernanza documental

Si hay conflicto entre documentos:

1. Constitución técnica.
2. ADRs de `docs/DECISIONS.md`.
3. Este paquete architecture/context/handoff.
4. Documentación auxiliar restante.

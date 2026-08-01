# Private Balance — Roadmap de la plataforma inteligente

Ver [ADR-030](../adr/ADR-030-Intelligent-Assistant-Platform.md). Cubre las entregas 12 (roadmap de evolución) y 13 (plan de implementación por iteraciones) de la segunda iteración del rediseño. Complementa, no reemplaza, `docs/context/ROADMAP.md` (fases R1-R4, deuda técnica de automatización).

## 1. Evolución futura (arquitectura preparada, no implementada)

### IA local vs. IA cloud

El modelo `LOCAL_ONLY`/`EXTERNAL_PROVIDER` de 8A ya anticipa esta distinción a nivel de contrato. Evolución recomendada, en orden:

1. Conectar 8A al pipeline real (prerequisito de todo lo demás — ver `18_AI_MEMORY_AND_PRIVACY_MODEL.md` §2).
2. Mantener el Insight Engine y las reglas deterministas como la "inteligencia local" primaria — ya no requieren ningún proveedor externo y deben seguir cubriendo la mayoría de los casos de uso de consulta.
3. Reservar `EXTERNAL_PROVIDER` (OpenAI hoy) exclusivamente para interpretación de lenguaje natural y explicaciones — nunca para cálculo.
4. Evaluar, más adelante, un modelo local embebido (on-device) para interpretación básica sin red, detrás de la misma interfaz `AIProvider` — el contrato ya es provider-neutral (ADR-025/027), por lo que añadir un adapter local no debería requerir cambios en `ai-tools` ni en `execution-pipeline`.

### Modelos y proveedores múltiples

`AIToolRegistry`, `AIProvider` y `AIPrivacyBoundary` ya están diseñados provider-neutral. La evolución no requiere una reescritura, sino:

- Registrar más de un adapter (`openAIAdapter.ts` ya existe como referencia) detrás de una única interfaz `AIProvider`.
- Permitir que la selección de proveedor sea por tipo de tarea (p. ej. un modelo económico para clasificación simple, uno más capaz para conversación) — esto es una decisión de `aiProviderFactory.ts`, no de las capas superiores.

### Agentes especializados

Fuera de alcance de cualquier iteración cercana. Si se persigue en el futuro, debe evaluarse contra el principio rector de ADR-030 ("inteligencia/simplificación/automatización antes que interfaz nueva") — un agente especializado solo se justifica si resuelve algo que el modelo conversacional único, con sus tools, no puede resolver ya.

## 2. Plan de implementación por iteraciones

### Iteración 3 — Flujo de acción del Asistente ✅ implementada (2026-08-02)

Ver [ADR-031](../adr/ADR-031-Assistant-Action-Flow-Implementation.md) y [19_ASSISTANT_ACTION_FLOW.md](19_ASSISTANT_ACTION_FLOW.md). Se implementó con un diseño distinto al planeado aquí originalmente (parser determinista local en vez de tools resueltas por el pipeline LLM — el pipeline asumido, `aiExecutionPipeline.ts`, no era el real):

- `register_income`, `register_expense`, `create_appointment` de punta a punta: interpretación → propuesta → Proposal Editor → confirmación → Execution Guard → servicio de dominio real → auditoría.
- Frontera de privacidad 8A conectada y probada para este flujo (modo `LOCAL_ONLY`, ver §5 de `19_ASSISTANT_ACTION_FLOW.md`).
- `mark_income_reported`, `generate_report`, `create_season`/`close_season` **no** se implementaron — quedan en la Iteración 4.
- Pendiente de esta iteración: botón visible de "Borrar conversación" en la UI (`clearMemory` ya existe en el backend, ADR-026).

### Iteración 4 — Resto de acciones + tools de consulta faltantes

- Acciones: `mark_income_reported`, `generate_report`, `create_season`/`close_season`, siguiendo el mismo patrón (parser determinista + Execution Guard + servicio real), salvo que se decida que alguna sí necesita interpretación por IA (frases más abiertas) — evaluar caso por caso.
- Consultas: `financial_unreported_income`, `compare_periods`, `best_period`, `smart_insights` (puente al Insight Engine real) como tools `read-only` del pipeline conversacional existente (`ai-tools/financial/*`), envolviendo servicios ya probados.
- Botón de "Borrar conversación" visible en la UI del Asistente.

### Iteración 5 — Conectar 8A al camino de consulta (requiere UI de consentimiento)

- Diseñar y construir la UI mínima de consentimiento para `EXTERNAL_PROVIDER` (la política ya exige `AIConsentRecord`; hoy no hay forma de otorgarlo).
- Insertar `AIPrivacyBoundary.authorize()` en el camino real de consulta (`conversationComposition.ts` → `provider-orchestration`), no en `aiExecutionPipeline.ts`.
- Resolver, como parte de este trabajo, cuál composition root (`conversationComposition.ts` vs. `aiConversationApplicationComposition.ts`) debería ser la fuente de verdad — hoy conviven dos, solo una está conectada a la UI real (ver ADR-031).

### Iteración 6 — Consolidación de Movimientos e Inicio

- Unificar de verdad `IncomeListPage`/`ExpenseListPage`/`MovementsPage` (hoy la segunda envuelve a las dos primeras) en una sola vista con filtros compartidos.
- Migrar el "resumen inteligente" de `HomePage` al Insight Engine real, evaluando extender su disponibilidad más allá de licencias no-trial/modo profesional si el producto lo requiere para Básico.

### Iteración 7 — Limpieza de pantallas identificadas en la auditoría

- `IncomeDetailPage`, `IncomePendingReportPage`, `ReportPreviewPage`, flujo de 3 pantallas de Temporadas, `BestDaysHistoryPage` — evaluar cada una individualmente contra el principio rector antes de tocarla (algunas pueden justificar quedarse igual).

## 3. Riesgos a vigilar en todas las iteraciones futuras

- Cualquier tool de escritura que se registre debe tener tests que prueben explícitamente que **no** se ejecuta sin confirmación — no basta con probar el camino feliz confirmado.
- El "presupuesto"/"metas" reconstruidos (ver `17_*.md` §2) no deben presentarse al usuario como si fueran entidades reales hasta que el producto decida si vale la pena modelarlas de verdad — es un riesgo de sobre-prometer.
- Conectar 8A puede exponer, por primera vez, casos reales de denegación (`DENY`) en producción — necesita mensajes de error de cara al usuario que no se han diseñado todavía; no asumir que "nunca pasará".

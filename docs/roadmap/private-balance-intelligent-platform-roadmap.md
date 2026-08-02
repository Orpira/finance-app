# Private Balance — Roadmap de la plataforma inteligente

Ver [ADR-030](../adr/ADR-030-Intelligent-Assistant-Platform.md). Cubre las entregas 12 (roadmap de evolución) y 13 (plan de implementación por iteraciones) de la segunda iteración del rediseño. Complementa, no reemplaza, `docs/context/ROADMAP.md` (fases R1-R4, deuda técnica de automatización).

## 0. Criterio de entrada para nuevas funcionalidades

Antes de incorporar una funcionalidad a una iteración previa a la versión 1.0, debe identificarse y poder validarse su beneficio para la comprensión, la privacidad, la velocidad o la utilidad de Private Balance. Si solo incrementa superficie funcional o complejidad técnica, debe aplazarse o descartarse.

Cada propuesta de iteración debe indicar:

- el problema concreto que resuelve;
- el beneficio esperado y cómo se comprobará;
- el coste de complejidad y mantenimiento;
- por qué no puede alcanzarse el mismo beneficio simplificando una capacidad existente.

La ausencia de una respuesta convincente deja la propuesta fuera del alcance de la versión 1.0. El criterio transversal y canónico de planificación se mantiene en [ROADMAP.md](../context/ROADMAP.md).

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

### Iteración 4 — Primer Copiloto Financiero ✅ implementada (2026-08-02)

- Motor local de reglas para insights, prioridades del día, salud financiera sin puntuación, resumen natural y acciones sugeridas.
- Snapshot común sobre servicios financieros existentes, sin nuevas tablas, fórmulas ni fuentes de verdad.
- Seis consultas naturales resueltas localmente antes del proveedor, siempre con explicación.
- Memoria efímera por sesión para periodo, moneda, última consulta y categoría; no persiste prompts ni respuestas.
- Integración en Inicio y Asistente sin crear pantallas.
- Experiencia diferenciada por licencia: sandbox guiado, local y ficticio para `trial`/`demo`; conversación real para licencias completas.

Quedan para iteraciones posteriores las acciones `mark_income_reported`, `generate_report`, `create_season`/`close_season`, la entidad real de objetivos y la consolidación sobre read models trazables del Insight Engine.

### Iteración 5 — Inteligencia explicable y continuidad contextual ✅ implementada (2026-08-02)

- Seguimientos deterministas con contexto eliminable en RAM.
- Propuestas confirmables para un ingreso, PDF y objetivos.
- Entidad `financialGoals` y progreso determinista.
- Nueve read models con evidencia y trazabilidad común.
- Home limitado y Movimientos con filtros compartidos/deep links.

### Iteración 6 — Robustez y cierre de deuda

- Auditoría completa de accesibilidad (DT-003).
- Optimización medida del bundle (DT-001).
- Estrategia de Service Worker (DT-002).
- Exportación CSV unificada para ingresos y gastos.
- Validación visual ampliada en dispositivos Android.

### Iteración 7 — Limpieza de pantallas identificadas en la auditoría

- `IncomeDetailPage`, `IncomePendingReportPage`, `ReportPreviewPage`, flujo de 3 pantallas de Temporadas, `BestDaysHistoryPage` — evaluar cada una individualmente contra el principio rector antes de tocarla (algunas pueden justificar quedarse igual).

## 3. Riesgos a vigilar en todas las iteraciones futuras

- Cualquier tool de escritura que se registre debe tener tests que prueben explícitamente que **no** se ejecuta sin confirmación — no basta con probar el camino feliz confirmado.
- El "presupuesto"/"metas" reconstruidos (ver `17_*.md` §2) no deben presentarse al usuario como si fueran entidades reales hasta que el producto decida si vale la pena modelarlas de verdad — es un riesgo de sobre-prometer.
- Conectar 8A puede exponer, por primera vez, casos reales de denegación (`DENY`) en producción — necesita mensajes de error de cara al usuario que no se han diseñado todavía; no asumir que "nunca pasará".

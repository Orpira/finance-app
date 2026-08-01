# ADR-030 - Intelligent Assistant Platform (segunda iteración del rediseño)

Estado: Proposed
Version: 1.0
Fecha: 2026-08-01
Relacionado: ADR-029, ADR-010 a ADR-028, `docs/26_AI_FOUNDATION_PRIVACY_BOUNDARY.md`

Este ADR es solo de diseño. No autoriza implementación masiva; ver sección "Fuera de alcance" y `docs/roadmap/private-balance-intelligent-platform-roadmap.md` para el plan de iteraciones.

## 1) Problema

La iteración 1 (ADR-029) desacopló el núcleo de WhatsApp/Evolution/n8n y le dio al Asistente un lugar principal en la navegación. Pero el Asistente, tal como existe hoy, es una capa de **consulta** sobre el producto, no un centro de control. Para que Private Balance se sienta como "una plataforma que entiende tus finanzas" y no como "una app donde registras movimientos", hacen falta tres cosas que hoy no existen:

1. Que el asistente pueda **proponer acciones** (registrar ingreso/gasto, crear cita) y no solo responder preguntas.
2. Que el resto de la experiencia (Inicio, Movimientos, Reportes) se apoye visiblemente en los mismos motores deterministas que usa el asistente, en vez de tener cada pantalla su propia versión ad-hoc de "resumen" o "insight".
3. Que la gobernanza de privacidad ya diseñada (8A) esté realmente conectada al camino real de ejecución, no solo definida como contrato.

## 2) Hallazgo central de la auditoría

**El asistente de Private Balance es hoy 100% de solo lectura.** El registro de tipos (`AIToolPermission`) ya anticipa niveles `write`, `dangerous` y `future-confirmation-required`, pero **ninguna de las 8 tools registradas los usa** — las 8 son `read-only` (`ping`, `financial_balance`, `financial_transactions`, `financial_budget`, `financial_goals`, `financial_reports`, `financial_insights`, `knowledge_search`). No existe una sola tool de escritura. Toda mutación real (crear ingreso, gasto, cita, marcar como reportado) ocurre exclusivamente desde formularios React, fuera del pipeline de IA.

Esto significa que el flujo "usuario escribe → IA interpreta → propuesta → confirmación → motor financiero valida → guardado", descrito tanto en el encargo de la iteración 1 como en este, **no existe todavía en ningún punto del código**. Es la brecha arquitectónica más importante de esta segunda iteración y el objetivo principal de la fase de implementación que sigue a este ADR.

Segundo hallazgo relevante: la frontera de privacidad de IA (`docs/26_AI_FOUNDATION_PRIVACY_BOUNDARY.md`, Milestone 8A) es un diseño maduro (default-deny, clasificación de datos, propósitos permitidos/prohibidos, consentimiento versionado) pero **no está conectada al pipeline real** (`aiExecutionPipeline.ts` no la invoca en ningún punto; no hay ninguna referencia a `AIPrivacyBoundary` fuera de su propia carpeta `ai-foundation`). El propio documento 8A lo advierte ("8A no implementa ejecución de IA ni transporte de red"), pero el efecto práctico hoy es que la frontera existe en el tipo de sistema sin ejercer ningún control real sobre lo que efectivamente se envía a un proveedor externo.

Tercer hallazgo: ya existe un **Insight Engine** determinista, tipado y en producción real (`/dashboard`, detrás de `UsageModeGuard(professional)` + `LicenseTypeGuard(no-trial)`) que genera observaciones (`docs/14_INSIGHT_ENGINE_ARCHITECTURE.md` a `docs/25_INSIGHT_DASHBOARD_INTEGRATION.md`). El "resumen inteligente" que se añadió a Inicio en la iteración 1 (`buildSmartInsights` en `HomePage.tsx`) es una versión ad-hoc y más simple de exactamente lo mismo, escrita porque en ese momento no se conocía el motor real. Es una duplicación identificada que se corrige en esta iteración de diseño (ver sección 6).

## 3) Decisión de visión

Private Balance adopta el modelo:

> **La IA interpreta. El motor financiero decide.**

Concretamente:

- El asistente conversacional puede iniciar cualquier acción financiera o de agenda, pero **nunca la ejecuta directamente**: genera una propuesta estructurada y tipada que pasa por el mismo motor de validación que usan los formularios (`incomeService`, `expenseService`, `appointmentService`), y solo se persiste tras confirmación explícita del usuario.
- Todo número que el usuario vea como "oficial" (balance, ganancia, variación, presupuesto) sigue viniendo exclusivamente de servicios deterministas ya existentes o del Insight Engine — nunca de una inferencia del modelo de lenguaje.

### Principio rector permanente (identidad de producto)

> Antes de implementar cualquier nueva funcionalidad, pregúntate si puede resolverse mejor mediante inteligencia, simplificación o automatización. Si la respuesta es sí, prioriza esa solución antes de añadir nuevos formularios, pantallas o configuraciones.

Este principio no es específico de esta iteración: se adopta como criterio permanente de diseño de producto para Private Balance, con la misma jerarquía que "privacidad por defecto" o "cálculos deterministas" en `docs/00_PROJECT_VISION.md`. En la práctica significa:

- Ante cualquier propuesta de una pantalla, un paso de formulario adicional o una nueva opción de configuración, la primera pregunta de diseño es si el Asistente ya puede resolverlo en una frase, si un valor puede inferirse/precargarse en vez de pedirse, o si un proceso de varios pasos puede colapsarse en uno.
- Es la razón por la que esta iteración prioriza dar al Asistente capacidad de **acción** (§2) y por la que el mapa funcional (`docs/product/private-balance-intelligent-platform-vision.md`) señala explícitamente qué pantallas existentes son candidatas a simplificarse o resolverse conversacionalmente en vez de añadir una interfaz nueva.
- Aplica también en sentido contrario: si una funcionalidad nueva solo puede justificarse añadiendo una pantalla/formulario/config, debe demostrarse primero que la vía de IA/simplificación/automatización no es superior, no asumirse que la pantalla es el camino por defecto.
- La frontera de privacidad 8A deja de ser un contrato sin conectar: se convierte en el punto de paso obligatorio entre el Context Builder y el Provider Adapter para cualquier dato que salga hacia un proveedor externo.

## 4) Decisiones de arquitectura (resumen — detalle en los documentos vinculados)

Ver:

- `docs/product/private-balance-intelligent-platform-vision.md` — evaluación de producto y mapa funcional.
- `docs/product/assistant-conversational-model.md` — mapa conversacional, tipos de interacción, parser, flujos y wireframes conceptuales.
- `docs/architecture/17_INTELLIGENT_ASSISTANT_DEFINITIVE_ARCHITECTURE.md` — arquitectura definitiva, servicios recomendados, modelo de IA y modelo determinista, diseño de las tools de acción.
- `docs/architecture/18_AI_MEMORY_AND_PRIVACY_MODEL.md` — evaluación y extensión del modelo de memoria (ADR-026) y de la frontera de privacidad (8A).
- `docs/roadmap/private-balance-intelligent-platform-roadmap.md` — evolución (IA local/cloud, multi-proveedor, agentes) y plan de implementación por iteraciones.

## 5) Alternativas consideradas

1. **Dejar el asistente solo de consulta y mover el foco de "inteligencia" a mejorar el Insight Engine existente.** Descartado como decisión única: cumple parte de la visión pero no la frase central del encargo ("registrar ingresos/gastos/citas mediante lenguaje natural"), que requiere tools de escritura.
2. **Dar a las tools de IA acceso directo a los servicios de escritura (`createServiceIncome`, etc.) sin capa de confirmación.** Descartado explícitamente: viola la regla no negociable "la IA nunca modifica datos sin confirmación" (repetida en ambos encargos) y el principio Default Deny de 8A.
3. **Reescribir el Insight Engine para que el LLM genere las observaciones.** Descartado: el Insight Engine actual es determinista y auditable por diseño (severidad, confianza, evidencia trazable); sustituirlo por generación libre del modelo sería un retroceso de calidad y de privacidad, no una mejora.

## 6) Consecuencia inmediata identificada (para corregir en implementación, no en este ADR)

`HomePage.tsx` debería eventualmente consumir el Insight Engine real en lugar de su función local `buildSmartInsights`, una vez que el motor esté disponible fuera de la ruta `professional`+`no-trial` (hoy estos insights de Home deben verse en Básico también, y el Insight Engine actual está gateado a Profesional). Esto se registra como parte del roadmap, no se implementa en esta iteración de diseño.

## 7) Fuera de alcance de esta iteración

- Implementar cualquier tool de escritura o el flujo de confirmación real.
- Conectar 8A al pipeline real.
- Migrar `HomePage` al Insight Engine real.
- Cualquier cambio a proveedores de IA, modelos o consentimiento en producción.

Esta iteración es de diseño y documentación. Las únicas implementaciones de código en esta iteración son correcciones pequeñas y seguras detectadas durante la auditoría (ver commits `2df85c7` — ocultar rutas `/debug` de producción).

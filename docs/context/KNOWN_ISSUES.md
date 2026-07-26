# Known Issues

## 1) Críticos

### KI-001: ramas de workflow sin respuesta final

- Área: n8n (`Private Balance - Nuevo Ingreso`).
- Impacto: posibles timeouts y manejo ambiguo del resultado en cliente.
- Estado: abierto.
- Mitigación temporal: fallback y control de idempotencia; no resuelve completitud de respuesta.

### KI-002: definición formal de milestone 8A no canónica

- Área: gobernanza documental.
- Impacto: ambigüedad de certificación futura.
- Estado: abierto.
- Mitigación temporal: criterio operativo documentado en handoff actual.

### KI-007: `buildFinancialDirectResponseText` solo tiene builder dedicado para 2 de las 6 Financial Tools

- Área: `src/intelligence/ai-conversation/provider-orchestration/financialDirectResponseBuilder.ts`.
- Impacto: en la rama `DIRECT_TOOL`, solo `financial_transactions` y `financial_balance` tienen lógica de respuesta específica; para `financial_insights`, `financial_reports`, `financial_goals` y `financial_budget` siempre se devuelve el texto genérico "Consulté la información financiera solicitada.", sin importar los datos reales que la tool haya encontrado (p. ej. "¿Cuál ha sido mi mejor día?" no muestra `bestDayDate`/`bestDayAmount`, aunque `financial_insights` ya los expone). Detectado en producción (PB-IS-016.2-R3, validando en vivo con el usuario) al preguntar por el mejor día registrado.
- Estado: abierto, documentado deliberadamente sin corregir por exceder el alcance de PB-IS-016.2-R3 (bug de resolución temporal, no de builders de respuesta) — decisión confirmada con el usuario.
- Mitigación temporal: ninguna; la data ya existe en las tools, falta el builder de presentación.
- Adicionalmente, el Deterministic Intent Resolver tampoco reconoce "mejor día" como disparador de `insights`/`reports` (solo "insight"/"resumen"/"tendencia" e "reporte"/"informe" respectivamente); esto importa menos en producción porque el proveedor primario (OpenAI) puede elegir la tool igualmente, pero conviene revisarlo junto con el fix de builders.
- Candidato natural: un milestone dedicado (p. ej. PB-IS-016.3) que agregue builders especializados para las 4 tools restantes, siguiendo el patrón ya certificado de `buildFinancialTransactionsDirectResponseText`/`buildFinancialBalanceDirectResponseText`.

## 2) Altos

### KI-003: coexistencia de tablas/consultas legacy en workflows

- Área: n8n SQL.
- Impacto: riesgo de deriva respecto al backend moderno.
- Estado: abierto.
- Mitigación temporal: arquitectura principal mantiene resolución moderna en server.

### KI-004: deuda de lint global en áreas fuera de hitos recientes

- Área: calidad estática.
- Impacto: fricción para gates de release completos.
- Estado: abierto.

## 3) Medios

### KI-005: estrategia de retención de snapshots/knowledge no formalizada

- Área: persistencia local.
- Impacto: crecimiento acumulativo de almacenamiento.
- Estado: abierto.

### KI-006: cobertura contractual n8n no completamente automatizada

- Área: testing de integración.
- Impacto: riesgo de regresión en cambios de workflows.
- Estado: abierto.

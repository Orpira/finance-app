# 17 Intelligent Assistant — Definitive Architecture

Ver [ADR-030](../adr/ADR-030-Intelligent-Assistant-Platform.md) (decisión), [16_CORE_AND_INTEGRATIONS.md](16_CORE_AND_INTEGRATIONS.md) (límite núcleo/integraciones), [AI_INTERACTION_ARCHITECTURE.md](AI_INTERACTION_ARCHITECTURE.md) y ADR-010 a ADR-028 (arquitectura de IA ya construida, que este documento evalúa y extiende — no reemplaza). Cubre las entregas 4 (arquitectura definitiva), 5 (servicios recomendados), 6 (modelo IA) y 7 (modelo determinista).

> **Nota de implementación (2026-08-02):** el diseño de §4 (tools de acción resueltas vía `AIToolRegistry`/`aiExecutionPipeline.ts`) partía de un supuesto que resultó incorrecto: ese pipeline no es el que usa `/conversation` en producción. La implementación real de los tres flujos de acción usa un parser determinista local en su lugar — ver [ADR-031](../adr/ADR-031-Assistant-Action-Flow-Implementation.md) y [19_ASSISTANT_ACTION_FLOW.md](19_ASSISTANT_ACTION_FLOW.md) para la arquitectura tal como quedó construida. El resto de este documento (servicios recomendados, huecos del Insight Engine, etc.) sigue vigente.

## 1. Separación de responsabilidades (ya vigente, se mantiene)

```
Interfaz            src/pages/Conversation/**
        │
Interpretación       src/intelligence/{context-builder,context-resolution,prompt-builder}
        │
Motor IA             src/intelligence/ai-provider (OpenAI real vía proxy) + ai-tools (resolución de tool-calls)
        │
Motor financiero      src/services/* (incomeService, expenseService, appointmentService, balanceReportService, ...)
        │
Persistencia         src/database/db.ts (Dexie/IndexedDB)
        │
Confirmación         (no existe hoy — diseño de esta iteración, §4)
        │
Auditoría            src/intelligence/execution-inspector (traza de cada etapa del pipeline)
```

Esta separación ya está bien trazada en el código actual para el camino de **consulta**. El trabajo de esta iteración es extenderla al camino de **acción** sin mezclar capas — en particular, sin que la interpretación (LLM) adquiera la capacidad de escribir directamente en Dexie, y sin que el motor financiero tenga que saber que una petición vino de la IA en vez de un formulario.

## 2. Servicios recomendados (evaluación de lo existente, no nombres obligatorios)

La arquitectura actual ya tiene servicios de consulta razonablemente bien separados; la recomendación no es crear una capa `financeQueryService` paralela (duplicaría lo que ya existe), sino **completar los huecos concretos** y **darles una tool de IA** a los que no la tienen:

| Servicio recomendado | Estado | Acción recomendada |
|---|---|---|
| Balance/periodo | `balanceReportService.buildBalanceReport` | Ya tiene tool (`financial_balance`). Sin cambios. |
| Transacciones/movimientos | `incomeService.listServiceIncomes` + `expenseService.listExpenses` | Ya tiene tool (`financial_transactions`). Sin cambios. |
| Ingresos sin reportar | `incomeReport.service.getPendingIncomeSummary/getPendingIncomes` | **Sin tool.** Crear `financial_unreported_income` (read-only) envolviendo este servicio ya probado — no crear lógica nueva. |
| Comparación de periodos | Reconstruido parcialmente en `financial_insights` sobre cutoffs | **Sin tool explícita ni servicio dedicado.** Crear `comparePeriods(periodA, periodB)` en `balanceReportService` (o servicio nuevo pequeño que reutilice `buildBalanceReport` dos veces) + tool `compare_periods`. |
| Mejor día/semana | `earningPeriodService.getSeasonStatistics` (campo `bestDay`) | **Sin tool.** Envolver en tool read-only `best_period` una vez decidido el alcance temporal (día/semana/mes). |
| Presupuestos/objetivos | `financial_budget`/`financial_goals` son reconstrucciones sobre cutoffs/temporadas, no entidades reales | No crear entidades nuevas en esta iteración de diseño; las respuestas del asistente deben dejar claro que "presupuesto" hoy es un cálculo derivado, no una meta que el usuario configuró — evita una promesa de producto que el dominio no cumple todavía. |
| Insight Engine real | `src/services/insightExecutionService.ts` + `insightReadModels.ts` | **No conectado al asistente.** Crear tool read-only `smart_insights` que delegue en el Insight Execution Service ya existente, en vez de que el asistente reconstruya heurísticas propias (evita la duplicación descrita en ADR-030 §2). |

Ninguna de estas adiciones requiere tocar `src/database/db.ts` ni el esquema — todas leen de servicios que ya existen.

## 3. Modelo de IA

Sin cambios de fondo respecto a lo ya construido y documentado en ADR-010 a ADR-028: proveedor OpenAI real vía proxy server-side (`api/ai-provider-openai.ts`, nunca la key en el cliente), selección de intención y extracción de parámetros delegada al modelo mediante tool-calling, degradación a "mock provider" cuando no hay proveedor configurado (`VITE_AI_PROVIDER=mock`, valor por defecto). Lo que se añade:

- **Tools de acción** con permiso `write` (o un nuevo nivel más explícito — ver §4) además de las `read-only` actuales.
- **Un puente hacia el Insight Engine real** (tool `smart_insights`, §2) para que las explicaciones del asistente sobre tendencias usen la misma fuente que `/dashboard`, no una heurística paralela.
- Preparación explícita (contratos, no implementación) para múltiples proveedores/modelos — ver roadmap.

## 4. Modelo determinista y diseño de las tools de Acción

### Por qué el modelo actual de permisos no basta tal cual

`AIToolPermission` ya define `write`, `dangerous` y `future-confirmation-required`, pero son etiquetas sin comportamiento asociado en `aiToolExecutor.ts` — hoy ejecutaría cualquier tool que encontrara, sin importar el permiso. Antes de registrar una sola tool de escritura, `aiToolExecutor` necesita una rama de comportamiento nueva:

```ts
if (tool.permission === 'read-only') {
  // comportamiento actual: ejecutar y devolver resultado al modelo
}

if (tool.permission === 'write' || tool.permission === 'dangerous') {
  // NUEVO: no ejecutar el servicio. Construir una ActionProposal
  // (tipo + campos + valores extraídos) y devolverla como resultado
  // de la tool — el modelo la usa para responder en lenguaje natural
  // ("¿confirmas registrar 120 EUR de ingreso hoy?"), pero la UI es
  // quien realmente decide cuándo se invoca el servicio de escritura,
  // solo tras la confirmación explícita del usuario en la UI.
}
```

### Contrato de `ActionProposal` (propuesto)

```ts
interface ActionProposal {
  readonly proposalId: string          // determinista, no aleatorio en el dominio 8A
  readonly kind: 'register_income' | 'register_expense' | 'create_appointment'
    | 'mark_income_reported' | 'generate_report' | 'create_season' | 'close_season'
  readonly fields: Readonly<Record<string, string | number | null>>
  readonly missingRequiredFields: readonly string[]
  readonly status: 'draft' | 'confirmed' | 'cancelled'
}
```

`missingRequiredFields` existe para que la UI resalte lo que el modelo no pudo extraer, en vez de inventar un valor — coherente con "la IA no debe inventar cantidades ni fechas".

### Validación y guardado: reutilizar el motor financiero, no envolverlo

Al confirmar, la UI llama **exactamente** al mismo servicio que llama el formulario correspondiente (`incomeService.createServiceIncome`, `expenseService.createExpense`, `appointmentService.createAppointment`, `incomeReport.service.markIncomeAsReported`). No se crea una ruta de guardado alternativa "para IA": las mismas validaciones (temporada activa, campos requeridos, reglas de `assertRecordIsNotReported`, etc.) se aplican sin excepción. Si el servicio rechaza la operación, el error real se muestra en la tarjeta de propuesta — el asistente no debe reformular ni suavizar un error de validación financiera.

### Auditoría

Cada propuesta y su resolución (confirmada/editada/cancelada) se registra en el `AIExecutionInspector` ya existente, igual que cualquier otra etapa del pipeline — sin tabla nueva, reutilizando la infraestructura de trazabilidad de ADR-024/027.

## 5. Qué NO cambia

- El esquema de Dexie no requiere migración para esta arquitectura: las tools de acción llaman a servicios existentes, no crean tablas nuevas.
- El Insight Engine (docs 14-25) no se reescribe; se le da un consumidor nuevo (la tool `smart_insights`).
- La frontera 8A no se reescribe; se conecta (ver `18_AI_MEMORY_AND_PRIVACY_MODEL.md`).

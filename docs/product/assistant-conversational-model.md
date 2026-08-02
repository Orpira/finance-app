# Asistente — modelo conversacional, flujos y wireframes conceptuales

Ver [ADR-030](../adr/ADR-030-Intelligent-Assistant-Platform.md) y [17_INTELLIGENT_ASSISTANT_DEFINITIVE_ARCHITECTURE.md](../architecture/17_INTELLIGENT_ASSISTANT_DEFINITIVE_ARCHITECTURE.md). Cubre las entregas 3 (mapa conversacional), 6 (tipos de interacción / parser), 10 (flujos) y 11 (wireframes conceptuales).

> **Estado vigente (Iteración 4, 2026-08-02):** las acciones de ingreso, gasto y cita ya están implementadas mediante parser determinista y confirmación obligatoria (ADR-031). Además, seis consultas financieras frecuentes se resuelven localmente mediante el [Copiloto Financiero Determinista](../architecture/20_DETERMINISTIC_FINANCIAL_COPILOT.md), antes del pipeline de proveedor. Las secciones históricas que describen acciones como no implementadas o recomiendan no usar parser quedan como contexto del diseño previo y no describen el runtime actual.

## 1. Catálogo de intenciones

Dos familias, con tratamiento arquitectónico distinto (ver documento de arquitectura):

### Consulta (ya implementadas como tools `read-only`, o extensión directa de ellas)

| Intención | Ejemplo | Tool/servicio real hoy |
|---|---|---|
| `query_balance` | "¿Cuánto gané esta semana?" / "¿Cuánto tengo disponible?" | `financial_balance` |
| `query_transactions` | "Muéstrame este mes" / "¿Qué gasté en transporte?" | `financial_transactions` |
| `query_unreported_income` | "¿Qué ingresos siguen sin reportarse?" | Copiloto local sobre `getPendingIncomeSummary()`; no requiere tool ni proveedor |
| `compare_periods` | "Compara este mes con el anterior" / "Compárame julio con agosto" | `financial_insights` (parcial, vía cutoffs/temporadas) — se recomienda una tool explícita `compare_periods` sobre `earningPeriodService`/`balanceReportService` |
| `query_best_period` | "¿Cuál fue mi mejor semana?" | `getSeasonStatistics` (bestDay), sin tool expuesta directamente |
| `query_budget` / `query_goals` | "¿Cómo voy con mi presupuesto?" | `financial_budget` / `financial_goals` (nota: son reconstrucciones sobre cutoffs/temporadas, no entidades reales — la respuesta del asistente debe ser honesta sobre esto, no inventar un "presupuesto" que el usuario nunca configuró) |
| `explain_report` / `explain_insight` | "Explícame esta gráfica" / "¿Por qué subió esto?" | `financial_reports` / `financial_insights`, o el futuro puente al Insight Engine real (ver arquitectura §3) |
| `knowledge_question` | Preguntas sobre cómo usar la app | `knowledge_search` (RAG documental) |

### Acción (no implementadas hoy — diseño de esta iteración)

| Intención | Ejemplo | Slots necesarios | Servicio destino (ya existente) |
|---|---|---|---|
| `register_income` | "Hoy recibí 120 euros por un servicio" | monto, moneda, fecha, categoría/tipo de pago, notas | `incomeService.createServiceIncome` |
| `register_expense` | "Gasté 35 euros en transporte" | monto, moneda, fecha, categoría | `expenseService.createExpense` |
| `create_appointment` | "Mañana tengo una cita a las 18:30" | fecha, hora, duración, monto esperado | `appointmentService.createAppointment` |
| `mark_income_reported` | "Marca como reportado el ingreso de ayer" | referencia del registro (fecha/monto/id) | `incomeReport.service.markIncomeAsReported` |
| `generate_report` | "Genera el reporte de julio y compártelo" | periodo, tipo de reporte | `balanceReportService` + `ReportsPage`/`ReportPreviewPage` |
| `create_season` / `close_season` | "Cierra la temporada actual" | nombre (para crear) | `earningPeriodService` |

**Todas las intenciones de Acción son propuestas, nunca ejecuciones directas** (ver §3 flujo obligatorio).

## 2. Diseño del "parser": no un parser aparte, una extensión del tool-calling existente

Private Balance ya resuelve intención mediante **tool-calling delegado al proveedor de IA** (`src/intelligence/ai-tools`, `aiExecutionPipeline.ts`), no mediante un parser de reglas propio. Esto es correcto y escalable: añadir un parser de intents en paralelo duplicaría lo que el modelo ya hace mejor. La recomendación de este documento es **no crear un parser nuevo**, sino:

1. Registrar nuevas tools de acción en `AIToolRegistry` con `permission: 'write'` (o el nuevo nivel específico descrito en la arquitectura) y un JSON Schema de parámetros estricto (monto como número positivo, fecha ISO, moneda de un catálogo cerrado, etc.).
2. Dejar que el modelo elija la tool y extraiga los parámetros exactamente como ya hace con `financial_balance`/`financial_transactions`.
3. El `aiToolExecutor` distingue por `permission`: las `read-only` se ejecutan y su resultado vuelve al modelo (comportamiento actual, sin cambios); las de escritura **no se ejecutan** — se transforman en una `ActionProposal` tipada que la UI muestra para confirmación (ver arquitectura §4).

Esto escala a intenciones nuevas simplemente añadiendo tools, sin tocar el pipeline de interpretación.

## 3. Flujo obligatorio para toda intención de Acción

```
Usuario escribe en lenguaje natural
        │
        ▼
El modelo interpreta y elige una tool de Acción con sus parámetros
        │
        ▼
aiToolExecutor detecta permission=write → NO ejecuta el servicio
        │
        ▼
Se construye una ActionProposal tipada (tipo, campos, valores extraídos)
        │
        ▼
La UI muestra una tarjeta de propuesta editable (AssistantProposalCard)
        │
        ▼
Usuario: Confirmar · Editar · Cancelar
        │
        ├─ Cancelar ──────────────────────────────► fin, nada se guarda
        │
        ├─ Editar ──► usuario corrige campos ──► vuelve a "Usuario confirma"
        │
        └─ Confirmar
                │
                ▼
        Se invoca el MISMO servicio de dominio que usa el formulario
        (incomeService.createServiceIncome, etc.) — motor determinista,
        con las mismas validaciones (temporada activa, campos requeridos,
        reglas de reporte) que ya aplican hoy a los formularios
                │
                ├─ Falla validación ──► se muestra el error real del
                │                        servicio, la propuesta vuelve
                │                        a estado editable
                │
                └─ Éxito ──► persistencia (Dexie) ──► respuesta del
                             asistente en lenguaje natural confirmando
                             qué se guardó, con enlace al registro
```

Ninguna rama de este flujo permite persistencia sin paso explícito por "Confirmar". No existe una variante "guardar automáticamente si la confianza es alta": está descartada por regla de producto (no negociable, presente en ambos encargos de esta reestructuración).

## 4. Ejemplo de propuesta (tarjeta de confirmación)

```
┌─────────────────────────────────────────┐
│  Propuesta: registrar ingreso            │
│                                           │
│  Importe        120,00 EUR               │
│  Fecha          hoy (01/08/2026)         │
│  Categoría      Servicio                 │
│  Estado fiscal  Sin reportar             │
│                                           │
│  [ Editar ]   [ Cancelar ]   [ Confirmar]│
└─────────────────────────────────────────┘
```

Si falta un dato imprescindible (p. ej. el usuario no dio moneda y hay más de una configurada), la propuesta se muestra con ese campo vacío y resaltado, nunca con un valor inventado — coherente con la regla "la IA no debe inventar cantidades ni fechas".

## 5. Wireframes conceptuales (baja fidelidad, texto)

### Pantalla Asistente (estado con historial)

```
┌─────────────────────────────────────────┐
│ ← Inicio        Asistente                │
├─────────────────────────────────────────┤
│  Puedes escribir en lenguaje natural:    │
│  ingresos, gastos, citas o consultas.    │
│                                           │
│  ┌───────────────────────────────────┐  │
│  │ Tú: Hoy recibí 120 euros por      │  │
│  │ un servicio                        │  │
│  └───────────────────────────────────┘  │
│                                           │
│  ┌───────────────────────────────────┐  │
│  │ Asistente:                         │  │
│  │ [ tarjeta de propuesta, §4 ]        │  │
│  └───────────────────────────────────┘  │
│                                           │
│  (⋯ historial arriba, scroll)            │
├─────────────────────────────────────────┤
│ [Registrar ingreso] [Registrar gasto]    │
│ [Crear cita] [Ver resumen semanal] →     │
├─────────────────────────────────────────┤
│  Mensaje                                 │
│  ┌───────────────────────────────────┐  │
│  │                                     │  │
│  └───────────────────────────────────┘  │
│                          [ Enviar ]      │
│  El asistente propone; tú confirmas.     │
└─────────────────────────────────────────┘
```

### Inicio con "resumen inteligente" ya conectado al motor real (evolución de la iteración 1)

```
┌─────────────────────────────────────────┐
│ Private Balance          [•] ocultar     │
│ Inicio · lunes 3 de agosto                │
├─────────────────────────────────────────┤
│ Ingresos      Egresos      Balance       │
│ €1.240        €430         €810          │
│ +12% ▲        -4% ▼        +18% ▲        │
├─────────────────────────────────────────┤
│ 💡 Resumen inteligente (Insight Engine)  │
│ • Tus gastos en transporte crecieron 22% │
│ • Tienes 3 ingresos sin reportar         │
├─────────────────────────────────────────┤
│ [+ Ingreso] [+ Gasto] [+ Cita] [Asistente]│
├─────────────────────────────────────────┤
│ Agenda próxima          Actividad reciente│
│ · Mañana 18:30 — €80    · Servicio €120  │
└─────────────────────────────────────────┘
```

## 6. Historial y control del usuario sobre la conversación

- El historial se persiste localmente (ya implementado, ADR-026) y es editable/borrable desde la propia pantalla del Asistente (acción "Borrar conversación", pendiente de implementar — ver roadmap).
- Cada mensaje del asistente que involucre datos financieros reales debe indicar de dónde salió el número (servicio/tool), nunca presentarlo como una afirmación sin fuente — esto ya es coherente con el diseño del Insight Engine (evidencia trazable) y debe extenderse a las respuestas conversacionales.

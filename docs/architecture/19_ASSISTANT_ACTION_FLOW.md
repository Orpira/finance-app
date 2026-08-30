# 19 Assistant Action Flow — Proposal, Confirmation, Execution, Privacy

Ver [ADR-031](../adr/ADR-031-Assistant-Action-Flow-Implementation.md) (por qué se implementó así) y [ADR-030](../adr/ADR-030-Intelligent-Assistant-Platform.md) (visión). Este documento describe la arquitectura **tal como quedó implementada**, en `src/intelligence/assistant/`.

Para cuándo un insight detectado por el Copiloto puede convertirse en una notificación proactiva (fuera del flujo conversacional descrito aquí), ver [ADR-034](../adr/ADR-034-Copilot-Proactive-Notifications.md) y su implementación Fase 1 en `src/notifications/`.

## 1. Arquitectura del flujo conversacional

```
Usuario escribe en ConversationPage
        │
        ▼
conversationController.sendMessage(text)
        │
        ▼
resolveInterpretation() ── si no hay getAssistantContext, o falla ──► camino de consulta existente (sin cambios)
        │
        ▼ (dependencies.getAssistantContext() → { defaultCurrency, usageMode })
interpretAssistantMessage(text, context)          [assistantConfirmationFlow.ts]
        │
        ├─ parseAssistantIntent(text)              [assistantIntentParser.ts — determinista, local]
        │       │
        │       ├─ kind: 'none' ──────────────────────────► camino de consulta existente (sin cambios)
        │       │
        │       └─ kind: 'register_income' | 'register_expense' | 'create_appointment'
        │               │
        │               ▼
        ├─ buildAssistantPrivacyContext() + AIPrivacyBoundary.authorize()   [assistantPrivacyContext.ts]
        │       │
        │       ├─ denegado ──────────────────────► mensaje de error de privacidad (nunca envía igual)
        │       │
        │       └─ autorizado
        │               ▼
        └─ createProposalFromParsedIntent()        [assistantProposalFactory.ts]
                        │
                        ▼
        mensaje ASSISTANT con `proposal` adjunto → AssistantProposalCard (Proposal Editor + Confirmar/Cancelar)
                        │
        ┌───────────────┼────────────────┐
        ▼               ▼                ▼
   Cancelar        Editar campos     Confirmar
        │               │                │
        ▼               │                ▼
cancelProposal()    (permanece         confirmProposal()
   registra          editable            │
   auditoría         hasta que           ▼
  'cancelled'        no falten     assertProposalReadyForExecution()  [assistantExecutionGuard.ts]
                      campos)            │
                                          ├─ rechaza (no confirmada / incompleta / inválida)
                                          │
                                          └─ ok
                                              ▼
                                   executeAssistantProposal()          [assistantExecutionService.ts]
                                              │
                                    incomeService / expenseService / appointmentService (servicios reales)
                                              │
                                    ├─ éxito ──► proposal.status='completed', mensaje de confirmación
                                    └─ error ──► proposal.status='failed', mensaje con el error real
                                              │
                                              ▼
                                    recordAssistantAudit()             [assistantAuditLog.ts]
```

Nunca hay una rama que persista datos sin pasar por `confirmProposal()` → `assertProposalReadyForExecution()` → el servicio de dominio real.

## 2. Arquitectura Proposal (`assistantProposalContracts.ts`, `assistantProposalFactory.ts`)

Máquina de estados:

```
draft → awaiting_confirmation → confirmed → executing → completed
                    ↑                              ↘
                    └── (edición) ──────────────     failed
                    │
                    └──────────────────────────► cancelled
```

- `draft`/`awaiting_confirmation` son estados editables (`isProposalReadyToConfirm`/`isFieldEditable`).
- `confirmed`/`executing` solo existen entre el clic en "Confirmar" y la respuesta del servicio real — nunca se persisten, son transitorios dentro de una misma llamada.
- `completed`/`cancelled`/`failed` son terminales.

Tres tipos de propuesta, cada uno con sus propios campos requeridos (`IncomeProposalFields`, `ExpenseProposalFields`, `AppointmentProposalFields`). **Ningún campo requerido ausente se completa nunca con un valor inventado**: `createProposalFromParsedIntent` deja el campo en `null` y lo añade a `missingRequiredFields`; el Proposal Editor lo resalta en rojo con un asterisco.

## 3. Arquitectura Confirmation (`assistantConfirmationFlow.ts`, `AssistantProposalCard.tsx`, `conversationController.ts`)

- `interpretAssistantMessage()` es el único punto de entrada: conecta intents → privacidad → propuesta.
- `AssistantProposalCard` es el Proposal Editor: mantiene un borrador local (`draft`) por campo. El botón "Confirmar" permanece deshabilitado mientras algún campo requerido siga vacío y solo llama a `onConfirm(draft)` después de que el usuario complete la propuesta — nunca automáticamente.
- `conversationController.confirmProposal({messageId, edits})`:
  1. Aplica ediciones (`applyProposalEdits`), recalculando `missingRequiredFields`.
  2. Si siguen faltando campos, **no ejecuta nada** — el mensaje se actualiza con el estado incompleto para que el usuario complete y vuelva a confirmar.
  3. Si está completa, marca `confirmed` → `executing` y llama a `executeAssistantProposal`.
- `conversationController.cancelProposal({messageId})` marca `cancelled` y registra auditoría — nunca toca un servicio de dominio.

## 4. Arquitectura Execution (`assistantExecutionGuard.ts`, `assistantExecutionService.ts`)

El Execution Guard (`assertProposalReadyForExecution`) es la última barrera antes de cualquier servicio de dominio. Rechaza:

- una propuesta cuyo `status` no sea exactamente `'confirmed'` (`NOT_CONFIRMED`);
- una propuesta con `missingRequiredFields` no vacío (`MISSING_REQUIRED_FIELDS`);
- un importe ≤ 0 o no numérico (`INVALID_AMOUNT`);
- una fecha u hora con formato inválido (`INVALID_DATE`/`INVALID_TIME`).

El Execution Service **reutiliza exactamente los mismos servicios que los formularios**:

| Propuesta | Servicio real invocado | Reutiliza (no reimplementa) |
|---|---|---|
| `register_income` | `incomeService.createServiceIncome` (`type:'otro'`) | `currencyConversionService.convertCurrencyToEurCop`, `utils/realGain.calculateStoredRealGain` |
| `register_expense` | `expenseService.createExpense` (`type:'gasto'`) | `currencyConversionService.convertCurrencyToEurCop` |
| `create_appointment` | `appointmentService.createAppointment` | — |

Ninguna de estas llamadas es un servicio nuevo "para IA": son las mismas funciones, con las mismas reglas de negocio (temporada activa, ajustes, etc.) que ya aplican a `IncomePage`/`ExpensesPage`/`AppointmentFormPage`. Si el servicio real rechaza la operación (p. ej. "No hay una temporada activa"), ese es el mensaje que ve el usuario — el Execution Service no lo reformula.

`register_income` usa `type: 'otro'` ("otro ingreso histórico") deliberadamente, no `type: 'ingreso'` (servicio con duración/porcentaje): el Asistente no tiene forma de inferir duración o porcentaje de comisión de una frase, y `createServiceIncome` ya fuerza `percentage: 0` para cualquier tipo distinto de `'ingreso'`, así que `realGain` se calcula correctamente como el importe total.

## 5. Arquitectura Privacy (`assistantPrivacyContext.ts`, `assistantPrivacyInspector.ts`)

Conecta el Milestone 8A (`AIPrivacyBoundary`, ya existente pero no usado por ningún consumidor real hasta ahora — ver ADR-031) **honestamente acotado a este flujo**:

- El Context Builder (`buildAssistantPrivacyContext`) entrega solo `{ currency, usageMode, periodLabel }` — nunca un ingreso, gasto o cita concreto.
- Como la interpretación de estos tres intents es 100% local (§1), la autorización siempre se pide en modo `LOCAL_ONLY`, propósito `CLASSIFY_USER_QUERY` — no hay ningún proveedor externo al que autorizar en este flujo.
- `AIPrivacyBoundary.authorize()` (el mismo módulo de 8A, sin modificar) valida la petición contra la política por defecto y devuelve un resultado `authorized`/`rejected`, fail-closed.
- El Privacy Inspector (`recordPrivacyAuthorization`) registra, por cada interpretación de un mensaje de acción: marca de tiempo, decisión, modo de procesamiento, categorías de datos incluidas y excluidas — **nunca el texto del usuario ni valores financieros**.

**Explícitamente fuera de alcance de esta iteración**: conectar 8A al camino de *consulta* (el que sí puede llamar a OpenAI cuando `VITE_AI_PROVIDER=openai`). Ese modo (`EXTERNAL_PROVIDER`) exige un `AIConsentRecord` real por política (`consentRequired: true`), y el producto no tiene todavía una forma de que el usuario otorgue ese consentimiento — construir esa UI de consentimiento es un requisito previo, documentado como próxima iteración en `docs/roadmap/private-balance-intelligent-platform-roadmap.md`.

## 6. Auditoría (`assistantAuditLog.ts`)

Cada transición terminal (`completed`/`failed`/`cancelled`) registra: `timestamp`, `proposalId`, `kind`, `status`, `executedRecordId` (si tuvo éxito) o `failureCode` — nunca importes, fechas de la operación, categorías ni el texto original del usuario. En memoria (ring buffer de 200 entradas), no en Dexie: no requiere migración de esquema y su vida útil natural es la sesión de la aplicación.

## 7. Catálogo de patrones reconocidos y evolución futura

`assistantIntentParser.ts` reconoce frases con un verbo de acción (recibí/cobré/ingresé/gané → ingreso; gasté/pagué/compré → gasto; cita/agenda/reunión/turno → cita) y órdenes explícitas de creación (`registrar`/`agregar`/`añadir`/`anotar`/`crear`/`nuevo` + ingreso o gasto). Cuando están presentes, extrae importe, moneda (símbolo `€ $ £`, código ISO o palabra), fecha (hoy/ayer/mañana/ISO/DD-MM-AAAA) y hora (para citas). Si una orden no incluye importe o categoría obligatoria, conserva `null` y la propuesta marca el campo como pendiente; nunca inventa un valor. Un signo de interrogación desactiva la detección de acción (se trata como consulta). Cualquier frase que no calce cae, sin error visible, al camino de consulta existente.

Las seis sugerencias rápidas de `MessageComposer` siguen enviando texto al mismo controlador, sin una API paralela. Las órdenes de ingreso, gasto y cita se resuelven en esta capa de acciones; `Ver resumen semanal`, `Ingresos sin reportar` y `Comparar este mes con el anterior` se resuelven antes del proveedor mediante el Copiloto financiero local. El resumen usa la semana actual (lunes hasta hoy) y la comparación mensual presenta ingresos, gastos y balance del mes actual frente al inmediatamente anterior. Ninguna de estas sugerencias depende del fallback del proveedor.

La paridad completa del registro Profesional mediante Copiloto permanece fuera de alcance: `register_income` conserva el alta conservadora de `type: 'otro'`, duración y porcentaje cero descrita en §4. Duración, tarifa, método de cálculo y tipo de servicio deberán abordarse en una evolución posterior explícita.

La certificación funcional de este flujo en la PWA/web real, incluida la matriz de Quick Actions, persistencia controlada, consola y trazabilidad de red, está registrada en [`../product/COPILOT_QUICK_ACTIONS_UI_VALIDATION.md`](../product/COPILOT_QUICK_ACTIONS_UI_VALIDATION.md). El resultado fue **VALIDACIÓN UI APROBADA** sobre el commit `b300f89fb9664a746dad3cc1ae2530b7b2d520be`.

Recomendación para una futura iteración (no implementada aquí): si el parser determinista no reconoce nada Y hay un proveedor de IA externo configurado con consentimiento otorgado, se podría ofrecer una segunda pasada vía LLM como *fallback* — nunca como reemplazo del parser determinista para los patrones que ya cubre, y siempre pasando por el mismo Execution Guard antes de persistir cualquier cosa.

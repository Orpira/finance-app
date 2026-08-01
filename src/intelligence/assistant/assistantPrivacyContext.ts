import type {
  AIPrivacyAuthorizationRequest,
  AIPrivacyTraceabilityInput,
} from '../ai-foundation/aiFoundationContracts'
import { createDefaultAIPrivacyPolicy } from '../ai-foundation/aiPrivacyPolicy'
import type { CurrencyCode, UsageMode } from '../../types/settings'

/**
 * Context Builder del Asistente (objetivo 9): entrega únicamente periodo,
 * moneda y preferencias — nunca ingresos, gastos, citas ni ningún dato de
 * dominio financiero materializado. El flujo de acción (registrar
 * ingreso/gasto/crear cita) interpreta el mensaje de forma 100% local
 * (assistantIntentParser.ts) y jamás llama a un proveedor de IA externo,
 * así que este contexto siempre se autoriza en modo LOCAL_ONLY: no hay
 * envío de datos a ningún tercero que autorizar. Conectar la frontera para
 * el camino de consulta (que sí puede usar OpenAI) queda documentado como
 * trabajo pendiente en docs/architecture/18_AI_MEMORY_AND_PRIVACY_MODEL.md.
 */
export interface AssistantPrivacyContext {
  readonly currency: CurrencyCode
  readonly usageMode: UsageMode
  readonly periodLabel: 'current-month'
}

export function buildAssistantPrivacyContext(input: {
  readonly currency: CurrencyCode
  readonly usageMode: UsageMode
}): AssistantPrivacyContext {
  return {
    currency: input.currency,
    usageMode: input.usageMode,
    periodLabel: 'current-month',
  }
}

function traceabilityFor(requestId: string): AIPrivacyTraceabilityInput {
  const policy = createDefaultAIPrivacyPolicy()
  return {
    traceId: `trace:${requestId}`,
    relationId: `relation:${requestId}`,
    requestId,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    consentId: null,
    purpose: 'CLASSIFY_USER_QUERY',
    processingMode: 'LOCAL_ONLY',
    dataCategories: ['APP_METADATA'],
  }
}

export function buildAssistantPrivacyAuthorizationRequest(
  context: AssistantPrivacyContext,
  input: { readonly requestId: string },
): AIPrivacyAuthorizationRequest {
  return {
    requestId: input.requestId,
    protocolVersion: 1,
    purpose: 'CLASSIFY_USER_QUERY',
    processingMode: 'LOCAL_ONLY',
    dataReferences: [
      {
        referenceId: `${input.requestId}:currency`,
        category: 'APP_METADATA',
        classification: 'PERSONAL',
        selector: 'assistant.context.currency',
        metadata: { currency: context.currency },
      },
      {
        referenceId: `${input.requestId}:period`,
        category: 'APP_METADATA',
        classification: 'PERSONAL',
        selector: 'assistant.context.period',
        metadata: { periodLabel: context.periodLabel },
      },
    ],
    policy: createDefaultAIPrivacyPolicy(),
    retention: 'PROHIBITED',
    training: 'PROHIBITED',
    logging: 'NONE',
    minimization: {
      applied: true,
      strategyCodes: ['min.strategy.assistant.period-and-currency-only'],
    },
    redaction: {
      applied: true,
      strategyCodes: ['redact.strategy.no-financial-values'],
    },
    traceability: traceabilityFor(input.requestId),
    contextBuilderConstraints: [
      {
        code: 'ctx.assistant.local-only-action-flow',
        requirement: 'El flujo de propuestas del Asistente no envía datos a un proveedor externo.',
      },
    ],
  }
}

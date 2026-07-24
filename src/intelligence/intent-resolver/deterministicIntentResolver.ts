import {
  INTENT_RESOLVER_PROTOCOL_VERSION,
  type IntentResolutionDetectedIntent,
  type IntentResolutionRequest,
  type IntentResolutionResult,
  type IntentResolver,
  type IntentResolverResolveResult,
  type IntentResolutionToolSelection,
} from './intentResolverContracts'
import {
  validateIntentResolutionRequest,
  validateIntentResolutionResult,
} from './intentResolverValidator'

export const DETERMINISTIC_INTENT_RESOLVER_PROVIDER = 'DETERMINISTIC_RULES_V1' as const

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
}

function resolveFromMessage(message: string): {
  readonly detectedIntent: IntentResolutionDetectedIntent
  readonly confidence: number
  readonly tool: IntentResolutionToolSelection
  readonly reasoning: string
} {
  const normalized = normalizeText(message)

  if (
    normalized.includes('transaccion')
    || normalized.includes('movimiento')
    || normalized.includes('ingreso')
    || normalized.includes('egreso')
    || normalized.includes('gasto')
  ) {
    return {
      detectedIntent: 'transactions',
      confidence: 0.8,
      tool: {
        toolId: 'financial_transactions',
        arguments: {},
      },
      reasoning: 'Matched deterministic transaction keywords.',
    }
  }

  if (normalized.includes('presupuesto') || normalized.includes('budget')) {
    return {
      detectedIntent: 'budget',
      confidence: 0.8,
      tool: {
        toolId: 'financial_budget',
        arguments: {},
      },
      reasoning: 'Matched deterministic budget keywords.',
    }
  }

  if (normalized.includes('objetivo') || normalized.includes('meta')) {
    return {
      detectedIntent: 'goals',
      confidence: 0.8,
      tool: {
        toolId: 'financial_goals',
        arguments: {},
      },
      reasoning: 'Matched deterministic goals keywords.',
    }
  }

  if (normalized.includes('reporte') || normalized.includes('informe')) {
    return {
      detectedIntent: 'reports',
      confidence: 0.8,
      tool: {
        toolId: 'financial_reports',
        arguments: {
          format: 'json',
        },
      },
      reasoning: 'Matched deterministic reports keywords.',
    }
  }

  if (
    normalized.includes('insight')
    || normalized.includes('resumen')
    || normalized.includes('tendencia')
  ) {
    return {
      detectedIntent: 'insights',
      confidence: 0.8,
      tool: {
        toolId: 'financial_insights',
        arguments: {
          format: 'json',
        },
      },
      reasoning: 'Matched deterministic insights keywords.',
    }
  }

  if (normalized.includes('balance')) {
    return {
      detectedIntent: 'balance',
      confidence: 0.8,
      tool: {
        toolId: 'financial_balance',
        arguments: {},
      },
      reasoning: 'Matched deterministic balance keywords.',
    }
  }

  return {
    detectedIntent: 'unknown',
    confidence: 0.3,
    tool: {
      toolId: 'financial_balance',
      arguments: {},
    },
    reasoning: 'No deterministic keyword matched, fallback to balance tool.',
  }
}

export interface CreateDeterministicIntentResolverInput {
  readonly now?: () => string
}

export function createDeterministicIntentResolver(
  input: CreateDeterministicIntentResolverInput = {},
): IntentResolver {
  const now = input.now ?? (() => new Date().toISOString())

  return {
    async resolve(request: IntentResolutionRequest): Promise<IntentResolverResolveResult> {
      const requestValidation = validateIntentResolutionRequest(request)
      if (requestValidation !== null) {
        return requestValidation
      }

      const match = resolveFromMessage(request.metadata.userMessage)
      const resolution: IntentResolutionResult = {
        protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
        detectedIntent: match.detectedIntent,
        confidence: match.confidence,
        tools: [
          {
            toolId: match.tool.toolId,
            arguments: structuredClone(match.tool.arguments),
          },
        ],
        reasoning: match.reasoning,
        provider: DETERMINISTIC_INTENT_RESOLVER_PROVIDER,
        timestamp: now(),
      }

      const resultValidation = validateIntentResolutionResult(resolution)
      if (resultValidation !== null) {
        return resultValidation
      }

      return {
        kind: 'success',
        resolution,
      }
    },
  }
}

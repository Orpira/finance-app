import type {
  LLMRequest,
  LLMResponse,
} from './llmAdapterContracts'

interface MockResponseCatalogEntry {
  readonly responseCode: string
  readonly summaryCode: string
  readonly outputTokenCost: number
  readonly output: Readonly<Record<string, string | number | boolean | null>>
}

export interface MockLLMResponseFactory {
  createResponse(request: LLMRequest): LLMResponse
}

export interface CreateMockLLMResponseFactoryInput {
  readonly catalog?: Readonly<Record<string, MockResponseCatalogEntry>>
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry)) as T
  }

  const cloned: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    cloned[key] = deepClone(entry)
  }

  return cloned as T
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry)
    }
    return Object.freeze(value)
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry)
  }

  return Object.freeze(value)
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (typeof value !== 'object') {
    return JSON.stringify(String(value))
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => compareStrings(left, right))

  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`
}

const DEFAULT_RESPONSE_CATALOG: Readonly<Record<string, MockResponseCatalogEntry>> = {
  'EXPLAIN_INSIGHT|LOCAL_ONLY': {
    responseCode: 'MOCK_RESPONSE_EXPLAIN_INSIGHT_LOCAL',
    summaryCode: 'mock.summary.explain-insight.local',
    outputTokenCost: 42,
    output: {
      contractState: 'validated-mock-adapter',
      guidanceCode: 'guidance.explain.insight',
      deterministic: true,
    },
  },
  'SUMMARIZE_FINANCIAL_STATE|LOCAL_ONLY': {
    responseCode: 'MOCK_RESPONSE_SUMMARIZE_STATE_LOCAL',
    summaryCode: 'mock.summary.financial-state.local',
    outputTokenCost: 38,
    output: {
      contractState: 'validated-mock-adapter',
      guidanceCode: 'guidance.summarize.financial-state',
      deterministic: true,
    },
  },
  'EDUCATIONAL_GUIDANCE|LOCAL_ONLY': {
    responseCode: 'MOCK_RESPONSE_EDUCATIONAL_GUIDANCE_LOCAL',
    summaryCode: 'mock.summary.educational-guidance.local',
    outputTokenCost: 34,
    output: {
      contractState: 'validated-mock-adapter',
      guidanceCode: 'guidance.educational.local',
      deterministic: true,
    },
  },
  'GENERATE_ACTION_OPTIONS|LOCAL_ONLY': {
    responseCode: 'MOCK_RESPONSE_ACTION_OPTIONS_LOCAL',
    summaryCode: 'mock.summary.action-options.local',
    outputTokenCost: 36,
    output: {
      contractState: 'validated-mock-adapter',
      guidanceCode: 'guidance.action-options.local',
      deterministic: true,
    },
  },
  'CLASSIFY_USER_QUERY|LOCAL_ONLY': {
    responseCode: 'MOCK_RESPONSE_CLASSIFY_QUERY_LOCAL',
    summaryCode: 'mock.summary.classify-query.local',
    outputTokenCost: 24,
    output: {
      contractState: 'validated-mock-adapter',
      guidanceCode: 'guidance.classify-query.local',
      deterministic: true,
    },
  },
  'DIAGNOSTIC_ANALYSIS|LOCAL_ONLY': {
    responseCode: 'MOCK_RESPONSE_DIAGNOSTIC_ANALYSIS_LOCAL',
    summaryCode: 'mock.summary.diagnostic-analysis.local',
    outputTokenCost: 28,
    output: {
      contractState: 'validated-mock-adapter',
      guidanceCode: 'guidance.diagnostic-analysis.local',
      deterministic: true,
    },
  },
}

function resolveCatalogEntry(
  catalog: Readonly<Record<string, MockResponseCatalogEntry>>,
  request: LLMRequest,
): MockResponseCatalogEntry {
  const key = `${request.contextPackage.purpose}|${request.executionMode}`
  const entry = catalog[key]

  if (entry !== undefined) {
    return entry
  }

  return {
    responseCode: 'MOCK_RESPONSE_DEFAULT',
    summaryCode: 'mock.summary.default',
    outputTokenCost: 20,
    output: {
      contractState: 'validated-mock-adapter',
      guidanceCode: 'guidance.default',
      deterministic: true,
    },
  }
}

function deriveTokenUsage(request: LLMRequest, outputTokenCost: number): {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
} {
  const serializedContext = stableStringify(request.contextPackage)
  const inputTokens = Math.min(
    request.tokenBudget.inputTokenLimit,
    serializedContext.length,
  )

  const outputBudgetCeiling = Math.max(
    0,
    request.tokenBudget.outputTokenLimit - request.tokenBudget.reservedOutputTokens,
  )
  const outputTokens = Math.min(outputBudgetCeiling, outputTokenCost)

  const totalTokens = Math.min(
    request.tokenBudget.totalTokenLimit,
    inputTokens + outputTokens,
  )

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  }
}

function buildTraceability(request: LLMRequest): LLMResponse['traceability'] {
  return {
    traceId: request.traceability.traceId,
    relationId: request.traceability.relationId,
    requestId: request.traceability.requestId,
    contextRequestId: request.contextPackage.requestId,
    policyVersion: request.contextPackage.policyVersion,
    protocolVersion: request.protocolVersion,
    executionMode: request.executionMode,
    providerId: request.provider.providerId,
    providerVersion: request.provider.providerVersion,
    decision: 'accepted',
    relation: {
      requestToContext: 'matched',
      requestToProtocol: 'matched',
      requestToVersion: 'matched',
      requestToCapabilities: 'matched',
    },
  }
}

export function createMockLLMResponseFactory(
  input: CreateMockLLMResponseFactoryInput = {},
): MockLLMResponseFactory {
  const catalog = input.catalog ?? DEFAULT_RESPONSE_CATALOG

  return {
    createResponse(request: LLMRequest): LLMResponse {
      const entry = resolveCatalogEntry(catalog, request)
      const tokenUsage = deriveTokenUsage(request, entry.outputTokenCost)
      const traceability = buildTraceability(request)

      return deepFreeze({
        requestId: request.requestId,
        providerId: request.provider.providerId,
        providerVersion: request.provider.providerVersion,
        protocolVersion: request.protocolVersion,
        executionMode: request.executionMode,
        tokenUsage,
        output: {
          responseCode: entry.responseCode,
          summaryCode: entry.summaryCode,
          ...deepClone(entry.output),
        },
        traceability,
      })
    },
  }
}

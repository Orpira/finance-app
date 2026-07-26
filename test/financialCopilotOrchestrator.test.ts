import { describe, expect, it, vi } from 'vitest'

import {
  createAIToolExecutor,
  createAIToolRegistry,
  type AITool,
  type AIToolContext,
  type AIToolJsonValue,
  type AIToolRegistry,
  type AIToolSchemaNode,
} from '../src/intelligence/ai-tools'
import {
  createExecutionPlan,
} from '../src/intelligence/financial-copilot/executionPlanner'
import {
  createCopilotAwareToolExecutor,
  createFinancialCopilotOrchestrator,
  MAX_TOOL_ARGUMENT_ATTEMPTS,
} from '../src/intelligence/financial-copilot/financialCopilotOrchestrator'
import {
  normalizeToolResult,
} from '../src/intelligence/financial-copilot/resultNormalizer'
import {
  clearCopilotRuntimeMetrics,
  getCopilotRuntimeMetricsSnapshot,
  getCopilotTelemetrySnapshot,
  recordCopilotRuntimeMetric,
} from '../src/intelligence/financial-copilot/runtimeMetrics'
import {
  repairToolArguments,
} from '../src/intelligence/financial-copilot/toolArgumentRepair'
import {
  buildToolArguments,
} from '../src/intelligence/financial-copilot/toolArgumentBuilder'
import {
  validateToolArguments,
} from '../src/intelligence/financial-copilot/toolArgumentValidator'
import {
  createFinancialToolRegistry,
} from '../src/intelligence/financial-copilot/toolRegistry'
import {
  createToolSchemaRegistry,
} from '../src/intelligence/financial-copilot/toolSchemaRegistry'
import {
  registerFinancialToolsCatalog,
} from '../src/intelligence/ai-tools/financial'
import {
  createFinancialConversationOrchestrator,
  type AIConversationOrchestratorRequest,
} from '../src/intelligence/conversation-orchestrator'
import type { AppSettings } from '../src/types/settings'

const TEST_TOOL_SCHEMA: AIToolSchemaNode = {
  type: 'object',
  required: ['filters'],
  properties: {
    requestId: { type: 'string' },
    requestedAt: { type: 'string' },
    filters: {
      type: 'object',
      required: ['kinds'],
      properties: {
        kinds: { type: 'array', items: { type: 'string' } },
        currencyCode: { type: 'string' },
        period: {
          type: 'object',
          properties: {
            from: { type: 'string' },
            to: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    sort: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        direction: { type: 'string', enum: ['asc', 'desc'] },
      },
      additionalProperties: false,
    },
    limit: { type: 'number' },
  },
  additionalProperties: false,
}

function createContext(overrides: Partial<AIToolContext> = {}): AIToolContext {
  return {
    executionId: 'exec:1',
    conversationId: 'conv:1',
    sessionId: 'session:1',
    providerId: 'openai-provider',
    model: 'gpt-5-mini',
    requestedAt: '2026-07-26T00:00:00.000Z',
    caller: 'PIPELINE',
    ...overrides,
  }
}

function createTestTool(input: {
  readonly name: string
  readonly execute: AITool['execute']
}): AITool {
  return {
    definition: {
      name: input.name,
      description: 'Test financial tool used for Copilot Orchestrator unit tests.',
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: TEST_TOOL_SCHEMA,
      outputSchema: { type: 'object' },
      tags: ['test'],
    },
    execute: input.execute,
  }
}

function createRegistryWithEchoTool(name = 'financial_transactions'): {
  readonly registry: AIToolRegistry
  readonly executeSpy: ReturnType<typeof vi.fn>
} {
  const executeSpy = vi.fn(async (input: { readonly arguments: Readonly<Record<string, AIToolJsonValue>> }) => ({
    kind: 'success' as const,
    value: {
      toolName: name,
      output: { echoedArguments: input.arguments } as unknown as AIToolJsonValue,
      permission: 'read-only' as const,
      durationMs: 1,
    },
  }))

  const registry = createAIToolRegistry([
    createTestTool({ name, execute: executeSpy }),
  ])

  return { registry, executeSpy }
}

describe('Tool Schema Registry (PB-IS-016.1)', () => {
  it('expone el schema real declarado por la tool, sin inventarlo', () => {
    const { registry } = createRegistryWithEchoTool()
    const schemaRegistry = createToolSchemaRegistry(registry)

    const schemas = schemaRegistry.listSchemas()
    expect(schemas).toHaveLength(1)
    expect(schemas[0]?.toolId).toBe('financial_transactions')
    expect(schemas[0]?.inputSchema).toEqual(TEST_TOOL_SCHEMA)

    expect(schemaRegistry.getSchema('financial_transactions')?.inputSchema).toEqual(TEST_TOOL_SCHEMA)
    expect(schemaRegistry.getSchema('unknown_tool')).toBeNull()
  })
})

describe('Financial Tool Registry (PB-IS-016.1)', () => {
  it('enriquece el schema real con categorias/ejemplos/casos de uso/limites conocidos', () => {
    const { registry } = createRegistryWithEchoTool('financial_transactions')
    const toolRegistry = createFinancialToolRegistry(registry)

    const tool = toolRegistry.getTool('financial_transactions')
    expect(tool).not.toBeNull()
    expect(tool?.inputSchema).toEqual(TEST_TOOL_SCHEMA)
    expect(tool?.categories.length).toBeGreaterThan(0)
    expect(tool?.examples.length).toBeGreaterThan(0)
  })

  it('devuelve metadata vacia (sin inventar) para una tool sin entrada conocida', () => {
    const { registry } = createRegistryWithEchoTool('financial_unknown_tool')
    const toolRegistry = createFinancialToolRegistry(registry)

    const tool = toolRegistry.getTool('financial_unknown_tool')
    expect(tool?.categories).toEqual([])
    expect(tool?.examples).toEqual([])
  })
})

describe('Tool Argument Validator (PB-IS-016.1)', () => {
  it('schema valido: sin issues', () => {
    const result = validateToolArguments(TEST_TOOL_SCHEMA, {
      filters: { kinds: ['income'] },
      sort: { field: 'date', direction: 'desc' },
      limit: 2,
    })

    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('schema invalido: reporta required faltante, unknown property y enum invalido', () => {
    const result = validateToolArguments(TEST_TOOL_SCHEMA, {
      transaction_type: 'income',
      sort: { direction: 'sideways' },
    })

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual({ path: 'filters', kind: 'missing_required' })
    expect(result.issues).toContainEqual({ path: 'transaction_type', kind: 'unknown_property' })
    expect(result.issues.some((issue) => issue.path === 'sort.direction' && issue.kind === 'invalid_enum')).toBe(true)
  })
})

describe('Tool Argument Auto Repair (PB-IS-016.1)', () => {
  it('repara transaction_type -> filters.kinds envolviendo el string en arreglo', () => {
    const { repaired, changes } = repairToolArguments(TEST_TOOL_SCHEMA, {
      transaction_type: 'income',
      limit: 2,
    })

    expect(repaired.filters).toEqual({ kinds: ['income'] })
    expect(repaired.transaction_type).toBeUndefined()
    expect(changes.some((change) => change.rule === 'transaction_type -> filters.kinds')).toBe(true)
  })

  it('repara sort_order (oldest/latest) -> sort.direction (asc/desc)', () => {
    const oldest = repairToolArguments(TEST_TOOL_SCHEMA, { filters: { kinds: ['income'] }, sort_order: 'oldest' })
    expect(oldest.repaired.sort).toEqual({ direction: 'asc' })

    const latest = repairToolArguments(TEST_TOOL_SCHEMA, { filters: { kinds: ['income'] }, sort_order: 'most_recent' })
    expect(latest.repaired.sort).toEqual({ direction: 'desc' })
  })

  it('elimina propiedades desconocidas no mapeables cuando additionalProperties es false', () => {
    const { repaired, changes } = repairToolArguments(TEST_TOOL_SCHEMA, {
      filters: { kinds: ['income'] },
      compare_fields: ['amount', 'date'],
      account_id: null,
      language: 'es',
    })

    expect(repaired.compare_fields).toBeUndefined()
    expect(repaired.account_id).toBeUndefined()
    expect(repaired.language).toBeUndefined()
    expect(changes.filter((change) => change.rule === 'drop-unknown-property').length).toBeGreaterThanOrEqual(3)
  })

  it('reproduce exactamente el caso real observado en PB-IS-015.7 (Q4: Ultimo ingreso)', () => {
    const observedArguments = {
      transaction_type: 'income',
      limit: 2,
      sort_order: 'most_recent',
      compare_fields: ['amount', 'date', 'source'],
      account_id: null,
      currency: null,
      language: 'es',
    }

    const { repaired } = repairToolArguments(TEST_TOOL_SCHEMA, observedArguments)
    const validation = validateToolArguments(TEST_TOOL_SCHEMA, repaired)

    expect(validation.valid).toBe(true)
    expect(repaired.filters).toMatchObject({ kinds: ['income'] })
    expect(repaired.sort).toEqual({ direction: 'desc' })
    expect(repaired.limit).toBe(2)
  })
})

describe('Tool Argument Builder (PB-IS-016.1)', () => {
  it('completa currencyCode y period solo si el schema los soporta y el valor no fue provisto', () => {
    const result = buildToolArguments({
      schema: TEST_TOOL_SCHEMA,
      baseArguments: { filters: { kinds: ['income'] } },
      context: {
        defaultCurrency: 'EUR',
        activePeriod: { from: '2026-07-01', to: '2026-07-31' },
      },
    })

    expect(result.filters).toMatchObject({
      kinds: ['income'],
      currencyCode: 'EUR',
      period: { from: '2026-07-01', to: '2026-07-31' },
    })
  })

  it('nunca sobrescribe un valor ya provisto por el modelo', () => {
    const result = buildToolArguments({
      schema: TEST_TOOL_SCHEMA,
      baseArguments: { filters: { kinds: ['income'], currencyCode: 'COP' } },
      context: { defaultCurrency: 'EUR' },
    })

    expect((result.filters as Record<string, unknown>).currencyCode).toBe('COP')
  })
})

describe('Execution Planner (PB-IS-016.1)', () => {
  it('un solo tool selection produce un plan de un paso, no multitool', () => {
    const plan = createExecutionPlan({
      executionId: 'exec:1',
      toolSelections: [{ toolId: 'financial_balance', arguments: {} }],
    })

    expect(plan.isMultiTool).toBe(false)
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.order).toBe(1)
  })

  it('varios tool selections producen un plan multitool ordenado', () => {
    const plan = createExecutionPlan({
      executionId: 'exec:1',
      toolSelections: [
        { toolId: 'financial_reports', arguments: {} },
        { toolId: 'financial_insights', arguments: {} },
        { toolId: 'financial_planning', arguments: {} },
      ],
    })

    expect(plan.isMultiTool).toBe(true)
    expect(plan.steps.map((step) => step.toolId)).toEqual([
      'financial_reports',
      'financial_insights',
      'financial_planning',
    ])
    expect(plan.steps.map((step) => step.order)).toEqual([1, 2, 3])
  })
})

describe('Result Normalizer (PB-IS-016.1)', () => {
  it('normaliza un resultado exitoso con metadata/confidence/source/timestamp/payload', () => {
    const normalized = normalizeToolResult({
      toolId: 'financial_balance',
      execution: {
        kind: 'success',
        value: { toolName: 'financial_balance', output: { netBalance: 100 }, permission: 'read-only', durationMs: 5 },
      },
      now: () => '2026-07-26T00:00:00.000Z',
    })

    expect(normalized).toEqual({
      toolId: 'financial_balance',
      kind: 'success',
      confidence: 1,
      source: 'financial_balance',
      timestamp: '2026-07-26T00:00:00.000Z',
      payload: { netBalance: 100 },
    })
  })

  it('normaliza un resultado de fallo preservando codigo y mensaje', () => {
    const normalized = normalizeToolResult({
      toolId: 'financial_transactions',
      execution: {
        kind: 'failure',
        code: 'INVALID_ARGUMENTS',
        retryable: false,
        safeMessage: 'bad args',
      },
      now: () => '2026-07-26T00:00:00.000Z',
    })

    expect(normalized.kind).toBe('failure')
    expect(normalized.confidence).toBe(0)
    expect(normalized.errorCode).toBe('INVALID_ARGUMENTS')
    expect(normalized.errorMessage).toBe('bad args')
  })
})

describe('Runtime Metrics (PB-IS-016.1)', () => {
  it('agrega telemetria: success rate, auto-repair rate, herramientas mas usadas', () => {
    clearCopilotRuntimeMetrics()

    recordCopilotRuntimeMetric({
      timestamp: '2026-07-26T00:00:00.000Z',
      intent: 'financial_transactions',
      candidateToolIds: ['financial_transactions'],
      chosenToolId: 'financial_transactions',
      originalArguments: {},
      repairedArguments: { filters: { kinds: ['income'] } },
      retries: 1,
      durationMs: 100,
      confidence: 1,
      success: true,
      generatedByOpenAI: true,
    })
    recordCopilotRuntimeMetric({
      timestamp: '2026-07-26T00:00:01.000Z',
      intent: 'financial_balance',
      candidateToolIds: ['financial_balance'],
      chosenToolId: 'financial_balance',
      originalArguments: {},
      repairedArguments: null,
      retries: 0,
      durationMs: 50,
      confidence: 1,
      success: true,
      generatedByOpenAI: false,
    })

    const snapshot = getCopilotRuntimeMetricsSnapshot()
    expect(snapshot).toHaveLength(2)

    const telemetry = getCopilotTelemetrySnapshot()
    expect(telemetry.totalExecutions).toBe(2)
    expect(telemetry.successRate).toBe(1)
    expect(telemetry.autoRepairRate).toBe(0.5)
    expect(telemetry.averageDurationMs).toBe(75)
    expect(telemetry.aiGeneratedResponseRate).toBe(0.5)
    expect(telemetry.deterministicResponseRate).toBe(0.5)

    clearCopilotRuntimeMetrics()
  })
})

describe('Financial Copilot Orchestrator — seleccion, autoreparacion y retry (PB-IS-016.1)', () => {
  it('selecciona la tool correcta y la ejecuta cuando los argumentos ya son validos', async () => {
    const { registry, executeSpy } = createRegistryWithEchoTool()
    const toolExecutor = createAIToolExecutor({ registry })
    const orchestrator = createFinancialCopilotOrchestrator({ registry, toolExecutor })

    const result = await orchestrator.executePlan({
      executionId: 'exec:1',
      toolSelections: [{ toolId: 'financial_transactions', arguments: { filters: { kinds: ['income'] }, limit: 2 } }],
      context: createContext(),
    })

    expect(result.isMultiTool).toBe(false)
    expect(result.outcomes).toHaveLength(1)
    expect(result.outcomes[0]?.result.kind).toBe('success')
    expect(result.outcomes[0]?.retries).toBe(0)
    expect(result.outcomes[0]?.repairedArguments).toBeNull()
    expect(executeSpy).toHaveBeenCalledTimes(1)
  })

  it('autorepara argumentos invalidos y reintenta hasta ejecutar correctamente', async () => {
    const { registry, executeSpy } = createRegistryWithEchoTool()
    const toolExecutor = createAIToolExecutor({ registry })
    const orchestrator = createFinancialCopilotOrchestrator({ registry, toolExecutor })

    const result = await orchestrator.executePlan({
      executionId: 'exec:1',
      toolSelections: [{
        toolId: 'financial_transactions',
        arguments: { transaction_type: 'income', sort_order: 'most_recent', limit: 2, account_id: null },
      }],
      context: createContext(),
      generatedByOpenAI: true,
    })

    const outcome = result.outcomes[0]
    expect(outcome?.result.kind).toBe('success')
    expect(outcome?.retries).toBeGreaterThan(0)
    expect(outcome?.repairedArguments).toMatchObject({ filters: { kinds: ['income'] }, sort: { direction: 'desc' } })
    expect(executeSpy).toHaveBeenCalledTimes(1)

    const [[executedRequest]] = executeSpy.mock.calls
    expect(executedRequest.arguments).toMatchObject({ filters: { kinds: ['income'] }, sort: { direction: 'desc' } })
  })

  it('falla de forma controlada tras agotar los intentos si no hay reparacion posible', async () => {
    const { registry, executeSpy } = createRegistryWithEchoTool()
    const toolExecutor = createAIToolExecutor({ registry })
    const orchestrator = createFinancialCopilotOrchestrator({ registry, toolExecutor })

    // "period" con additionalProperties:false y una clave irreparable dentro
    // de un objeto que ya es valido en su forma general no genera cambios,
    // por lo que el ciclo de reparacion debe detenerse sin ejecutar la tool.
    const result = await orchestrator.executePlan({
      executionId: 'exec:1',
      toolSelections: [{ toolId: 'financial_transactions', arguments: {} }],
      context: createContext(),
    })

    expect(result.outcomes[0]?.result.kind).toBe('failure')
    expect(result.outcomes[0]?.result.errorCode).toBe('INVALID_ARGUMENTS')
    expect(result.outcomes[0]?.retries).toBeLessThanOrEqual(MAX_TOOL_ARGUMENT_ATTEMPTS)
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('multitool: ejecuta varias tools en el orden del plan y agrega los resultados', async () => {
    const reportsExecute = vi.fn(async () => ({
      kind: 'success' as const,
      value: { toolName: 'financial_reports', output: { period: 'julio' }, permission: 'read-only' as const, durationMs: 1 },
    }))
    const insightsExecute = vi.fn(async () => ({
      kind: 'success' as const,
      value: { toolName: 'financial_insights', output: { insight: 'ahorro estable' }, permission: 'read-only' as const, durationMs: 1 },
    }))

    const registry = createAIToolRegistry([
      createTestTool({ name: 'financial_reports', execute: reportsExecute }),
      createTestTool({ name: 'financial_insights', execute: insightsExecute }),
    ])
    const toolExecutor = createAIToolExecutor({ registry })
    const orchestrator = createFinancialCopilotOrchestrator({ registry, toolExecutor })

    const result = await orchestrator.executePlan({
      executionId: 'exec:1',
      toolSelections: [
        { toolId: 'financial_reports', arguments: { filters: { kinds: ['income'] } } },
        { toolId: 'financial_insights', arguments: { filters: { kinds: ['income'] } } },
      ],
      context: createContext(),
    })

    expect(result.isMultiTool).toBe(true)
    expect(result.outcomes).toHaveLength(2)
    expect(result.outcomes.every((outcome) => outcome.result.kind === 'success')).toBe(true)
    expect(reportsExecute).toHaveBeenCalledTimes(1)
    expect(insightsExecute).toHaveBeenCalledTimes(1)
  })
})

describe('Copilot-aware Tool Executor — drop-in replacement (PB-IS-016.1)', () => {
  it('es compatible con AIToolExecutor y repara argumentos antes de delegar en el executor real', async () => {
    const { registry, executeSpy } = createRegistryWithEchoTool()
    const realExecutor = createAIToolExecutor({ registry })
    const copilotExecutor = createCopilotAwareToolExecutor({ registry, toolExecutor: realExecutor })

    const result = await copilotExecutor.execute({
      toolName: 'financial_transactions',
      arguments: { transaction_type: 'income', sort_order: 'oldest', limit: 2 },
      context: createContext(),
    })

    expect(result.kind).toBe('success')
    expect(executeSpy).toHaveBeenCalledTimes(1)
    const [[executedRequest]] = executeSpy.mock.calls
    expect(executedRequest.arguments).toMatchObject({ filters: { kinds: ['income'] }, sort: { direction: 'asc' } })
  })

  it('nunca deja que la tool reciba argumentos invalidos: sin reparacion posible, la tool no se ejecuta', async () => {
    const { registry, executeSpy } = createRegistryWithEchoTool()
    const realExecutor = createAIToolExecutor({ registry })
    const copilotExecutor = createCopilotAwareToolExecutor({ registry, toolExecutor: realExecutor })

    const result = await copilotExecutor.execute({
      toolName: 'financial_transactions',
      arguments: {},
      context: createContext(),
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_ARGUMENTS')
    }
    expect(executeSpy).not.toHaveBeenCalled()
  })

  it('delega resolveRequestFromProviderResponse sin modificarlo', () => {
    const { registry } = createRegistryWithEchoTool()
    const realExecutor = createAIToolExecutor({ registry })
    const copilotExecutor = createCopilotAwareToolExecutor({ registry, toolExecutor: realExecutor })

    expect(copilotExecutor.resolveRequestFromProviderResponse).toBe(realExecutor.resolveRequestFromProviderResponse)
  })
})

describe('Composition Wiring — catalogo real de Financial Tools (PB-IS-016.1)', () => {
  function stubSettings(): AppSettings {
    return {
      id: 'app',
      businessName: '',
      country: 'ES',
      city: '',
      defaultCurrency: 'EUR',
      secondaryCurrency: 'COP',
      incomePercentage: 50,
      rateMode: 'manual',
      usageMode: 'professional',
      userType: 'primary',
      theme: 'system',
      pinEnabled: false,
      backupEncryptionKey: '',
      driveBackupEnabled: false,
      driveBackupFrequency: 'daily',
      cutoffFrequency: 'weekly',
      cutoffWeekStart: 1,
      cutoffAnchorDate: '2026-07-25',
      googleDriveClientId: '',
      googleDriveConnected: false,
      closedLocationSeasons: [],
      reopenedLocationSeasons: [],
      createdAt: '2026-07-25T00:00:00.000Z',
      updatedAt: '2026-07-25T00:00:00.000Z',
    } as unknown as AppSettings
  }

  function createRealFinancialToolsRegistry(): AIToolRegistry {
    const registry = createAIToolRegistry([])
    // Solo se sustituyen los adaptadores de infraestructura (settings/repos de
    // ingresos y gastos, que en runtime real usan IndexedDB via Dexie y no
    // existen en el entorno de test) -- la tool, su schema real y el
    // Copilot Orchestrator que la envuelve son exactamente los certificados.
    const registration = registerFinancialToolsCatalog(registry, {
      transactions: {
        getSettings: async () => stubSettings(),
        listServiceIncomes: async () => [],
        listExpenses: async () => [],
      },
    })
    if (registration.kind === 'failure') {
      throw new Error(registration.safeMessage)
    }
    return registry
  }

  it('reproduce y repara el caso real documentado en PB-IS-015.7 (transaction_type/sort_order) exactamente como lo cablea conversationComposition.ts', async () => {
    // Este test replica, con el catalogo REAL de Financial Tools (no un stub),
    // exactamente el mismo cableado que src/pages/Conversation/conversationComposition.ts
    // aplica en produccion: el AIToolExecutor real envuelto por
    // createCopilotAwareToolExecutor, inyectado en createFinancialConversationOrchestrator.
    // Antes de este milestone, `financial_transactions` con `transaction_type`/`sort_order`
    // (la forma que OpenAI genero en produccion, PB-IS-015.7) fallaba con INVALID_ARGUMENTS.
    const registry = createRealFinancialToolsRegistry()
    const copilotAwareToolExecutor = createCopilotAwareToolExecutor({
      registry,
      toolExecutor: createAIToolExecutor({ registry }),
    })
    const orchestrator = createFinancialConversationOrchestrator({
      registry,
      toolExecutor: copilotAwareToolExecutor,
    })

    const result = await orchestrator.execute({
      protocolVersion: 1,
      executionId: 'conversation-orchestration:test:1' as AIConversationOrchestratorRequest['executionId'],
      context: createContext(),
      steps: [
        {
          stepId: 'step:1',
          order: 1,
          toolId: 'financial_transactions',
          arguments: { transaction_type: 'income', sort_order: 'latest', limit: 2 },
        },
      ],
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.result.steps[0]?.kind).toBe('success')
    }
  })

  it('sin el copilot-aware executor (cableado anterior a PB-IS-016.1), el mismo caso falla con INVALID_ARGUMENTS', async () => {
    // Control negativo: prueba que la reparacion observada arriba proviene
    // realmente del wrapper del Copilot, no de un cambio en la tool o en su
    // schema — con el AIToolExecutor real "crudo" (sin copilot), el mismo
    // caso documentado en PB-IS-015.7 sigue fallando.
    const registry = createRealFinancialToolsRegistry()
    const orchestrator = createFinancialConversationOrchestrator({
      registry,
      toolExecutor: createAIToolExecutor({ registry }),
    })

    const result = await orchestrator.execute({
      protocolVersion: 1,
      executionId: 'conversation-orchestration:test:2' as AIConversationOrchestratorRequest['executionId'],
      context: createContext(),
      steps: [
        {
          stepId: 'step:1',
          order: 1,
          toolId: 'financial_transactions',
          arguments: { transaction_type: 'income', sort_order: 'latest', limit: 2 },
        },
      ],
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.result.steps[0]?.kind).toBe('failure')
    }
  })
})

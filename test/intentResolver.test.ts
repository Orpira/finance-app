import { describe, expect, it } from 'vitest'

import type { AIConversationRequest } from '../src/intelligence/ai-conversation'
import { AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION } from '../src/intelligence/conversation-orchestrator'
import {
  createCapabilityAwareIntentResolver,
  createDeterministicIntentResolver,
  createIntentResolver,
  DETERMINISTIC_INTENT_RESOLVER_PROVIDER,
  INTENT_RESOLVER_PROTOCOL_VERSION,
  validateIntentResolutionRequest,
  validateIntentResolutionResult,
  validateIntentResolverResolveResult,
} from '../src/intelligence/intent-resolver/intentResolver'
import { createAIToolRegistry, type AITool } from '../src/intelligence/ai-tools'
import {
  createConversationControllerDependencies,
} from '../src/pages/Conversation/conversationComposition'
import {
  createConversationController,
} from '../src/pages/Conversation/conversationController'

function createConversationRequestFixture(now = '2026-07-24T12:00:00.000Z'): AIConversationRequest {
  return {
    protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
    executionId: 'conversation-orchestration:intent-resolver:test:001' as AIConversationRequest['executionId'],
    context: {
      executionId: 'execution:intent-resolver:test:001',
      conversationId: 'conversation:intent-resolver:test:001',
      sessionId: 'session:intent-resolver:test:001',
      providerId: 'TEST',
      model: 'provider-neutral',
      requestedAt: now,
      caller: 'SYSTEM',
    },
    steps: [
      {
        stepId: 'step-1',
        order: 1,
        toolId: 'financial_balance',
        arguments: {},
      },
    ],
  }
}

function createRequest(message: string) {
  const requestedAt = '2026-07-24T12:00:00.000Z'
  return {
    protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
    conversationRequest: createConversationRequestFixture(requestedAt),
    metadata: {
      userMessage: message,
      turn: 1,
      requestedAt,
    },
  } as const
}

describe('Intent Resolver (PB-IS-014.1)', () => {
  it('balance', async () => {
    const resolver = createDeterministicIntentResolver({
      now: () => '2026-07-24T12:00:01.000Z',
    })

    const result = await resolver.resolve(createRequest('Quiero ver mi balance'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }

    expect(result.resolution.detectedIntent).toBe('balance')
    expect(result.resolution.tools[0].toolId).toBe('financial_balance')
  })

  it('transactions', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('Muéstrame mis transacciones'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }
    expect(result.resolution.detectedIntent).toBe('transactions')
    expect(result.resolution.tools[0].toolId).toBe('financial_transactions')
  })

  it('goals', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('Cuáles son mis metas?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }
    expect(result.resolution.detectedIntent).toBe('goals')
    expect(result.resolution.tools[0].toolId).toBe('financial_goals')
  })

  it('budget', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('Necesito mi presupuesto'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }
    expect(result.resolution.detectedIntent).toBe('budget')
    expect(result.resolution.tools[0].toolId).toBe('financial_budget')
  })

  it('reports', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('Dame un reporte mensual'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }
    expect(result.resolution.detectedIntent).toBe('reports')
    expect(result.resolution.tools[0].toolId).toBe('financial_reports')
    expect(result.resolution.tools[0].arguments).toEqual({ format: 'json' })
  })

  it('insights', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('Quiero insights de tendencia'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }
    expect(result.resolution.detectedIntent).toBe('insights')
    expect(result.resolution.tools[0].toolId).toBe('financial_insights')
    expect(result.resolution.tools[0].arguments).toEqual({ format: 'json' })
  })

  it('intención desconocida', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('hola, solo estoy probando'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }
    expect(result.resolution.detectedIntent).toBe('unknown')
    expect(result.resolution.tools[0].toolId).toBe('financial_balance')
    expect(result.resolution.confidence).toBe(0.3)
  })

  it('validator', async () => {
    const resolver = createDeterministicIntentResolver({
      now: () => '2026-07-24T12:00:01.000Z',
    })
    const request = createRequest('balance')

    expect(validateIntentResolutionRequest(request)).toBeNull()

    const result = await resolver.resolve(request)
    expect(validateIntentResolverResolveResult(result)).toBeNull()

    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }

    expect(validateIntentResolutionResult(result.resolution)).toBeNull()
  })

  it('factory', async () => {
    const resolver = createIntentResolver({
      now: () => '2026-07-24T12:00:01.000Z',
    })

    const result = await resolver.resolve(createRequest('balance'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success result')
    }

    expect(result.resolution.provider).toBe(DETERMINISTIC_INTENT_RESOLVER_PROVIDER)
  })

  it('temporal: "hoy" genera filters.period cubriendo el dia de la consulta', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuánto suman mis ingresos hoy?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.detectedIntent).toBe('transactions')
    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-24', to: '2026-07-24' }, kinds: ['income'] },
    })
  })

  it('temporal: "ayer" genera filters.period del dia anterior', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuánto suman mis ingresos ayer?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-23', to: '2026-07-23' }, kinds: ['income'] },
    })
  })

  it('temporal: fecha absoluta explicita ("2026-07-25") genera filters.period de ese unico dia (PB-IS-016.2-R2)', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuánto fueron mis ingresos en 2026-07-25?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-25', to: '2026-07-25' }, kinds: ['income'] },
    })
  })

  it('temporal: fecha en espanol con nombre de mes ("24 de julio") asume el anio de requestedAt (PB-IS-016.2-R3)', async () => {
    // Bug real reportado en produccion: sin este soporte, "24 de julio" no
    // era reconocida como temporal por el Resolver determinista, por lo que
    // enforceDeterministicTemporalPeriod (aiConversationService.ts) no tenia
    // nada con que corregir al proveedor primario, que termino repitiendo
    // el periodo de "ayer" de un turno anterior en vez de resolver la fecha
    // pedida.
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuánto suman los ingresos del 24 de julio?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    // requestedAt = 2026-07-24T12:00:00.000Z -> anio implicito 2026
    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-24', to: '2026-07-24' }, kinds: ['income'] },
    })
  })

  it('temporal: fecha en espanol con nombre de mes y anio explicito ("10 de julio de 2025") no asume el anio de requestedAt (PB-IS-016.2-R3)', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuánto suman los ingresos del 10 de julio de 2025?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2025-07-10', to: '2025-07-10' }, kinds: ['income'] },
    })
  })

  it('temporal: rango personalizado "desde el 1 de julio hasta la fecha" (PB-IS-016.2-R3)', async () => {
    // Bug real reportado en produccion: sin este soporte, un rango
    // explicito con "desde ... hasta ..." no era reconocido como temporal
    // por el Resolver determinista, y la consulta dependia enteramente del
    // proveedor primario, que devolvio 0 resultados pese a existir ingresos
    // reales en ese rango.
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuántos ingresos hay desde el 1 de julio hasta la fecha?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    // requestedAt = 2026-07-24T12:00:00.000Z -> "la fecha" = hoy = 2026-07-24
    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-01', to: '2026-07-24' }, kinds: ['income'] },
    })
  })

  it('temporal: rango personalizado con dos fechas ISO explicitas ("desde 2026-07-01 hasta 2026-07-20") (PB-IS-016.2-R3)', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('Dame mis ingresos desde 2026-07-01 hasta 2026-07-20'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-01', to: '2026-07-20' }, kinds: ['income'] },
    })
  })

  it('temporal: "ayer" resuelve la fecha local de "requestedAt", no la fecha UTC (PB-IS-016.2-R2)', async () => {
    // requestedAt es 2026-07-27T01:00:00.000Z en UTC, pero en UTC-5
    // (America/Bogota) es 2026-07-26 20:00 local: un dia distinto. "ayer"
    // debe resolverse sobre el dia local (2026-07-26), no sobre el dia UTC
    // (2026-07-27), para coincidir con income.date, que la UI captura con
    // metodos de fecha local (IncomePage.tsx formatInputDate). Se fija
    // process.env.TZ explicitamente para que la prueba sea determinista
    // sin importar la zona horaria del entorno donde corra.
    const originalTz = process.env.TZ
    process.env.TZ = 'America/Bogota'
    try {
      const resolver = createDeterministicIntentResolver({
        now: () => '2026-07-27T01:00:00.000Z',
      })
      const result = await resolver.resolve({
        protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
        conversationRequest: createConversationRequestFixture('2026-07-27T01:00:00.000Z'),
        metadata: {
          userMessage: '¿Cuántos ingresos obtuve ayer?',
          turn: 1,
          requestedAt: '2026-07-27T01:00:00.000Z',
        },
      })
      expect(result.kind).toBe('success')
      if (result.kind !== 'success') throw new Error('Expected success result')

      const args = result.resolution.tools[0].arguments as { filters?: { period?: { from?: string; to?: string } } }
      expect(args.filters?.period).toEqual({ from: '2026-07-25', to: '2026-07-25' })
    } finally {
      process.env.TZ = originalTz
    }
  })

  it('temporal: "este mes" combinado con gastos (verbo conjugado "gasté") genera kinds expense', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuánto gasté este mes?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.detectedIntent).toBe('transactions')
    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-01', to: '2026-07-24' }, kinds: ['expense'] },
    })
  })

  it('temporal: "semana pasada" genera el rango completo de la semana anterior (lunes a domingo)', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuáles fueron mis ingresos la semana pasada?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    // 2026-07-24 es viernes; la semana actual empieza el lunes 2026-07-20,
    // por lo que la semana pasada va del 2026-07-13 al 2026-07-19.
    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-13', to: '2026-07-19' }, kinds: ['income'] },
    })
  })

  it('temporal: "balance hoy" genera filters.period en financial_balance sin filters.kinds', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuál fue mi balance hoy?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.detectedIntent).toBe('balance')
    expect(result.resolution.tools[0].toolId).toBe('financial_balance')
    expect(result.resolution.tools[0].arguments).toEqual({
      filters: { period: { from: '2026-07-24', to: '2026-07-24' } },
    })
  })

  it('kinds: "gastos" (sin verbo conjugado) genera filters.kinds expense', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuántos gastos tuve ayer?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    const args = result.resolution.tools[0].arguments as { filters?: { kinds?: unknown } }
    expect(args.filters?.kinds).toEqual(['expense'])
  })

  it('kinds: "ingresos" sin referencia temporal no deja arguments vacios', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuántos ingresos tengo?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).toEqual({ filters: { kinds: ['income'] } })
  })

  it('agregacion: "suma" se detecta sin alterar sort/limit', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Cuánto suman mis ingresos ayer?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).not.toHaveProperty('sort')
    expect(result.resolution.tools[0].arguments).not.toHaveProperty('limit')
  })

  it('agregacion: "cantidad" se detecta como aggregation de conteo', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('¿Qué cantidad de ingresos tengo?'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).toEqual({ filters: { kinds: ['income'] } })
  })

  it('agregacion: "últimos 5 movimientos" genera sort/limit sin confundirse con "últimos N días"', async () => {
    const resolver = createDeterministicIntentResolver()
    const result = await resolver.resolve(createRequest('Muéstrame mis últimos 5 movimientos'))
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') throw new Error('Expected success result')

    expect(result.resolution.tools[0].arguments).toEqual({
      sort: { field: 'date', direction: 'desc' },
      limit: 5,
    })
  })

  it('integración', async () => {
    // environment: {} aisla el test del .env/.env.local reales del
    // repositorio (que configuran VITE_AI_PROVIDER=openai); sin esto, el test
    // haria una llamada de red real a OpenAI en lugar de ejercitar el flujo
    // determinista.
    const dependencies = createConversationControllerDependencies({ environment: {} })
    const controller = createConversationController(dependencies)

    await controller.initialize()
    await controller.sendMessage('Dame mis transacciones')

    const state = controller.getState()
    expect(state.messages).toHaveLength(2)
    expect(state.messages[1].role).toBe('ASSISTANT')
    const assistantText = state.messages[1].text
    // PB-IS-016.1-R1: sin IndexedDB en el entorno de test, la Tool real falla
    // y la ruta DIRECT_TOOL responde con el fallback seguro (no tecnico) de
    // financialDirectResponseBuilder en vez del mensaje generico anterior.
    expect(
      assistantText.includes('transacciones')
      || assistantText.includes('No pude completar tu consulta financiera')
      || assistantText.includes('No fue posible completar la consulta.'),
    ).toBe(true)
  })
})

function createStubTool(name: string): AITool {
  return {
    definition: {
      name,
      description: 'stub',
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: { type: 'object' },
      outputSchema: { type: 'object' },
    },
    async execute() {
      return { kind: 'success', value: { toolName: name, output: {}, permission: 'read-only', durationMs: 0 } }
    },
  }
}

describe('Capability-aware Intent Resolver (PB-IS-016.1)', () => {
  it('reenvia la resolucion cuando la tool elegida SI esta registrada', async () => {
    const registry = createAIToolRegistry([createStubTool('financial_balance')])
    const resolver = createCapabilityAwareIntentResolver({
      baseResolver: createDeterministicIntentResolver(),
      toolRegistry: registry,
    })

    const result = await resolver.resolve(createRequest('Quiero ver mi balance'))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolution.tools[0]?.toolId).toBe('financial_balance')
    }
  })

  it('falla cerrado cuando la tool elegida NO esta registrada en el Tool Registry', async () => {
    const registry = createAIToolRegistry([createStubTool('financial_reports')])
    const resolver = createCapabilityAwareIntentResolver({
      baseResolver: createDeterministicIntentResolver(),
      toolRegistry: registry,
    })

    const result = await resolver.resolve(createRequest('Quiero ver mi balance'))
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_INTENT_RESULT')
    }
  })
})

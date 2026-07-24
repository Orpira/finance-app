import { describe, expect, it } from 'vitest'

import type { AIConversationRequest } from '../src/intelligence/ai-conversation'
import { AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION } from '../src/intelligence/conversation-orchestrator'
import {
  createDeterministicIntentResolver,
  createIntentResolver,
  DETERMINISTIC_INTENT_RESOLVER_PROVIDER,
  INTENT_RESOLVER_PROTOCOL_VERSION,
  validateIntentResolutionRequest,
  validateIntentResolutionResult,
  validateIntentResolverResolveResult,
} from '../src/intelligence/intent-resolver/intentResolver'
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

  it('integración', async () => {
    const dependencies = createConversationControllerDependencies()
    const controller = createConversationController(dependencies)

    await controller.initialize()
    await controller.sendMessage('Dame mis transacciones')

    const state = controller.getState()
    expect(state.messages).toHaveLength(2)
    expect(state.messages[1].role).toBe('ASSISTANT')
    const assistantText = state.messages[1].text
    expect(
      assistantText.includes('transacciones')
      || assistantText.includes('No fue posible completar la consulta.'),
    ).toBe(true)
  })
})

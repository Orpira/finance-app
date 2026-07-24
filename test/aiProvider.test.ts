import { describe, expect, it } from 'vitest'

import type {
  AIConversationRequest,
} from '../src/intelligence/ai-conversation'
import {
  AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
} from '../src/intelligence/conversation-orchestrator'
import {
  createPromptContextBuilder,
} from '../src/intelligence/prompt-context-builder'
import {
  createConversationResponseComposer,
} from '../src/intelligence/response-composer'
import {
  AI_PROVIDER_CAPABILITIES,
  AI_PROVIDER_PROTOCOL_VERSION,
  createAIProvider,
  createMockAIProvider,
  validateAIProvider,
  validateAIProviderCapability,
  validateAIProviderConversationGenerationResult,
  validateAIProviderIntentResolutionResult,
} from '../src/intelligence/ai-provider/aiProvider'

function createRequestFixture(userMessage: string): {
  readonly protocolVersion: 1
  readonly conversationRequest: AIConversationRequest
  readonly metadata: {
    readonly userMessage: string
    readonly turn: number
    readonly requestedAt: string
  }
} {
  const requestedAt = '2026-07-24T12:00:00.000Z'
  return {
    protocolVersion: 1,
    conversationRequest: {
      protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
      executionId: 'conversation-orchestration:provider:test:001' as AIConversationRequest['executionId'],
      context: {
        executionId: 'execution:provider:test:001',
        conversationId: 'conversation:provider:test:001',
        sessionId: 'session:provider:test:001',
        providerId: 'TEST',
        model: 'provider-neutral',
        requestedAt,
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
    },
    metadata: {
      userMessage,
      turn: 1,
      requestedAt,
    },
  }
}

function createConversationResponseFixture() {
  const promptContextResult = createPromptContextBuilder().build({
    executionResult: {
      executionId: 'conversation-orchestration:provider:execution:001' as AIConversationRequest['executionId'],
      startedAt: '2026-07-24T12:00:00.000Z',
      finishedAt: '2026-07-24T12:00:01.000Z',
      status: 'success',
      summary: {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
      },
      steps: [
        {
          kind: 'success',
          stepId: 'step-1',
          order: 1,
          toolId: 'financial_balance',
          resolvedToolName: 'financial_balance',
          execution: {
            toolName: 'financial_balance',
            output: {
              summary: {
                netBalance: 123,
              },
            },
            permission: 'read-only',
            durationMs: 1,
          },
        },
      ],
    },
  })

  if (promptContextResult.kind !== 'success') {
    throw new Error('Expected prompt context fixture')
  }

  const responseResult = createConversationResponseComposer().build({
    promptContext: promptContextResult.context,
  })

  if (responseResult.kind !== 'success') {
    throw new Error('Expected response fixture')
  }

  return responseResult.response
}

describe('AI Provider Contracts (PB-IS-014.2)', () => {
  it('metadata', () => {
    const provider = createMockAIProvider()
    expect(provider.metadata.protocolVersion).toBe(AI_PROVIDER_PROTOCOL_VERSION)
    expect(provider.metadata.providerId.length).toBeGreaterThan(0)
    expect(provider.metadata.providerName.length).toBeGreaterThan(0)
    expect(provider.metadata.providerVersion.length).toBeGreaterThan(0)
  })

  it('capabilities', () => {
    const provider = createMockAIProvider()
    expect(provider.metadata.capabilities).toEqual(AI_PROVIDER_CAPABILITIES)
    expect(validateAIProviderCapability('INTENT_RESOLUTION')).toBeNull()
    expect(validateAIProviderCapability('CONVERSATION_GENERATION')).toBeNull()
  })

  it('MockAIProvider', () => {
    const provider = createMockAIProvider()
    expect(validateAIProvider(provider)).toBeNull()
    expect(typeof provider.resolveIntent).toBe('function')
    expect(typeof provider.generateConversation).toBe('function')
  })

  it('resolveIntent', async () => {
    const provider = createMockAIProvider({
      intentResolver: {
        now: () => '2026-07-24T12:00:01.000Z',
      },
    })
    if (provider.resolveIntent === undefined) {
      throw new Error('Expected intent capability')
    }

    const result = await provider.resolveIntent(createRequestFixture('Dame mis transacciones'))
    expect(validateAIProviderIntentResolutionResult(result)).toBeNull()
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success')
    }

    expect(result.resolution.detectedIntent).toBe('transactions')
    expect(result.resolution.tools[0].toolId).toBe('financial_transactions')
  })

  it('generateConversation', async () => {
    const provider = createMockAIProvider()
    if (provider.generateConversation === undefined) {
      throw new Error('Expected generation capability')
    }

    const result = await provider.generateConversation(createConversationResponseFixture())
    expect(validateAIProviderConversationGenerationResult(result)).toBeNull()
    expect(result.kind).toBe('success')
    if (result.kind !== 'success') {
      throw new Error('Expected success')
    }

    expect(result.message.origin).toBe('MOCK_RENDERER')
  })

  it('validator', () => {
    const provider = createMockAIProvider()
    expect(validateAIProvider(provider)).toBeNull()
  })

  it('factory', () => {
    const provider = createAIProvider()
    expect(validateAIProvider(provider)).toBeNull()
    expect(provider.metadata.providerId).toBe('mock-ai-provider')
  })

  it('integración', async () => {
    const provider = createAIProvider()
    if (provider.resolveIntent === undefined || provider.generateConversation === undefined) {
      throw new Error('Expected full provider capabilities')
    }

    const intent = await provider.resolveIntent(createRequestFixture('Necesito mi presupuesto'))
    expect(intent.kind).toBe('success')

    const conversation = await provider.generateConversation(createConversationResponseFixture())
    expect(conversation.kind).toBe('success')
  })
})

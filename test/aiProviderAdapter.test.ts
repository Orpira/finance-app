import { describe, expect, it } from 'vitest'

import {
  createPrompt,
  createPromptSegment,
} from '../src/intelligence/prompt-builder'
import {
  createOpenAIProviderAdapter,
  createProvider,
  createProviderRequest,
  createProviderRequestId,
  createProviderResponse,
  mapPromptToOpenAIRequest,
  resolveProvider,
  validateAIProviderCapabilities,
  validateAIProviderRequest,
  validateAIProviderResponse,
  type OpenAITransport,
  type OpenAITransportExecuteInput,
} from '../src/intelligence/provider'

function createFixturePrompt() {
  const system = createPromptSegment({
    id: 'prompt-segment:provider:001',
    role: 'SYSTEM',
    content: 'Actua como asistente financiero.',
    priority: 'CRITICAL',
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'SYSTEM',
    },
  })
  const user = createPromptSegment({
    id: 'prompt-segment:provider:002',
    role: 'USER',
    content: 'Resume mi balance mensual.',
    priority: 'HIGH',
    metadata: {
      createdAt: '2026-07-22T00:00:01.000Z',
      source: 'CONVERSATION',
    },
  })

  if (system.kind === 'failure' || user.kind === 'failure') {
    throw new Error('Expected valid prompt segment fixtures')
  }

  const prompt = createPrompt({
    promptId: 'prompt:provider:001',
    segments: [system.segment, user.segment],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (prompt.kind === 'failure') {
    throw new Error('Expected valid prompt fixture')
  }

  return prompt.prompt
}

function createFixtureRequest() {
  const request = createProviderRequest({
    id: 'provider-request:openai:001',
    prompt: createFixturePrompt(),
    metadata: {
      createdAt: '2026-07-22T00:00:02.000Z',
      source: 'APPLICATION',
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      maxOutputTokens: 400,
      responseFormat: 'JSON',
      timeoutMs: 2000,
    },
  })

  expect(request.kind).toBe('success')
  if (request.kind === 'failure') {
    throw new Error(`Expected valid provider request fixture but got ${request.code}`)
  }

  return request.request
}

describe('AIProvider contracts and factory (Milestone 10D)', () => {
  it('creates immutable provider request and response', () => {
    const request = createFixtureRequest()
    expect(createProviderRequestId('provider-request:main:001')).toBe('provider-request:main:001')
    expect(validateAIProviderRequest(request)).toBeNull()
    expect(Object.isFrozen(request)).toBe(true)

    const response = createProviderResponse({
      id: 'provider-response:openai:001',
      content: '{"summary":"ok"}',
      usage: {
        inputTokens: 100,
        outputTokens: 40,
        totalTokens: 140,
      },
      finishReason: 'STOP',
      metadata: {
        createdAt: '2026-07-22T00:00:03.000Z',
        requestId: request.id,
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
        source: 'SYSTEM',
        latencyMs: 84,
      },
    })

    expect(response.kind).toBe('success')
    if (response.kind === 'failure') {
      throw new Error(`Expected valid provider response but got ${response.code}`)
    }

    expect(validateAIProviderResponse(response.response)).toBeNull()
    expect(Object.isFrozen(response.response)).toBe(true)
    expect(Object.isFrozen(response.response.metadata)).toBe(true)
  })

  it('fails closed for invalid prompt input', () => {
    const invalidPrompt = createFixturePrompt()
    const request = createProviderRequest({
      id: 'provider-request:openai:invalid',
      prompt: {
        ...invalidPrompt,
        segments: [],
      },
      metadata: {
        createdAt: '2026-07-22T00:00:02.000Z',
        source: 'APPLICATION',
        providerId: 'OPENAI',
        model: 'gpt-4.1-mini',
      },
    })

    expect(request.kind).toBe('failure')
    if (request.kind === 'failure') {
      expect(request.code).toBe('INVALID_PROMPT')
    }
  })
})

describe('OpenAI provider adapter', () => {
  it('maps prompt to OpenAI payload and response back to domain', async () => {
    const captured: OpenAITransportExecuteInput[] = []
    const transport: OpenAITransport = {
      async execute(input) {
        captured.push(input)
        return {
          latencyMs: 55,
          response: {
            id: 'chatcmpl_123',
            model: 'gpt-4.1-mini',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  content: '{"summary":"balance estable"}',
                },
              },
            ],
            usage: {
              prompt_tokens: 110,
              completion_tokens: 40,
              total_tokens: 150,
            },
          },
        }
      },
    }

    const adapter = createOpenAIProviderAdapter({
      apiKey: 'sk-test',
      model: 'gpt-4.1-mini',
      transport,
    })
    const request = createFixtureRequest()

    const mapped = mapPromptToOpenAIRequest(request.prompt, {
      model: request.metadata.model,
      temperature: request.metadata.temperature,
      maxOutputTokens: request.metadata.maxOutputTokens,
      responseFormat: request.metadata.responseFormat,
    })

    expect(mapped.messages).toEqual([
      {
        role: 'system',
        content: 'Actua como asistente financiero.',
      },
      {
        role: 'user',
        content: 'Resume mi balance mensual.',
      },
    ])
    expect(mapped.response_format).toEqual({ type: 'json_object' })

    const result = await adapter.executePrompt(request)

    expect(captured).toHaveLength(1)
    expect(captured[0].payload).toEqual(mapped)
    expect(result.kind).toBe('success')
    if (result.kind === 'failure') {
      throw new Error(`Expected success but got ${result.code}`)
    }

    expect(result.response.finishReason).toBe('STOP')
    expect(result.response.content).toBe('{"summary":"balance estable"}')
    expect(result.response.usage.totalTokens).toBe(150)
    expect(result.response.metadata.providerId).toBe('OPENAI')
  })

  it('exposes capabilities, availability and provider resolution centrally', async () => {
    const adapter = createOpenAIProviderAdapter({
      apiKey: 'sk-test',
      model: 'gpt-4.1-mini',
      availabilityProbe: async () => true,
      transport: {
        async execute() {
          throw new Error('not expected')
        },
      },
    })

    const provider = createProvider({ adapter })
    const capabilities = provider.getCapabilities()

    expect(validateAIProviderCapabilities(capabilities)).toBeNull()
    expect(capabilities.supportsJson).toBe(true)
    expect(await provider.isAvailable()).toBe(true)

    const resolution = resolveProvider({
      providerId: 'OPENAI',
      adapters: [adapter],
    })

    expect(resolution.kind).toBe('success')
    if (resolution.kind === 'failure') {
      throw new Error(`Expected success but got ${resolution.code}`)
    }

    expect(resolution.provider.providerId).toBe('OPENAI')
  })

  it('maps provider failures to typed domain errors', async () => {
    const request = createFixtureRequest()
    const rateLimited = createOpenAIProviderAdapter({
      apiKey: 'sk-test',
      model: 'gpt-4.1-mini',
      transport: {
        async execute() {
          const error = new Error('rate limited') as Error & {
            readonly status?: number
          }
          Object.assign(error, { status: 429 })
          throw error
        },
      },
    })

    const timeout = createOpenAIProviderAdapter({
      apiKey: 'sk-test',
      model: 'gpt-4.1-mini',
      transport: {
        async execute() {
          const error = new Error('timed out')
          Object.defineProperty(error, 'name', { value: 'AbortError' })
          throw error
        },
      },
    })

    const rateLimitedResult = await rateLimited.executePrompt(request)
    const timeoutResult = await timeout.executePrompt(request)

    expect(rateLimitedResult.kind).toBe('failure')
    if (rateLimitedResult.kind === 'failure') {
      expect(rateLimitedResult.code).toBe('RATE_LIMITED')
      expect(rateLimitedResult.retryable).toBe(true)
    }

    expect(timeoutResult.kind).toBe('failure')
    if (timeoutResult.kind === 'failure') {
      expect(timeoutResult.code).toBe('PROVIDER_TIMEOUT')
      expect(timeoutResult.retryable).toBe(true)
    }
  })
})

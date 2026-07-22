import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAutomationGatewayConfig } = vi.hoisted(() => ({
  getAutomationGatewayConfig: vi.fn(),
}))

vi.mock('../src/services/automationHubService', () => ({
  getAutomationGatewayConfig,
}))

import {
  __resetDefaultAIConversationApplicationServiceForTests,
  createDefaultAIConversationApplicationService,
} from '../src/application/ai-conversation'

describe('AI conversation provider activation (Milestone 11B)', () => {
  beforeEach(() => {
    __resetDefaultAIConversationApplicationServiceForTests()
    getAutomationGatewayConfig.mockReset()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('fails closed and does not fall back to preview when production config is missing', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const service = createDefaultAIConversationApplicationService()
    const started = service.startConversation({
      userDisplayName: 'Usuario',
      assistantDisplayName: 'Private Balance AI',
    })

    expect(started.kind).toBe('success')
    if (started.kind !== 'success') {
      throw new Error('Expected started session')
    }

    const result = await service.sendMessage({
      session: started.value,
      message: 'Hola IA',
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('AI_UNAVAILABLE')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('uses the certified OpenAI adapter through the authorized proxy when production config is valid', async () => {
    vi.stubEnv('VITE_AI_PROVIDER', 'OPENAI')
    vi.stubEnv('VITE_AI_OPENAI_MODEL', 'gpt-4.1-mini')
    vi.stubEnv('VITE_AI_OPENAI_TIMEOUT_MS', '4500')

    getAutomationGatewayConfig.mockResolvedValue({
      baseUrl: 'https://private-balance.example.com',
      bearerToken: 'jwt-token',
    })

    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://private-balance.example.com/api/ai-provider-openai')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token')

      return new Response(JSON.stringify({
        id: 'chatcmpl_remote_002',
        model: 'gpt-4.1-mini',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: 'Respuesta remota mediante OpenAIProviderAdapter.',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 25,
          total_tokens: 125,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const service = createDefaultAIConversationApplicationService()
    const started = service.startConversation({
      userDisplayName: 'Usuario',
      assistantDisplayName: 'Private Balance AI',
    })

    if (started.kind !== 'success') {
      throw new Error('Expected started session')
    }

    const result = await service.sendMessage({
      session: started.value,
      message: 'Hola IA',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.value.assistantMessage.content.value).toBe(
        'Respuesta remota mediante OpenAIProviderAdapter.',
      )
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})

import type {
  AIProvider,
} from './aiProviderContracts'
import {
  createMockAIProvider,
  type CreateMockAIProviderInput,
} from './mockAIProvider'
import {
  createConfiguredOpenAIProvider,
} from './openAIFactory'
import {
  resolveAIProviderStrategyFromEnvironment,
  resolveOpenAIProviderConfiguration,
  type AIProviderStrategy,
} from './openAIConfiguration'
import {
  recordRuntimeProviderAudit,
} from '../ai-conversation/provider-orchestration/runtimeConversationAudit'

export interface CreateAIProviderInput extends CreateMockAIProviderInput {
  readonly strategy?: AIProviderStrategy
  readonly environment?: Readonly<Record<string, unknown>>
}

export function createAIProvider(
  input: CreateAIProviderInput = {},
): AIProvider {
  const strategy = input.strategy ?? resolveAIProviderStrategyFromEnvironment({
    environment: input.environment,
  })

  const openAIConfiguration = resolveOpenAIProviderConfiguration({
    environment: input.environment,
  })

  function record(providerId: string): void {
    if (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) {
      recordRuntimeProviderAudit({
        timestamp: new Date().toISOString(),
        strategy,
        providerExpected: strategy === 'openai' ? 'openai-provider' : 'mock-ai-provider',
        providerSelected: providerId,
        model: openAIConfiguration.kind === 'success'
          ? openAIConfiguration.configuration.conversationModel
          : null,
        openAICalled: false,
        fallbackUsed: false,
        reasonIfNotCalled: openAIConfiguration.kind === 'failure'
          ? openAIConfiguration.safeMessage
          : null,
      })
    }
  }

  if (strategy === 'mock') {
    const provider = createMockAIProvider(input)
    record(provider.metadata.providerId)
    return provider
  }

  if (strategy === 'openai') {
    const provider = createConfiguredOpenAIProvider({
      environment: input.environment,
    })
    record(provider.metadata.providerId)
    return provider
  }

  const provider = createMockAIProvider(input)
  record(provider.metadata.providerId)
  return provider
}

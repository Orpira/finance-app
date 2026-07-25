import {
  createAIProvider,
  resolveAIProviderStrategyFromEnvironment,
  resolveOpenAIProviderConfiguration,
} from '../../ai-provider/aiProvider'

export interface ProviderRuntimeValidationResult {
  readonly strategy: 'mock' | 'openai'
  readonly providerExpected: string
  readonly providerSelected: string
  readonly model: string | null
  readonly openAIConfigured: boolean
  readonly openAIConfigurationError: string | null
}

export function validateProviderRuntime(): ProviderRuntimeValidationResult {
  const strategy = resolveAIProviderStrategyFromEnvironment()
  const provider = createAIProvider({
    strategy,
  })
  const openAIConfig = resolveOpenAIProviderConfiguration()

  return {
    strategy,
    providerExpected: strategy === 'openai' ? 'openai-provider' : 'mock-ai-provider',
    providerSelected: provider.metadata.providerId,
    model: openAIConfig.kind === 'success'
      ? openAIConfig.configuration.conversationModel
      : null,
    openAIConfigured: openAIConfig.kind === 'success',
    openAIConfigurationError: openAIConfig.kind === 'failure'
      ? openAIConfig.safeMessage
      : null,
  }
}

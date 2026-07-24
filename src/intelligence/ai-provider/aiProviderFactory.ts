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
  type AIProviderStrategy,
} from './openAIConfiguration'

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

  if (strategy === 'mock') {
    return createMockAIProvider(input)
  }

  if (strategy === 'openai') {
    return createConfiguredOpenAIProvider({
      environment: input.environment,
    })
  }

  return createMockAIProvider(input)
}

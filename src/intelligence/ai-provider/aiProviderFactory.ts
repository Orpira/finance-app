import type {
  AIProvider,
} from './aiProviderContracts'
import {
  createMockAIProvider,
  type CreateMockAIProviderInput,
} from './mockAIProvider'

export interface CreateAIProviderInput extends CreateMockAIProviderInput {
  readonly strategy?: 'mock'
}

export function createAIProvider(
  input: CreateAIProviderInput = {},
): AIProvider {
  const strategy = input.strategy ?? 'mock'

  if (strategy === 'mock') {
    return createMockAIProvider(input)
  }

  return createMockAIProvider(input)
}

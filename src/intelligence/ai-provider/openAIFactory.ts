import type { AIProvider } from './aiProviderContracts'
import {
  createOpenAIProvider,
  type CreateOpenAIProviderInput,
} from './openAIProvider'

export function createConfiguredOpenAIProvider(
  input: CreateOpenAIProviderInput = {},
): AIProvider {
  return createOpenAIProvider(input)
}

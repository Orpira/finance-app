import type {
  AIProvider,
  AIProviderAdapter,
} from './aiProviderContracts'

export function createAIProvider(input: { readonly adapter: AIProviderAdapter }): AIProvider {
  return {
    providerId: input.adapter.providerId,
    executePrompt(request) {
      return input.adapter.executePrompt(request)
    },
    getCapabilities() {
      return input.adapter.getCapabilities()
    },
    isAvailable() {
      return input.adapter.isAvailable()
    },
  }
}

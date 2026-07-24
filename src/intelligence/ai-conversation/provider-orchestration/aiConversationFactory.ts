import {
  createAIProvider,
  createMockAIProvider,
  type CreateAIProviderInput,
} from '../../ai-provider/aiProvider'
import type {
  AIConversationFacade,
} from '../aiConversationFacadeContracts'
import type {
  AIConversationService,
  AIConversationServiceDependencies,
} from './aiConversationContracts'
import {
  createNoopAIConversationMetricsRecorder,
} from './aiConversationMetrics'
import {
  createAIConversationService,
} from './aiConversationService'

export interface CreateAIConversationServiceInput {
  readonly facade: AIConversationFacade
  readonly providerInput?: CreateAIProviderInput
  readonly confidenceThreshold?: number
  readonly now?: () => string
  readonly clock?: () => number
  readonly metrics?: AIConversationServiceDependencies['metrics']
}

export function createConfiguredAIConversationService(
  input: CreateAIConversationServiceInput,
): AIConversationService {
  const provider = createAIProvider(input.providerInput)
  const fallbackProvider = createMockAIProvider()

  return createAIConversationService({
    facade: input.facade,
    provider,
    fallbackProvider,
    confidencePolicy: {
      confidenceThreshold: input.confidenceThreshold ?? 0.7,
    },
    now: input.now,
    clock: input.clock,
    metrics: input.metrics ?? createNoopAIConversationMetricsRecorder(),
  })
}

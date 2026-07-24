import type {
  IntentResolverProvider,
} from '../../ai-provider/aiProviderContracts'
import type {
  AIToolResolver,
} from '../../ai-tools'
import {
  createActivationEngine,
} from './activationEngine'
import type {
  ActivationEngine,
  ActivationMetricsRecorder,
  ActivationPolicy,
} from './activationContracts'
import {
  createNoopActivationMetricsRecorder,
} from './activationMetrics'
import {
  createActivationPolicy,
} from './activationPolicy'

export interface CreateActivationEngineInput {
  readonly primaryProviderId: string
  readonly fallbackProviderId: string
  readonly primaryIntentResolver?: IntentResolverProvider['resolveIntent']
  readonly fallbackIntentResolver?: IntentResolverProvider['resolveIntent']
  readonly toolResolver: AIToolResolver
  readonly policy?: Partial<ActivationPolicy>
  readonly metrics?: ActivationMetricsRecorder
  readonly now?: () => string
  readonly clock?: () => number
}

export function createActivationEngineFromResolver(
  input: CreateActivationEngineInput,
): ActivationEngine {
  return createActivationEngine({
    primaryProviderId: input.primaryProviderId,
    fallbackProviderId: input.fallbackProviderId,
    primaryIntentResolver: input.primaryIntentResolver,
    fallbackIntentResolver: input.fallbackIntentResolver,
    routingStrategy: {
      exists(toolId: string): boolean {
        return input.toolResolver.exists(toolId)
      },
    },
    policy: createActivationPolicy(input.policy),
    metrics: input.metrics ?? createNoopActivationMetricsRecorder(),
    now: input.now,
    clock: input.clock,
  })
}

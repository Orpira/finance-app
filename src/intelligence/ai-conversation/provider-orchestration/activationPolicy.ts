import type {
  ActivationPolicy,
} from './activationContracts'
import {
  validateActivationPolicy,
} from './activationValidator'

export const DEFAULT_ACTIVATION_POLICY: ActivationPolicy = {
  minimumConfidence: 0.7,
  enableFallback: true,
  enableAIExplanation: true,
  enableDirectTools: true,
}

export function createActivationPolicy(
  input: Partial<ActivationPolicy> = {},
): ActivationPolicy {
  const policy: ActivationPolicy = {
    minimumConfidence: input.minimumConfidence ?? DEFAULT_ACTIVATION_POLICY.minimumConfidence,
    enableFallback: input.enableFallback ?? DEFAULT_ACTIVATION_POLICY.enableFallback,
    enableAIExplanation: input.enableAIExplanation ?? DEFAULT_ACTIVATION_POLICY.enableAIExplanation,
    enableDirectTools: input.enableDirectTools ?? DEFAULT_ACTIVATION_POLICY.enableDirectTools,
  }

  const validation = validateActivationPolicy(policy)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return policy
}

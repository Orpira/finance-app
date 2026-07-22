import type { AIInteraction } from '../aiInteractionContracts'
import { validateAIInteraction } from '../aiInteractionValidator'
import type { AIInteractionPolicyEvaluationContext } from './aiInteractionPolicy'
import { AIInteractionPolicyRegistry } from './aiInteractionPolicyRegistry'
import type { AIInteractionPolicyDecision } from './policyDecision'

export class AIInteractionPolicyEngine {
  private readonly registry: AIInteractionPolicyRegistry

  constructor(registry: AIInteractionPolicyRegistry) {
    this.registry = registry
  }

  evaluate(
    interaction: AIInteraction,
    context: AIInteractionPolicyEvaluationContext,
  ): AIInteractionPolicyDecision {
    const validationFailure = validateAIInteraction(interaction)
    if (validationFailure) {
      return {
        kind: 'DENY',
        policyId: interaction.policy.policyId,
        policyVersion: interaction.policy.policyVersion,
        reasonCodes: ['INVALID_INTERACTION'],
      }
    }

    const policy = this.registry.resolve(
      interaction.policy.policyId,
      interaction.policy.policyVersion,
    )
    if (!policy) {
      return {
        kind: 'DENY',
        policyId: interaction.policy.policyId,
        policyVersion: interaction.policy.policyVersion,
        reasonCodes: ['POLICY_NOT_FOUND'],
      }
    }

    return policy.evaluate(interaction, context)
  }
}

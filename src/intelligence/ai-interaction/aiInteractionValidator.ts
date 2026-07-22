import {
  AI_INTERACTION_CAPABILITIES,
  AI_INTERACTION_INTENTS,
  AI_INTERACTION_PROTOCOL_VERSION,
  AI_INTERACTION_STATUSES,
  type AIInteraction,
  type AIInteractionFailure,
} from './aiInteractionContracts'

const intents = new Set<string>(AI_INTERACTION_INTENTS)
const capabilities = new Set<string>(AI_INTERACTION_CAPABILITIES)
const statuses = new Set<string>(AI_INTERACTION_STATUSES)

export function validateAIInteraction(
  interaction: AIInteraction,
): AIInteractionFailure | null {
  if (
    interaction.protocolVersion !== AI_INTERACTION_PROTOCOL_VERSION ||
    interaction.interactionId.trim().length === 0 ||
    !intents.has(interaction.intent) ||
    !statuses.has(interaction.status) ||
    interaction.requiredCapabilities.length === 0 ||
    interaction.requiredCapabilities.some((value) => !capabilities.has(value)) ||
    new Set(interaction.requiredCapabilities).size !== interaction.requiredCapabilities.length ||
    interaction.policy.policyId.trim().length === 0 ||
    interaction.policy.policyVersion.trim().length === 0 ||
    interaction.metadata.createdAt.trim().length === 0
  ) {
    return {
      kind: 'failure',
      interactionId: interaction.interactionId,
      code: 'INVALID_INTERACTION',
      retryable: false,
      safeMessage: 'The AI interaction contract is invalid.',
    }
  }

  return null
}

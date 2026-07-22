import type { AIInteractionPolicy } from './aiInteractionPolicy'
import type { AIInteractionPolicyDecision } from './policyDecision'

function decision(
  policy: Pick<AIInteractionPolicy, 'policyId' | 'policyVersion'>,
  kind: AIInteractionPolicyDecision['kind'],
  reasonCode: string,
): AIInteractionPolicyDecision {
  return {
    kind,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    reasonCodes: [reasonCode],
  }
}

export function createDeterministicInteractionPolicy(
  definition: Omit<AIInteractionPolicy, 'evaluate'>,
): AIInteractionPolicy {
  const policy: AIInteractionPolicy = {
    ...definition,
    evaluate(interaction, context) {
      if (!policy.featureAvailable) {
        return decision(policy, 'UNSUPPORTED', 'FEATURE_NOT_AVAILABLE')
      }
      if (interaction.policy.purpose !== interaction.intent) {
        return decision(policy, 'DENY', 'PURPOSE_MISMATCH')
      }
      if (!policy.allowedIntents.includes(interaction.intent)) {
        return decision(policy, 'DENY', 'INTENT_NOT_ALLOWED')
      }
      if (!policy.allowedProcessingModes.includes(interaction.policy.processingMode)) {
        return decision(policy, 'DENY', 'PROCESSING_MODE_NOT_ALLOWED')
      }
      if (
        interaction.requiredCapabilities.some(
          (capability) => !policy.allowedCapabilities.includes(capability),
        )
      ) {
        return decision(policy, 'UNSUPPORTED', 'CAPABILITY_NOT_ALLOWED')
      }
      if (policy.requireAuthorizedContext && !context.hasAuthorizedContext) {
        return decision(policy, 'REQUIRE_CONTEXT', 'CONTEXT_REQUIRED')
      }
      if (policy.requireUserConfirmation && !context.hasUserConfirmation) {
        return decision(policy, 'REQUIRE_CONFIRMATION', 'CONFIRMATION_REQUIRED')
      }
      if (
        policy.requireRedactionForSensitiveData &&
        context.containsSensitiveData &&
        !context.redactionApplied
      ) {
        return decision(policy, 'REQUIRE_REDACTION', 'REDACTION_REQUIRED')
      }
      return decision(policy, 'ALLOW', 'POLICY_REQUIREMENTS_SATISFIED')
    },
  }
  return policy
}

export const DEFAULT_FINANCIAL_EXPLANATION_POLICY =
  createDeterministicInteractionPolicy({
    policyId: 'financial-explanation',
    policyVersion: '1.0.0',
    allowedIntents: [
      'EXPLAIN_INSIGHT',
      'SUMMARIZE_FINANCIAL_STATE',
      'GENERATE_ACTION_OPTIONS',
      'EDUCATIONAL_GUIDANCE',
      'DIAGNOSTIC_ANALYSIS',
    ],
    allowedCapabilities: [
      'TEXT_GENERATION',
      'STRUCTURED_OUTPUT',
      'CONTEXT_GROUNDING',
      'EXPLANATION',
    ],
    allowedProcessingModes: ['LOCAL_ONLY', 'EXTERNAL_PROVIDER'],
    requireAuthorizedContext: true,
    requireUserConfirmation: false,
    requireRedactionForSensitiveData: true,
    featureAvailable: true,
  })

export const DEFAULT_CLASSIFICATION_POLICY =
  createDeterministicInteractionPolicy({
    policyId: 'query-classification',
    policyVersion: '1.0.0',
    allowedIntents: ['CLASSIFY_USER_QUERY'],
    allowedCapabilities: ['CLASSIFICATION', 'STRUCTURED_OUTPUT'],
    allowedProcessingModes: ['LOCAL_ONLY', 'EXTERNAL_PROVIDER'],
    requireAuthorizedContext: false,
    requireUserConfirmation: false,
    requireRedactionForSensitiveData: true,
    featureAvailable: true,
  })

export const DEFAULT_UNAVAILABLE_FEATURE_POLICY =
  createDeterministicInteractionPolicy({
    policyId: 'unavailable-feature',
    policyVersion: '1.0.0',
    allowedIntents: [],
    allowedCapabilities: [],
    allowedProcessingModes: [],
    requireAuthorizedContext: false,
    requireUserConfirmation: false,
    requireRedactionForSensitiveData: false,
    featureAvailable: false,
  })

export const DEFAULT_AI_INTERACTION_POLICIES = [
  DEFAULT_FINANCIAL_EXPLANATION_POLICY,
  DEFAULT_CLASSIFICATION_POLICY,
  DEFAULT_UNAVAILABLE_FEATURE_POLICY,
] as const

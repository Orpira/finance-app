import type { AIProcessingMode } from '../../ai-foundation/aiFoundationContracts'
import type {
  AIInteraction,
  AIInteractionCapability,
  AIInteractionIntent,
} from '../aiInteractionContracts'
import type { AIInteractionPolicyDecision } from './policyDecision'

export interface AIInteractionPolicyEvaluationContext {
  readonly hasAuthorizedContext: boolean
  readonly hasUserConfirmation: boolean
  readonly containsSensitiveData: boolean
  readonly redactionApplied: boolean
}

export interface AIInteractionPolicy {
  readonly policyId: string
  readonly policyVersion: string
  readonly allowedIntents: readonly AIInteractionIntent[]
  readonly allowedCapabilities: readonly AIInteractionCapability[]
  readonly allowedProcessingModes: readonly AIProcessingMode[]
  readonly requireAuthorizedContext: boolean
  readonly requireUserConfirmation: boolean
  readonly requireRedactionForSensitiveData: boolean
  readonly featureAvailable: boolean
  evaluate(
    interaction: AIInteraction,
    context: AIInteractionPolicyEvaluationContext,
  ): AIInteractionPolicyDecision
}

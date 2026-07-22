export const AI_INTERACTION_POLICY_VIOLATION_CODES = [
  'INVALID_INTERACTION',
  'POLICY_NOT_FOUND',
  'POLICY_VERSION_MISMATCH',
  'PURPOSE_MISMATCH',
  'PROCESSING_MODE_NOT_ALLOWED',
  'INTENT_NOT_ALLOWED',
  'CAPABILITY_NOT_ALLOWED',
  'CONFIRMATION_REQUIRED',
  'REDACTION_REQUIRED',
  'CONTEXT_REQUIRED',
  'FEATURE_NOT_AVAILABLE',
] as const

export type AIInteractionPolicyViolationCode =
  (typeof AI_INTERACTION_POLICY_VIOLATION_CODES)[number]

export interface AIInteractionPolicyViolation {
  readonly code: AIInteractionPolicyViolationCode
  readonly safeMessage: string
}

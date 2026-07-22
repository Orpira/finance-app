export const AI_INTERACTION_POLICY_DECISIONS = [
  'ALLOW',
  'DENY',
  'REQUIRE_CONFIRMATION',
  'REQUIRE_REDACTION',
  'REQUIRE_CONTEXT',
  'UNSUPPORTED',
] as const

export type AIInteractionPolicyDecisionKind =
  (typeof AI_INTERACTION_POLICY_DECISIONS)[number]

export interface AIInteractionPolicyDecision {
  readonly kind: AIInteractionPolicyDecisionKind
  readonly policyId: string
  readonly policyVersion: string
  readonly reasonCodes: readonly string[]
}

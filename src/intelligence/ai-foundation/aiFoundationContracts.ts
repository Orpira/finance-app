import type {
  SnapshotJsonObject,
  SnapshotJsonValue,
} from '../../types/financialSnapshot'

export const AI_PRIVACY_PROTOCOL_VERSION = 1 as const
export const AI_PRIVACY_POLICY_VERSION = 'ai-privacy-policy/1.0.0' as const

export const AI_PROCESSING_MODES = [
  'LOCAL_ONLY',
  'EXTERNAL_PROVIDER',
] as const

export type AIProcessingMode = (typeof AI_PROCESSING_MODES)[number]

export const AI_DATA_CLASSIFICATIONS = [
  'PUBLIC',
  'INTERNAL',
  'PERSONAL',
  'FINANCIAL',
  'HIGHLY_SENSITIVE_FINANCIAL',
  'CREDENTIAL_OR_SECRET',
] as const

export type AIDataClassification = (typeof AI_DATA_CLASSIFICATIONS)[number]

export const AI_DATA_CLASSIFICATION_SENSITIVITY_ORDER = [
  'PUBLIC',
  'INTERNAL',
  'PERSONAL',
  'FINANCIAL',
  'HIGHLY_SENSITIVE_FINANCIAL',
  'CREDENTIAL_OR_SECRET',
] as const satisfies readonly AIDataClassification[]

export const AI_DATA_CATEGORIES = [
  'INSIGHT_SUMMARY',
  'INSIGHT_READ_MODEL',
  'FINANCIAL_SNAPSHOT',
  'KNOWLEDGE_COLLECTION',
  'USER_PROVIDED_TEXT',
  'APP_METADATA',
  'DIAGNOSTIC_METADATA',
] as const

export type AIDataCategory = (typeof AI_DATA_CATEGORIES)[number]

export const AI_ALLOWED_PURPOSES = [
  'EXPLAIN_INSIGHT',
  'SUMMARIZE_FINANCIAL_STATE',
  'EDUCATIONAL_GUIDANCE',
  'GENERATE_ACTION_OPTIONS',
  'CLASSIFY_USER_QUERY',
  'DIAGNOSTIC_ANALYSIS',
] as const

export type AIAllowedPurpose = (typeof AI_ALLOWED_PURPOSES)[number]

export const AI_PROHIBITED_PURPOSES = [
  'EXECUTE_TRANSACTION',
  'MODIFY_FINANCIAL_DATA',
  'CHANGE_BUDGET_AUTOMATICALLY',
  'SHARE_DATA_WITH_THIRD_PARTIES',
  'TRAIN_EXTERNAL_MODEL',
  'PROFILE_FOR_ADVERTISING',
  'MAKE_HIGH_STAKES_DECISION_AUTONOMOUSLY',
] as const

export type AIProhibitedPurpose = (typeof AI_PROHIBITED_PURPOSES)[number]

export const AI_PURPOSES = [
  ...AI_ALLOWED_PURPOSES,
  ...AI_PROHIBITED_PURPOSES,
] as const

export type AIPurpose = (typeof AI_PURPOSES)[number]

export const AI_CONSENT_STATUSES = [
  'ACTIVE',
  'REVOKED',
  'INVALID',
] as const

export type AIConsentStatus = (typeof AI_CONSENT_STATUSES)[number]

export type AIRetentionDirective =
  | 'PROHIBITED'
  | 'EPHEMERAL'

export type AITrainingDirective =
  | 'PROHIBITED'
  | 'ALLOW_EXTERNAL'

export type AILoggingDirective =
  | 'NONE'
  | 'METADATA_ONLY'
  | 'CONTENT'

export interface AIDataReference {
  readonly referenceId: string
  readonly category: AIDataCategory
  readonly classification: AIDataClassification
  readonly selector: string
  readonly metadata?: SnapshotJsonObject
}

export interface AIConsentScope {
  readonly scopeId: string
  readonly purpose: AIPurpose
  readonly dataCategories: readonly AIDataCategory[]
  readonly processingModes: readonly AIProcessingMode[]
  readonly maxClassification: AIDataClassification
  readonly policyVersion: string
  readonly policyProtocolVersion: number
}

export interface AIConsentConfirmationEvidence {
  readonly evidenceId: string
  readonly evidenceType:
    | 'user-confirmation'
    | 'signed-record'
    | 'contract-acceptance'
  readonly evidenceDigest: string
}

export interface AIConsentRevocation {
  readonly revocable: boolean
  readonly revoked: boolean
  readonly revocationCode?: string
}

export interface AIConsentValidity {
  readonly kind:
    | 'policy-version-bound'
    | 'request-bound'
  readonly value: string
}

export interface AIConsentRecord {
  readonly consentId: string
  readonly consentTextVersion: string
  readonly policyVersion: string
  readonly policyProtocolVersion: number
  readonly status: AIConsentStatus
  readonly scope: AIConsentScope
  readonly revocation: AIConsentRevocation
  readonly confirmation: AIConsentConfirmationEvidence
  readonly validity?: AIConsentValidity
  readonly metadata?: SnapshotJsonObject
}

export interface AIMinimizationDeclaration {
  readonly applied: boolean
  readonly strategyCodes: readonly string[]
}

export interface AIRedactionDeclaration {
  readonly applied: boolean
  readonly strategyCodes: readonly string[]
}

export interface AIPrivacyTraceabilityInput {
  readonly traceId: string
  readonly relationId: string
  readonly requestId: string
  readonly policyId: string
  readonly policyVersion: string
  readonly consentId: string | null
  readonly purpose: string
  readonly processingMode: string
  readonly dataCategories: readonly string[]
}

export interface AIPrivacyModePolicy {
  readonly mode: AIProcessingMode
  readonly allowedClassifications: readonly AIDataClassification[]
  readonly allowedDataCategories: readonly AIDataCategory[]
  readonly consentRequired: boolean
  readonly specificPurposeRequired: boolean
  readonly minimizationRequired: boolean
  readonly redactionRequired: boolean
  readonly allowedRetention: readonly AIRetentionDirective[]
  readonly allowedTraining: readonly AITrainingDirective[]
  readonly allowedLogging: readonly AILoggingDirective[]
}

export interface AIForbiddenCombination {
  readonly combinationId: string
  readonly mode?: AIProcessingMode
  readonly purpose?: AIPurpose
  readonly dataCategory?: AIDataCategory
  readonly dataClassification?: AIDataClassification
  readonly retention?: AIRetentionDirective
  readonly training?: AITrainingDirective
  readonly logging?: AILoggingDirective
  readonly failureCode: AIPrivacyFailureCode
}

export interface AITraceabilityLimits {
  readonly allowSensitiveContent: false
  readonly allowUserText: false
  readonly allowDomainPayloads: false
  readonly maxCategoryCount: number
}

export interface AIPrivacyPolicy {
  readonly policyId: string
  readonly policyVersion: string
  readonly protocolVersion: number
  readonly supportedProtocols: readonly number[]
  readonly defaultDecision: 'DENY'
  readonly allowedProcessingModes: readonly AIProcessingMode[]
  readonly allowedPurposes: readonly AIAllowedPurpose[]
  readonly prohibitedPurposes: readonly AIProhibitedPurpose[]
  readonly modePolicies: readonly AIPrivacyModePolicy[]
  readonly forbiddenCombinations: readonly AIForbiddenCombination[]
  readonly requireExactConsentPolicyVersion: true
  readonly requireCanonicalOrdering: true
  readonly traceabilityLimits: AITraceabilityLimits
}

export interface AIContextBuilderConstraint {
  readonly code: string
  readonly requirement: string
}

export interface AIPrivacyAuthorizationRequest {
  readonly requestId: string
  readonly protocolVersion: number
  readonly purpose: AIPurpose
  readonly processingMode: AIProcessingMode
  readonly dataReferences: readonly AIDataReference[]
  readonly policy?: AIPrivacyPolicy
  readonly consent?: AIConsentRecord
  readonly retention: AIRetentionDirective
  readonly training: AITrainingDirective
  readonly logging: AILoggingDirective
  readonly minimization: AIMinimizationDeclaration
  readonly redaction: AIRedactionDeclaration
  readonly traceability: AIPrivacyTraceabilityInput
  readonly contextBuilderConstraints?: readonly AIContextBuilderConstraint[]
}

export const AI_PRIVACY_FAILURE_CODES = [
  'INVALID_REQUEST',
  'MISSING_POLICY',
  'UNSUPPORTED_POLICY_VERSION',
  'UNSUPPORTED_PROTOCOL',
  'MISSING_CONSENT',
  'INVALID_CONSENT',
  'REVOKED_CONSENT',
  'CONSENT_PURPOSE_MISMATCH',
  'CONSENT_DATA_SCOPE_MISMATCH',
  'CONSENT_PROCESSING_MODE_MISMATCH',
  'PURPOSE_NOT_ALLOWED',
  'DATA_CATEGORY_NOT_ALLOWED',
  'DATA_CLASSIFICATION_NOT_ALLOWED',
  'PROCESSING_MODE_NOT_ALLOWED',
  'EXTERNAL_PROCESSING_NOT_AUTHORIZED',
  'SECRET_DATA_PROHIBITED',
  'RETENTION_POLICY_VIOLATION',
  'TRAINING_POLICY_VIOLATION',
  'LOGGING_POLICY_VIOLATION',
  'REDACTION_REQUIRED',
  'MINIMIZATION_REQUIRED',
  'POLICY_CONFLICT',
  'TRACEABILITY_MISMATCH',
  'INCONSISTENT_AUTHORIZATION_RESULT',
] as const

export type AIPrivacyFailureCode = (typeof AI_PRIVACY_FAILURE_CODES)[number]

export interface AIPrivacyTraceability {
  readonly traceId: string | null
  readonly relationId: string | null
  readonly requestId: string | null
  readonly policyId: string | null
  readonly policyVersion: string | null
  readonly consentId: string | null
  readonly purpose: string | null
  readonly processingMode: string | null
  readonly categories: readonly AIDataCategory[]
  readonly maxClassification: AIDataClassification | null
  readonly decision:
    | 'authorized'
    | 'rejected'
  readonly failureCode?: AIPrivacyFailureCode
  readonly relation: {
    readonly requestToPolicy:
      | 'matched'
      | 'missing'
      | 'mismatch'
    readonly requestToConsent:
      | 'matched'
      | 'not-required'
      | 'missing'
      | 'mismatch'
  }
}

export interface AIAuthorizedDataReference {
  readonly referenceId: string
  readonly category: AIDataCategory
  readonly classification: AIDataClassification
  readonly selector: string
}

export interface AIAuthorizedRequestEnvelope {
  readonly requestId: string
  readonly purpose: AIAllowedPurpose
  readonly processingMode: AIProcessingMode
  readonly authorizedDataReferences: readonly AIAuthorizedDataReference[]
  readonly authorizedCategories: readonly AIDataCategory[]
  readonly maxAuthorizedClassification: AIDataClassification
  readonly policy: {
    readonly policyId: string
    readonly policyVersion: string
    readonly protocolVersion: number
  }
  readonly consent: {
    readonly consentId: string
    readonly status: AIConsentStatus
    readonly scopeId: string
    readonly consentTextVersion: string
    readonly policyVersion: string
  } | null
  readonly requirements: {
    readonly minimizationRequired: boolean
    readonly minimizationApplied: boolean
    readonly minimizationStrategyCodes: readonly string[]
    readonly redactionRequired: boolean
    readonly redactionApplied: boolean
    readonly redactionStrategyCodes: readonly string[]
    readonly contextBuilderConstraints: readonly AIContextBuilderConstraint[]
  }
  readonly governance: {
    readonly retention: AIRetentionDirective
    readonly training: AITrainingDirective
    readonly logging: AILoggingDirective
  }
  readonly traceability: AIPrivacyTraceability
}

export interface AIPrivacyAuthorizationSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly envelope: AIAuthorizedRequestEnvelope
  readonly traceability: AIPrivacyTraceability
}

export interface AIPrivacyAuthorizationFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly code: AIPrivacyFailureCode
  readonly message: string
  readonly traceability: AIPrivacyTraceability
  readonly details?: Readonly<Record<string, SnapshotJsonValue | null>>
}

export type AIPrivacyAuthorizationResult =
  | AIPrivacyAuthorizationSuccess
  | AIPrivacyAuthorizationFailure

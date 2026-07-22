import {
  AI_ALLOWED_PURPOSES,
  AI_DATA_CATEGORIES,
  AI_PRIVACY_POLICY_VERSION,
  AI_PRIVACY_PROTOCOL_VERSION,
  AI_PROHIBITED_PURPOSES,
  type AIPrivacyModePolicy,
  type AIPrivacyPolicy,
} from './aiFoundationContracts'

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry)) as T
  }

  const cloned: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    cloned[key] = deepClone(entry)
  }

  return cloned as T
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry)
    }
    return Object.freeze(value)
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry)
  }

  return Object.freeze(value)
}

const LOCAL_ONLY_MODE_POLICY: AIPrivacyModePolicy = {
  mode: 'LOCAL_ONLY',
  allowedClassifications: [
    'PUBLIC',
    'INTERNAL',
    'PERSONAL',
    'FINANCIAL',
    'HIGHLY_SENSITIVE_FINANCIAL',
  ],
  allowedDataCategories: [...AI_DATA_CATEGORIES],
  consentRequired: false,
  specificPurposeRequired: true,
  minimizationRequired: true,
  redactionRequired: false,
  allowedRetention: ['PROHIBITED', 'EPHEMERAL'],
  allowedTraining: ['PROHIBITED'],
  allowedLogging: ['NONE', 'METADATA_ONLY'],
}

const EXTERNAL_PROVIDER_MODE_POLICY: AIPrivacyModePolicy = {
  mode: 'EXTERNAL_PROVIDER',
  allowedClassifications: ['PUBLIC', 'INTERNAL', 'PERSONAL'],
  allowedDataCategories: [
    'INSIGHT_SUMMARY',
    'INSIGHT_READ_MODEL',
    'USER_PROVIDED_TEXT',
    'APP_METADATA',
    'DIAGNOSTIC_METADATA',
  ],
  consentRequired: true,
  specificPurposeRequired: true,
  minimizationRequired: true,
  redactionRequired: true,
  allowedRetention: ['PROHIBITED'],
  allowedTraining: ['PROHIBITED'],
  allowedLogging: ['NONE', 'METADATA_ONLY'],
}

const DEFAULT_POLICY: AIPrivacyPolicy = deepFreeze({
  policyId: 'private-balance-ai-privacy-default',
  policyVersion: AI_PRIVACY_POLICY_VERSION,
  protocolVersion: AI_PRIVACY_PROTOCOL_VERSION,
  supportedProtocols: [AI_PRIVACY_PROTOCOL_VERSION],
  defaultDecision: 'DENY',
  allowedProcessingModes: ['LOCAL_ONLY', 'EXTERNAL_PROVIDER'],
  allowedPurposes: [...AI_ALLOWED_PURPOSES],
  prohibitedPurposes: [...AI_PROHIBITED_PURPOSES],
  modePolicies: [
    LOCAL_ONLY_MODE_POLICY,
    EXTERNAL_PROVIDER_MODE_POLICY,
  ],
  forbiddenCombinations: [
    {
      combinationId: 'forbid-secret-anywhere',
      dataClassification: 'CREDENTIAL_OR_SECRET',
      failureCode: 'SECRET_DATA_PROHIBITED',
    },
    {
      combinationId: 'forbid-external-financial-snapshot',
      mode: 'EXTERNAL_PROVIDER',
      dataCategory: 'FINANCIAL_SNAPSHOT',
      failureCode: 'DATA_CATEGORY_NOT_ALLOWED',
    },
    {
      combinationId: 'forbid-external-knowledge-collection',
      mode: 'EXTERNAL_PROVIDER',
      dataCategory: 'KNOWLEDGE_COLLECTION',
      failureCode: 'DATA_CATEGORY_NOT_ALLOWED',
    },
    {
      combinationId: 'forbid-external-financial-classification',
      mode: 'EXTERNAL_PROVIDER',
      dataClassification: 'FINANCIAL',
      failureCode: 'DATA_CLASSIFICATION_NOT_ALLOWED',
    },
    {
      combinationId: 'forbid-external-highly-sensitive-classification',
      mode: 'EXTERNAL_PROVIDER',
      dataClassification: 'HIGHLY_SENSITIVE_FINANCIAL',
      failureCode: 'DATA_CLASSIFICATION_NOT_ALLOWED',
    },
    {
      combinationId: 'forbid-external-content-logging',
      mode: 'EXTERNAL_PROVIDER',
      logging: 'CONTENT',
      failureCode: 'LOGGING_POLICY_VIOLATION',
    },
    {
      combinationId: 'forbid-external-training',
      mode: 'EXTERNAL_PROVIDER',
      training: 'ALLOW_EXTERNAL',
      failureCode: 'TRAINING_POLICY_VIOLATION',
    },
    {
      combinationId: 'forbid-external-retention',
      mode: 'EXTERNAL_PROVIDER',
      retention: 'EPHEMERAL',
      failureCode: 'RETENTION_POLICY_VIOLATION',
    },
  ],
  requireExactConsentPolicyVersion: true,
  requireCanonicalOrdering: true,
  traceabilityLimits: {
    allowSensitiveContent: false,
    allowUserText: false,
    allowDomainPayloads: false,
    maxCategoryCount: 16,
  },
})

export function createDefaultAIPrivacyPolicy(): AIPrivacyPolicy {
  return deepClone(DEFAULT_POLICY)
}

export function resolveModePolicy(
  policy: AIPrivacyPolicy,
  mode: 'LOCAL_ONLY' | 'EXTERNAL_PROVIDER',
): AIPrivacyModePolicy | null {
  for (const candidate of policy.modePolicies) {
    if (candidate.mode === mode) {
      return candidate
    }
  }

  return null
}

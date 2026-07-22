import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  AI_PRIVACY_FAILURE_CODES,
  AI_PRIVACY_POLICY_VERSION,
  AI_PRIVACY_PROTOCOL_VERSION,
  type AIConsentRecord,
  type AIDataCategory,
  type AIDataClassification,
  type AIPrivacyAuthorizationRequest,
  type AIPrivacyAuthorizationResult,
  type AIPrivacyPolicy,
} from '../src/intelligence/ai-foundation/aiFoundationContracts'
import {
  createAIPrivacyBoundary,
} from '../src/intelligence/ai-foundation/aiPrivacyBoundary'
import {
  createDefaultAIPrivacyPolicy,
} from '../src/intelligence/ai-foundation/aiPrivacyPolicy'

function asFailure(result: AIPrivacyAuthorizationResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure')
  }

  return result
}

function asSuccess(result: AIPrivacyAuthorizationResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected success but got ${result.code}`)
  }

  return result
}

const CLASSIFICATION_RANK: Record<AIDataClassification, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  PERSONAL: 2,
  FINANCIAL: 3,
  HIGHLY_SENSITIVE_FINANCIAL: 4,
  CREDENTIAL_OR_SECRET: 5,
}

const CATEGORY_RANK: Record<AIDataCategory, number> = {
  INSIGHT_SUMMARY: 0,
  INSIGHT_READ_MODEL: 1,
  FINANCIAL_SNAPSHOT: 2,
  KNOWLEDGE_COLLECTION: 3,
  USER_PROVIDED_TEXT: 4,
  APP_METADATA: 5,
  DIAGNOSTIC_METADATA: 6,
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function isJsonSafe(value: unknown, ancestors: ReadonlySet<object> = new Set()): boolean {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonSafe(item, ancestors))
  }

  if (typeof value !== 'object') {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  for (const item of Object.values(value as Record<string, unknown>)) {
    if (!isJsonSafe(item, nextAncestors)) {
      return false
    }
  }

  return true
}

function canonicalCategories(categories: readonly AIDataCategory[]): readonly AIDataCategory[] {
  const unique = new Set<AIDataCategory>()
  for (const category of categories) {
    unique.add(category)
  }

  return [...unique].sort((left, right) => CATEGORY_RANK[left] - CATEGORY_RANK[right])
}

function highestClassification(
  classifications: readonly AIDataClassification[],
): AIDataClassification {
  const ordered = [...classifications].sort(
    (left, right) => CLASSIFICATION_RANK[left] - CLASSIFICATION_RANK[right],
  )

  return ordered[ordered.length - 1] ?? 'PUBLIC'
}

function createDefaultLocalDataReferences() {
  return [
    {
      referenceId: 'data-ref:financial-snapshot:summary',
      category: 'FINANCIAL_SNAPSHOT',
      classification: 'FINANCIAL',
      selector: 'snapshot:monthly:current:summary',
    },
    {
      referenceId: 'data-ref:app-metadata',
      category: 'APP_METADATA',
      classification: 'INTERNAL',
      selector: 'app:metadata:diagnostic',
    },
  ] as const
}

function createDefaultExternalDataReferences() {
  return [
    {
      referenceId: 'data-ref:insight-summary',
      category: 'INSIGHT_SUMMARY',
      classification: 'PERSONAL',
      selector: 'insight:summary:current',
    },
    {
      referenceId: 'data-ref:user-text',
      category: 'USER_PROVIDED_TEXT',
      classification: 'PERSONAL',
      selector: 'input:user-question',
    },
  ] as const
}

function createTraceabilityFrom(input: {
  readonly requestId: string
  readonly policyId: string
  readonly policyVersion: string
  readonly consentId: string | null
  readonly purpose: string
  readonly processingMode: string
  readonly categories: readonly AIDataCategory[]
}) {
  return {
    traceId: 'trace:ai:request:0001',
    relationId: 'relation:ai:request-policy-consent:0001',
    requestId: input.requestId,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    consentId: input.consentId,
    purpose: input.purpose,
    processingMode: input.processingMode,
    dataCategories: canonicalCategories(input.categories),
  } as const
}

function createConsentFromRequest(input: {
  readonly request: AIPrivacyAuthorizationRequest
  readonly policyVersion?: string
  readonly status?: AIConsentRecord['status']
  readonly revoked?: boolean
  readonly scopePurpose?: AIConsentRecord['scope']['purpose']
  readonly scopeCategories?: readonly AIDataCategory[]
  readonly scopeModes?: AIConsentRecord['scope']['processingModes']
}): AIConsentRecord {
  const categories = input.request.dataReferences.map((entry) => entry.category)
  const classifications = input.request.dataReferences.map((entry) => entry.classification)

  return {
    consentId: 'consent:ai:0001',
    consentTextVersion: 'consent-text/1.0.0',
    policyVersion: input.policyVersion ?? AI_PRIVACY_POLICY_VERSION,
    policyProtocolVersion: input.request.protocolVersion,
    status: input.status ?? 'ACTIVE',
    scope: {
      scopeId: 'scope:ai:0001',
      purpose: input.scopePurpose ?? input.request.purpose,
      dataCategories: input.scopeCategories ?? canonicalCategories(categories),
      processingModes: input.scopeModes ?? [input.request.processingMode],
      maxClassification: highestClassification(classifications),
      policyVersion: input.policyVersion ?? AI_PRIVACY_POLICY_VERSION,
      policyProtocolVersion: input.request.protocolVersion,
    },
    revocation: {
      revocable: true,
      revoked: input.revoked ?? false,
      ...(input.revoked === true ? { revocationCode: 'user-revoked' } : {}),
    },
    confirmation: {
      evidenceId: 'evidence:consent:0001',
      evidenceType: 'user-confirmation',
      evidenceDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    validity: {
      kind: 'policy-version-bound',
      value: AI_PRIVACY_POLICY_VERSION,
    },
  }
}

function createRequest(
  overrides: Partial<AIPrivacyAuthorizationRequest> = {},
): AIPrivacyAuthorizationRequest {
  const hasDataReferencesOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'dataReferences',
  )
  const hasPolicyOverride = Object.prototype.hasOwnProperty.call(overrides, 'policy')
  const hasConsentOverride = Object.prototype.hasOwnProperty.call(overrides, 'consent')
  const hasTraceabilityOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'traceability',
  )
  const hasContextBuilderConstraintsOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'contextBuilderConstraints',
  )

  const dataReferences = hasDataReferencesOverride
    ? (overrides.dataReferences as AIPrivacyAuthorizationRequest['dataReferences'])
    : createDefaultLocalDataReferences()

  const requestId = overrides.requestId ?? 'ai-request:local:0001'
  const protocolVersion = overrides.protocolVersion ?? AI_PRIVACY_PROTOCOL_VERSION
  const purpose = overrides.purpose ?? 'SUMMARIZE_FINANCIAL_STATE'
  const processingMode = overrides.processingMode ?? 'LOCAL_ONLY'
  const policy = hasPolicyOverride
    ? (overrides.policy as AIPrivacyAuthorizationRequest['policy'])
    : createDefaultAIPrivacyPolicy()
  const consent = hasConsentOverride
    ? (overrides.consent as AIPrivacyAuthorizationRequest['consent'])
    : undefined

  const retention = overrides.retention ?? 'PROHIBITED'
  const training = overrides.training ?? 'PROHIBITED'
  const logging = overrides.logging ?? 'METADATA_ONLY'
  const minimization = overrides.minimization ?? {
    applied: true,
    strategyCodes: ['min.strategy.required.fields.only'],
  }
  const redaction = overrides.redaction ?? {
    applied: true,
    strategyCodes: ['redact.strategy.mask-identifiers'],
  }

  const categories = dataReferences.map((entry) => entry.category)
  const traceability = hasTraceabilityOverride
    ? (overrides.traceability as AIPrivacyAuthorizationRequest['traceability'])
    : createTraceabilityFrom({
        requestId,
        policyId: policy?.policyId ?? 'missing-policy',
        policyVersion: policy?.policyVersion ?? AI_PRIVACY_POLICY_VERSION,
        consentId: consent?.consentId ?? null,
        purpose,
        processingMode,
        categories,
      })

  const contextBuilderConstraints = hasContextBuilderConstraintsOverride
    ? (overrides.contextBuilderConstraints as AIPrivacyAuthorizationRequest['contextBuilderConstraints'])
    : [
        {
          code: 'ctx.include.authorized.references.only',
          requirement: 'must include only authorized references',
        },
      ]

  return {
    requestId,
    protocolVersion,
    purpose,
    processingMode,
    dataReferences,
    policy,
    ...(consent === undefined ? {} : { consent }),
    retention,
    training,
    logging,
    minimization,
    redaction,
    traceability,
    contextBuilderConstraints,
  }
}

function createExternalRequest(
  overrides: Partial<AIPrivacyAuthorizationRequest> = {},
): AIPrivacyAuthorizationRequest {
  const request = createRequest({
    requestId: 'ai-request:external:0001',
    purpose: 'EXPLAIN_INSIGHT',
    processingMode: 'EXTERNAL_PROVIDER',
    dataReferences: createDefaultExternalDataReferences(),
    ...overrides,
  })

  return request
}

function createPolicyWithConflict(): AIPrivacyPolicy {
  const policy = createDefaultAIPrivacyPolicy()

  return {
    ...policy,
    allowedPurposes: [
      ...policy.allowedPurposes,
      'TRAIN_EXTERNAL_MODEL',
    ],
  }
}

describe('AI Privacy Boundary (Milestone 8A)', () => {
  it('autorizacion LOCAL_ONLY valida', () => {
    const request = createRequest()
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const success = asSuccess(result)

    expect(success.status).toBe('success')
    expect(success.envelope.processingMode).toBe('LOCAL_ONLY')
    expect(success.envelope.purpose).toBe('SUMMARIZE_FINANCIAL_STATE')
    expect(success.envelope.authorizedCategories).toEqual([
      'FINANCIAL_SNAPSHOT',
      'APP_METADATA',
    ])
    expect(success.envelope.maxAuthorizedClassification).toBe('FINANCIAL')
  })

  it('autorizacion EXTERNAL_PROVIDER valida solo con consentimiento explicito compatible', () => {
    const baseExternalRequest = createExternalRequest({
      consent: undefined,
    })

    const externalWithConsent = createExternalRequest()
    const consent = createConsentFromRequest({
      request: externalWithConsent,
    })
    const externalRequest = createExternalRequest({ consent })

    const boundary = createAIPrivacyBoundary()

    const rejected = boundary.authorize(baseExternalRequest)
    const failure = asFailure(rejected)

    expect(failure.code).toBe('EXTERNAL_PROCESSING_NOT_AUTHORIZED')

    const authorized = boundary.authorize(externalRequest)
    const success = asSuccess(authorized)

    expect(success.envelope.processingMode).toBe('EXTERNAL_PROVIDER')
    expect(success.envelope.consent?.consentId).toBe(consent.consentId)
  })

  it('mismo input produce exactamente el mismo resultado', () => {
    const request = createExternalRequest()
    const consent = createConsentFromRequest({ request })
    const finalRequest = createExternalRequest({ consent })
    const boundary = createAIPrivacyBoundary()

    const first = boundary.authorize(finalRequest)
    const second = boundary.authorize(finalRequest)

    expect(first).toEqual(second)
  })

  it('request nulo', () => {
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(null)
    const failure = asFailure(result)

    expect(failure.code).toBe('INVALID_REQUEST')
  })

  it('request estructuralmente invalido', () => {
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize({} as AIPrivacyAuthorizationRequest)
    const failure = asFailure(result)

    expect(failure.code).toBe('INVALID_REQUEST')
  })

  it('politica ausente', () => {
    const request = createRequest({ policy: undefined })
    const boundary = createAIPrivacyBoundary({})

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('MISSING_POLICY')
  })

  it('politica incompatible', () => {
    const invalidPolicy = {
      ...createDefaultAIPrivacyPolicy(),
      defaultDecision: 'ALLOW',
    } as unknown as AIPrivacyPolicy

    const request = createRequest({ policy: invalidPolicy })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('POLICY_CONFLICT')
  })

  it('protocolo no soportado', () => {
    const request = createRequest({ protocolVersion: 99 })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('UNSUPPORTED_PROTOCOL')
  })

  it('proposito desconocido', () => {
    const request = createRequest({
      purpose: 'UNKNOWN_PURPOSE' as AIPrivacyAuthorizationRequest['purpose'],
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('PURPOSE_NOT_ALLOWED')
  })

  it('proposito prohibido', () => {
    const request = createRequest({
      purpose: 'TRAIN_EXTERNAL_MODEL',
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('PURPOSE_NOT_ALLOWED')
  })

  it('modo desconocido', () => {
    const request = createRequest({
      processingMode: 'UNSUPPORTED_MODE' as AIPrivacyAuthorizationRequest['processingMode'],
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('PROCESSING_MODE_NOT_ALLOWED')
  })

  it('modo no permitido', () => {
    const policy = createDefaultAIPrivacyPolicy()
    const restrictedPolicy: AIPrivacyPolicy = {
      ...policy,
      allowedProcessingModes: ['LOCAL_ONLY'],
      modePolicies: policy.modePolicies.filter(
        (modePolicy) => modePolicy.mode === 'LOCAL_ONLY',
      ),
    }

    const request = createExternalRequest({
      policy: restrictedPolicy,
      consent: createConsentFromRequest({ request: createExternalRequest() }),
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('PROCESSING_MODE_NOT_ALLOWED')
  })

  it('categorias vacias cuando son invalidas', () => {
    const request = createRequest({
      dataReferences: [],
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INVALID_REQUEST')
  })

  it('categoria desconocida', () => {
    const request = createRequest({
      dataReferences: [
        {
          referenceId: 'data-ref:unknown-category',
          category: 'UNKNOWN_DATA_CATEGORY' as AIDataCategory,
          classification: 'INTERNAL',
          selector: 'unknown:selector',
        },
      ],
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('DATA_CATEGORY_NOT_ALLOWED')
  })

  it('clasificacion desconocida', () => {
    const request = createRequest({
      dataReferences: [
        {
          referenceId: 'data-ref:unknown-classification',
          category: 'APP_METADATA',
          classification: 'UNKNOWN_CLASSIFICATION' as AIDataClassification,
          selector: 'app:metadata:unknown',
        },
      ],
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('DATA_CLASSIFICATION_NOT_ALLOWED')
  })

  it('clasificacion incompatible', () => {
    const request = createExternalRequest({
      dataReferences: [
        {
          referenceId: 'data-ref:financial-not-allowed-external',
          category: 'INSIGHT_SUMMARY',
          classification: 'FINANCIAL',
          selector: 'insight:financial',
        },
      ],
      consent: createConsentFromRequest({
        request: createExternalRequest({
          dataReferences: [
            {
              referenceId: 'data-ref:financial-not-allowed-external',
              category: 'INSIGHT_SUMMARY',
              classification: 'FINANCIAL',
              selector: 'insight:financial',
            },
          ],
        }),
      }),
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('DATA_CLASSIFICATION_NOT_ALLOWED')
  })

  it('secreto siempre rechazado', () => {
    const request = createRequest({
      dataReferences: [
        {
          referenceId: 'data-ref:secret',
          category: 'APP_METADATA',
          classification: 'CREDENTIAL_OR_SECRET',
          selector: 'credential:api:key',
        },
      ],
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('SECRET_DATA_PROHIBITED')
  })

  it('consentimiento ausente cuando policy lo exige', () => {
    const basePolicy = createDefaultAIPrivacyPolicy()
    const strictLocalPolicy: AIPrivacyPolicy = {
      ...basePolicy,
      modePolicies: basePolicy.modePolicies.map((modePolicy) =>
        modePolicy.mode === 'LOCAL_ONLY'
          ? { ...modePolicy, consentRequired: true }
          : modePolicy,
      ),
    }

    const request = createRequest({
      policy: strictLocalPolicy,
      consent: undefined,
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('MISSING_CONSENT')
  })

  it('consentimiento invalido', () => {
    const request = createExternalRequest({
      consent: {
        consentId: 'consent:invalid',
        status: 'ACTIVE',
      } as unknown as AIConsentRecord,
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INVALID_CONSENT')
  })

  it('consentimiento revocado', () => {
    const externalRequest = createExternalRequest()
    const revokedConsent = createConsentFromRequest({
      request: externalRequest,
      status: 'REVOKED',
      revoked: true,
    })
    const request = createExternalRequest({ consent: revokedConsent })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('REVOKED_CONSENT')
  })

  it('mismatch de proposito en consentimiento', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({
      request: externalRequest,
      scopePurpose: 'DIAGNOSTIC_ANALYSIS',
    })

    const request = createExternalRequest({ consent })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('CONSENT_PURPOSE_MISMATCH')
  })

  it('mismatch de categoria en consentimiento', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({
      request: externalRequest,
      scopeCategories: ['INSIGHT_SUMMARY'],
    })

    const request = createExternalRequest({ consent })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('CONSENT_DATA_SCOPE_MISMATCH')
  })

  it('mismatch de modo en consentimiento', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({
      request: externalRequest,
      scopeModes: ['LOCAL_ONLY'],
    })

    const request = createExternalRequest({ consent })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('CONSENT_PROCESSING_MODE_MISMATCH')
  })

  it('mismatch de version de politica en consentimiento', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({
      request: externalRequest,
      policyVersion: 'ai-privacy-policy/0.9.0',
    })

    const request = createExternalRequest({ consent })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INVALID_CONSENT')
  })

  it('external provider sin consentimiento', () => {
    const request = createExternalRequest({ consent: undefined })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('EXTERNAL_PROCESSING_NOT_AUTHORIZED')
  })

  it('retencion no autorizada', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({ request: externalRequest })
    const request = createExternalRequest({
      retention: 'EPHEMERAL',
      consent,
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('RETENTION_POLICY_VIOLATION')
  })

  it('entrenamiento externo no autorizado', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({ request: externalRequest })
    const request = createExternalRequest({
      training: 'ALLOW_EXTERNAL',
      consent,
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('TRAINING_POLICY_VIOLATION')
  })

  it('logging de contenido no autorizado', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({ request: externalRequest })
    const request = createExternalRequest({
      logging: 'CONTENT',
      consent,
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('LOGGING_POLICY_VIOLATION')
  })

  it('redaccion requerida no declarada', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({ request: externalRequest })
    const request = createExternalRequest({
      consent,
      redaction: {
        applied: false,
        strategyCodes: [],
      },
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('REDACTION_REQUIRED')
  })

  it('minimizacion requerida no declarada', () => {
    const request = createRequest({
      minimization: {
        applied: false,
        strategyCodes: [],
      },
    })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('MINIMIZATION_REQUIRED')
  })

  it('policy conflict', () => {
    const request = createRequest({
      policy: createPolicyWithConflict(),
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('POLICY_CONFLICT')
  })

  it('traceability mismatch', () => {
    const request = createRequest({
      traceability: {
        ...createRequest().traceability,
        requestId: 'different-request-id',
      },
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('TRACEABILITY_MISMATCH')
  })

  it('failure sin envelope', () => {
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(null)
    const failure = asFailure(result)

    expect('envelope' in failure).toBe(false)
  })

  it('ausencia de autorizacion parcial', () => {
    const request = createRequest({
      dataReferences: [
        {
          referenceId: 'data-ref:allowed',
          category: 'APP_METADATA',
          classification: 'INTERNAL',
          selector: 'app:metadata',
        },
        {
          referenceId: 'data-ref:secret',
          category: 'APP_METADATA',
          classification: 'CREDENTIAL_OR_SECRET',
          selector: 'app:secret',
        },
      ],
    })

    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('SECRET_DATA_PROHIBITED')
    expect('envelope' in failure).toBe(false)
  })

  it('orden canonico de categorias en envelope', () => {
    const request = createRequest({
      dataReferences: [
        {
          referenceId: 'data-ref:diagnostic',
          category: 'DIAGNOSTIC_METADATA',
          classification: 'INTERNAL',
          selector: 'diagnostic:metadata',
        },
        {
          referenceId: 'data-ref:summary',
          category: 'INSIGHT_SUMMARY',
          classification: 'PERSONAL',
          selector: 'summary',
        },
        {
          referenceId: 'data-ref:metadata',
          category: 'APP_METADATA',
          classification: 'INTERNAL',
          selector: 'metadata',
        },
      ],
      purpose: 'DIAGNOSTIC_ANALYSIS',
    })

    const boundary = createAIPrivacyBoundary()
    const result = boundary.authorize(request)
    const success = asSuccess(result)

    expect(success.envelope.authorizedCategories).toEqual([
      'INSIGHT_SUMMARY',
      'APP_METADATA',
      'DIAGNOSTIC_METADATA',
    ])
  })

  it('input no mutado', () => {
    const request = createExternalRequest()
    const consent = createConsentFromRequest({ request })
    const finalRequest = createExternalRequest({ consent })
    const before = JSON.stringify(finalRequest)

    const boundary = createAIPrivacyBoundary()
    boundary.authorize(finalRequest)

    expect(JSON.stringify(finalRequest)).toBe(before)
  })

  it('politica no mutada', () => {
    const policy = createDefaultAIPrivacyPolicy()
    const request = createRequest({ policy })
    const before = JSON.stringify(policy)

    const boundary = createAIPrivacyBoundary()
    boundary.authorize(request)

    expect(JSON.stringify(policy)).toBe(before)
  })

  it('consentimiento no mutado', () => {
    const externalRequest = createExternalRequest()
    const consent = createConsentFromRequest({ request: externalRequest })
    const request = createExternalRequest({ consent })
    const before = JSON.stringify(consent)

    const boundary = createAIPrivacyBoundary()
    boundary.authorize(request)

    expect(JSON.stringify(consent)).toBe(before)
  })

  it('resultado JSON-safe', () => {
    const request = createRequest()
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)

    expect(isJsonSafe(result)).toBe(true)
    expect(() => JSON.stringify(result)).not.toThrow()
    expect(cloneJson(result)).toEqual(result)
  })

  it('trazabilidad sin datos financieros materializados', () => {
    const request = createRequest()
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const traceabilityJson = JSON.stringify(result.traceability)

    expect(traceabilityJson.includes('generalBalance')).toBe(false)
    expect(traceabilityJson.includes('netProfit')).toBe(false)
    expect(traceabilityJson.includes('transactions')).toBe(false)
    expect(traceabilityJson.includes('accountName')).toBe(false)
    expect(traceabilityJson.includes('prompt')).toBe(false)
  })

  it('catalogo cerrado y estable de failure codes', () => {
    expect(AI_PRIVACY_FAILURE_CODES).toEqual([
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
    ])
  })

  it('envelope autorizado no contiene objetos financieros materializados', () => {
    const request = createRequest({
      dataReferences: [
        {
          referenceId: 'data-ref:insight',
          category: 'INSIGHT_SUMMARY',
          classification: 'PERSONAL',
          selector: 'insight:summary',
        },
      ],
      purpose: 'EXPLAIN_INSIGHT',
      processingMode: 'LOCAL_ONLY',
    })

    const boundary = createAIPrivacyBoundary()
    const result = boundary.authorize(request)
    const success = asSuccess(result)

    const envelopeJson = JSON.stringify(success.envelope)

    expect(envelopeJson.includes('FinancialSnapshot')).toBe(false)
    expect(envelopeJson.includes('KnowledgeCollection')).toBe(false)
    expect(envelopeJson.includes('InsightRuntime')).toBe(false)
    expect(envelopeJson.includes('balanceReport')).toBe(false)
    expect(envelopeJson.includes('engineResult')).toBe(false)
    expect(envelopeJson.includes('prompt')).toBe(false)
  })

  it('rechaza politica con version no soportada', () => {
    const policy = {
      ...createDefaultAIPrivacyPolicy(),
      policyVersion: 'ai-privacy-policy/2.0.0',
    }

    const request = createRequest({ policy })
    const boundary = createAIPrivacyBoundary()

    const result = boundary.authorize(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('UNSUPPORTED_POLICY_VERSION')
  })

  it('comportamiento fail-closed en failures', () => {
    const boundary = createAIPrivacyBoundary()
    const result = boundary.authorize(null)
    const failure = asFailure(result)

    expect(failure.status).toBe('failure')
    expect(failure.failClosed).toBe(true)
    expect(failure.deterministic).toBe(true)
  })

  it('ausencia de Date.now/new Date/Math.random/randomUUID/fetch/HTTP/proveedores/env/persistencia', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiPrivacyBoundary.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Date.now')).toBe(false)
    expect(source.includes('new Date')).toBe(false)
    expect(source.includes('Math.random')).toBe(false)
    expect(source.includes('randomUUID')).toBe(false)
    expect(source.includes('fetch(')).toBe(false)
    expect(source.includes('axios')).toBe(false)
    expect(source.includes('WebSocket')).toBe(false)
    expect(source.includes('openai')).toBe(false)
    expect(source.includes('anthropic')).toBe(false)
    expect(source.includes('gemini')).toBe(false)
    expect(source.includes('apiKey')).toBe(false)
    expect(source.includes('process.env')).toBe(false)
    expect(source.includes('import.meta.env')).toBe(false)
    expect(source.includes('React')).toBe(false)
    expect(source.includes('Dexie')).toBe(false)
    expect(source.includes('indexedDB')).toBe(false)
    expect(source.includes('localStorage')).toBe(false)
    expect(source.includes('sessionStorage')).toBe(false)
    expect(source.includes('persist')).toBe(false)
  })

  it('ausencia de SDKs y adaptadores de proveedor', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiPrivacyBoundary.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('@openai')).toBe(false)
    expect(source.includes('@anthropic')).toBe(false)
    expect(source.includes('@google')).toBe(false)
    expect(source.includes('llm')).toBe(false)
  })

  it('ausencia de prompts y generacion de texto', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiPrivacyBoundary.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('prompt')).toBe(false)
    expect(source.includes('completion')).toBe(false)
    expect(source.includes('chat')).toBe(false)
    expect(source.includes('generateText')).toBe(false)
  })

  it('ausencia de dependencias de runtime UI y almacenamiento', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiFoundationContracts.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('react')).toBe(false)
    expect(source.includes('dexie')).toBe(false)
    expect(source.includes('indexeddb')).toBe(false)
  })

  it('no modifica contratos certificados previos (validacion por imports directos)', () => {
    const boundarySource = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiPrivacyBoundary.ts', import.meta.url),
      'utf8',
    )

    expect(boundarySource.includes('snapshotKnowledgeIntegration')).toBe(false)
    expect(boundarySource.includes('knowledgeIntegration')).toBe(false)
    expect(boundarySource.includes('insightExecution')).toBe(false)
  })
})

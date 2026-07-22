import {
  createAIContextBuilder,
} from './aiContextBuilder'
import type {
  AIContextSourceDescriptor,
  ContextSourceResolverPort,
} from './aiContextBuilderContracts'
import type {
  SnapshotJsonObject,
} from '../../types/financialSnapshot'
import {
  AI_PRIVACY_PROTOCOL_VERSION,
  type AIPrivacyAuthorizationRequest,
  type AIPrivacyAuthorizationResult,
  type AIPurpose,
  type AIDataCategory,
  type AIDataClassification,
} from './aiFoundationContracts'
import {
  createAIPrivacyBoundary,
} from './aiPrivacyBoundary'
import type {
  AIPrivacyBoundaryPort,
} from './aiPrivacyBoundaryInterfaces'
import {
  createDefaultAIPrivacyPolicy,
} from './aiPrivacyPolicy'
import type {
  EndToEndPipelineFixture,
  MockAdapterFixtures,
  PipelineLLMRequestTemplate,
} from './endToEndPipelineContracts'
import {
  createMockLLMAdapter,
} from './mockLLMAdapter'
import {
  createMockLLMResponseFactory,
} from './mockLLMResponseFactory'
import {
  createLLMCapabilityResolver,
  createLLMProviderRegistry,
} from './providerCapabilityRegistry'
import type {
  LLMDeclarativeCapability,
  LLMProviderDescriptor as RegistryProviderDescriptor,
} from './providerCapabilityRegistryContracts'
import {
  createAdapterCompliancePort,
} from './providerComplianceSuite'

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

const DEFAULT_DECLARED_CAPABILITIES: readonly LLMDeclarativeCapability[] = [
  'TEXT_GENERATION',
  'STRUCTURED_OUTPUT',
  'LOCAL_EXECUTION',
  'TOKEN_ACCOUNTING_SUPPORTED',
]

function descriptorTypeFromCategory(
  category: AIDataCategory,
): AIContextSourceDescriptor['descriptorType'] {
  switch (category) {
    case 'INSIGHT_SUMMARY':
      return 'InsightSummaryReference'
    case 'INSIGHT_READ_MODEL':
      return 'InsightReadModelReference'
    case 'FINANCIAL_SNAPSHOT':
      return 'SnapshotReference'
    case 'KNOWLEDGE_COLLECTION':
      return 'KnowledgeReference'
    case 'APP_METADATA':
      return 'MetadataReference'
    case 'USER_PROVIDED_TEXT':
      return 'UserTextReference'
    case 'DIAGNOSTIC_METADATA':
      return 'DiagnosticReference'
  }
}

function createPrivacyRequest(): AIPrivacyAuthorizationRequest {
  const policy = createDefaultAIPrivacyPolicy()

  return {
    requestId: 'privacy-request:mock-pipeline:001',
    protocolVersion: AI_PRIVACY_PROTOCOL_VERSION,
    purpose: 'EXPLAIN_INSIGHT',
    processingMode: 'LOCAL_ONLY',
    dataReferences: [
      {
        referenceId: 'ref:insight-summary:001',
        category: 'INSIGHT_SUMMARY',
        classification: 'PERSONAL',
        selector: 'insight.summary.current',
      },
      {
        referenceId: 'ref:app-metadata:001',
        category: 'APP_METADATA',
        classification: 'INTERNAL',
        selector: 'app.metadata.current',
      },
    ],
    policy,
    retention: 'PROHIBITED',
    training: 'PROHIBITED',
    logging: 'METADATA_ONLY',
    minimization: {
      applied: true,
      strategyCodes: ['min.remove.internal', 'min.drop.empty'],
    },
    redaction: {
      applied: true,
      strategyCodes: ['redaction.mask.text', 'redaction.hash.reference'],
    },
    traceability: {
      traceId: 'trace:mock-pipeline:privacy:001',
      relationId: 'relation:mock-pipeline:privacy:001',
      requestId: 'privacy-request:mock-pipeline:001',
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      consentId: null,
      purpose: 'EXPLAIN_INSIGHT',
      processingMode: 'LOCAL_ONLY',
      dataCategories: ['INSIGHT_SUMMARY', 'APP_METADATA'],
    },
    contextBuilderConstraints: [
      {
        code: 'ctx.only.authorized.references',
        requirement: 'must include only references from authorized envelope',
      },
    ],
  }
}

function createSourceDescriptors(
  privacyRequest: AIPrivacyAuthorizationRequest,
): readonly AIContextSourceDescriptor[] {
  return privacyRequest.dataReferences.map((reference): AIContextSourceDescriptor => {
    return {
      descriptorType: descriptorTypeFromCategory(reference.category),
      referenceId: reference.referenceId,
      category: reference.category,
      classification: reference.classification,
      selector: reference.selector,
      metadata: {
        fixture: 'mock-pipeline',
      },
    } as unknown as AIContextSourceDescriptor
  })
}

function createResolver(): ContextSourceResolverPort {
  const payloadByReferenceId: Readonly<Record<string, SnapshotJsonObject>> = {
    'ref:insight-summary:001': {
      summaryCode: 'insight.summary.mock.current',
      state: 'active',
      userText: 'deterministic-context-fragment',
    },
    'ref:app-metadata:001': {
      appVersion: '1.0.0',
      releaseChannel: 'stable',
      diagnostics: 'restricted',
    },
  }

  return {
    resolve(descriptor) {
      const payload = payloadByReferenceId[descriptor.referenceId]
      if (payload === undefined) {
        return {
          ok: false,
          status: 'failure',
          descriptor,
          code: 'REFERENCE_NOT_FOUND',
          message: 'fixture resolver missing reference',
        }
      }

      return {
        ok: true,
        status: 'resolved',
        descriptor,
        fragment: {
          referenceId: descriptor.referenceId,
          descriptorType: descriptor.descriptorType,
          category: descriptor.category,
          classification: descriptor.classification,
          payload,
        },
      }
    },
  }
}

function createRequestTemplate(): PipelineLLMRequestTemplate {
  return {
    requestId: 'llm-request:mock-pipeline:001',
    protocolVersion: 1,
    executionMode: 'LOCAL_ONLY',
    provider: {
      providerId: 'provider.mock.pipeline',
      providerVersion: '1.0.0',
      protocolVersion: 1,
      capabilities: {
        supportedProtocolVersions: [1],
        supportedExecutionModes: ['LOCAL_ONLY', 'EXTERNAL_PROVIDER'],
        capabilityFlags: [
          'CONTRACT_VALIDATION',
          'SYNC_INVOCATION',
          'STRUCTURED_JSON_OUTPUT',
          'TOKEN_BUDGET_ENFORCEMENT',
          'TRACEABILITY_PROPAGATION',
        ],
        maxInputTokens: 4096,
        maxOutputTokens: 1024,
        supportsDeterministicContracts: true,
        acceptsContextPackageOnly: true,
      },
    },
    tokenBudget: {
      inputTokenLimit: 800,
      outputTokenLimit: 200,
      totalTokenLimit: 1000,
      reservedOutputTokens: 50,
    },
    requiredCapabilityFlags: [
      'CONTRACT_VALIDATION',
      'STRUCTURED_JSON_OUTPUT',
      'TRACEABILITY_PROPAGATION',
    ],
    traceability: {
      traceId: 'trace:mock-pipeline:invoke:001',
      relationId: 'relation:mock-pipeline:invoke:001',
      requestId: 'llm-request:mock-pipeline:001',
      contextRequestId: 'ctx-pending',
      policyVersion: 'ai-privacy-policy/1.0.0',
    },
  }
}

function createRegistryProviderDescriptor(
  purpose: AIPurpose,
): RegistryProviderDescriptor {
  return {
    providerId: 'provider.mock.pipeline',
    providerVersion: '1.0.0',
    protocolVersion: 1,
    supportedPurposes: [purpose, 'SUMMARIZE_FINANCIAL_STATE'],
    capabilitySet: {
      protocolVersions: [1],
      executionModes: ['LOCAL_ONLY'],
      declaredCapabilities: deepClone(DEFAULT_DECLARED_CAPABILITIES),
      supportsDeterministicResolution: true,
      failClosed: true,
    },
  }
}

function createAuthorizationFailureBoundary(
  purpose: AIPurpose,
  classification: AIDataClassification,
): AIPrivacyBoundaryPort {
  const result: AIPrivacyAuthorizationResult = {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    code: 'INVALID_REQUEST',
    message: 'mock authorization failure for end-to-end validation',
    traceability: {
      traceId: 'trace:mock-pipeline:privacy:failure',
      relationId: 'relation:mock-pipeline:privacy:failure',
      requestId: 'privacy-request:mock-pipeline:001',
      policyId: 'private-balance-ai-privacy-default',
      policyVersion: 'ai-privacy-policy/1.0.0',
      consentId: null,
      purpose,
      processingMode: 'LOCAL_ONLY',
      categories: ['INSIGHT_SUMMARY', 'APP_METADATA'],
      maxClassification: classification,
      decision: 'rejected',
      failureCode: 'INVALID_REQUEST',
      relation: {
        requestToPolicy: 'matched',
        requestToConsent: 'not-required',
      },
    },
  }

  return {
    authorize() {
      return result
    },
  }
}

function createBaseFixture(): EndToEndPipelineFixture {
  const privacyRequest = createPrivacyRequest()
  const requestTemplate = createRequestTemplate()
  const purpose = privacyRequest.purpose

  return deepFreeze({
    fixtureId: 'mock-pipeline-fixture:success',
    privacyBoundary: createAIPrivacyBoundary(),
    privacyRequest,
    contextBuilder: createAIContextBuilder({ resolver: createResolver() }),
    sourceDescriptors: createSourceDescriptors(privacyRequest),
    requestTemplate,
    registry: createLLMProviderRegistry({
      providers: [createRegistryProviderDescriptor(purpose)],
    }),
    capabilityResolver: createLLMCapabilityResolver(),
    compliancePort: createAdapterCompliancePort(),
    adapter: createMockLLMAdapter({
      responseFactory: createMockLLMResponseFactory(),
    }),
    capabilityAssertion: {
      protocolVersion: 1,
      executionMode: 'LOCAL_ONLY',
      requiredProviderVersion: '1.0.0',
      requiredCapabilityFlags: [
        'CONTRACT_VALIDATION',
        'STRUCTURED_JSON_OUTPUT',
        'TRACEABILITY_PROPAGATION',
      ],
      requiredDeclarativeCapabilities: deepClone(DEFAULT_DECLARED_CAPABILITIES),
      requireDeterministicContracts: true,
      requireContextPackageOnly: true,
      requireFailClosed: true,
    },
    declaredCapabilities: deepClone(DEFAULT_DECLARED_CAPABILITIES),
    allowedFailureCodes: ['INVALID_REQUEST', 'MISSING_CONTEXT_PACKAGE'],
  })
}

function createContextFailureDescriptors(
  base: readonly AIContextSourceDescriptor[],
): readonly AIContextSourceDescriptor[] {
  return [
    ...base,
    {
      descriptorType: 'DiagnosticReference',
      referenceId: 'ref:diagnostic:missing',
      category: 'DIAGNOSTIC_METADATA',
      classification: 'INTERNAL',
      selector: 'diagnostic.unknown',
    },
  ]
}

function createAdapterFailureOverrides(): EndToEndPipelineFixture['finalInvocationOverrides'] {
  return {
    tokenBudget: {
      inputTokenLimit: 800,
      outputTokenLimit: 400,
      totalTokenLimit: 500,
      reservedOutputTokens: 50,
    },
  }
}

export function createMockAdapterFixtures(): MockAdapterFixtures {
  return {
    createSuccessFixture(): EndToEndPipelineFixture {
      return deepClone(createBaseFixture())
    },

    createAuthorizationFailureFixture(): EndToEndPipelineFixture {
      const base = createBaseFixture()
      const purpose = base.privacyRequest.purpose

      return deepClone({
        ...base,
        fixtureId: 'mock-pipeline-fixture:authorization-failure',
        privacyBoundary: createAuthorizationFailureBoundary(
          purpose,
          'PERSONAL',
        ),
      })
    },

    createContextFailureFixture(): EndToEndPipelineFixture {
      const base = createBaseFixture()

      return deepClone({
        ...base,
        fixtureId: 'mock-pipeline-fixture:context-failure',
        sourceDescriptors: createContextFailureDescriptors(base.sourceDescriptors),
      })
    },

    createCompatibilityFailureFixture(): EndToEndPipelineFixture {
      const base = createBaseFixture()

      return deepClone({
        ...base,
        fixtureId: 'mock-pipeline-fixture:compatibility-failure',
        capabilityAssertion: {
          ...base.capabilityAssertion,
          requiredCapabilityFlags: [
            ...base.capabilityAssertion.requiredCapabilityFlags,
            'TOKEN_BUDGET_ENFORCEMENT',
          ],
        },
      })
    },

    createAdapterFailureFixture(): EndToEndPipelineFixture {
      const base = createBaseFixture()

      return deepClone({
        ...base,
        fixtureId: 'mock-pipeline-fixture:adapter-failure',
        finalInvocationOverrides: createAdapterFailureOverrides(),
      })
    },
  }
}

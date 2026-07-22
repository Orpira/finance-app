import type {
  AIContextSourceDescriptor,
} from './aiContextBuilderContracts'
import type {
  AIContextBuilderPort,
} from './aiContextBuilderInterfaces'
import type {
  AIPrivacyAuthorizationRequest,
} from './aiFoundationContracts'
import type {
  AIPrivacyBoundaryPort,
} from './aiPrivacyBoundaryInterfaces'
import type {
  LLMAdapterPort,
  LLMFailureCode,
  LLMInvocationResult,
  LLMProtocolVersion,
  LLMRequest,
  LLMResponse,
} from './llmAdapterContracts'
import type {
  AdapterResolutionResult,
  LLMCapabilityResolver,
  LLMDeclarativeCapability,
  LLMProviderDescriptor,
  LLMProviderRegistry,
} from './providerCapabilityRegistryContracts'
import type {
  AdapterCapabilityAssertion,
  AdapterCompliancePort,
  AdapterComplianceReport,
  AdapterTestScenario,
} from './providerComplianceSuiteContracts'

export const PIPELINE_VALIDATION_STAGES = [
  'PRIVACY_BOUNDARY',
  'AUTHORIZED_CONTEXT_BUILDER',
  'LLM_CONTRACTS',
  'CAPABILITY_REGISTRY',
  'PIPELINE_COMPATIBILITY',
  'COMPLIANCE_SUITE',
  'MOCK_ADAPTER',
] as const

export type PipelineValidationStage =
  (typeof PIPELINE_VALIDATION_STAGES)[number]

export const PIPELINE_FAILURE_CODES = [
  'INVALID_PIPELINE_FIXTURE',
  'PRIVACY_AUTHORIZATION_FAILED',
  'CONTEXT_BUILD_FAILED',
  'LLM_REQUEST_CONTRACT_INVALID',
  'CAPABILITY_RESOLUTION_FAILED',
  'PIPELINE_COMPATIBILITY_FAILED',
  'COMPLIANCE_SUITE_FAILED',
  'ADAPTER_INVOCATION_FAILED',
  'INCONSISTENT_PIPELINE_RESULT',
] as const

export type PipelineFailureCode =
  (typeof PIPELINE_FAILURE_CODES)[number]

type PipelineJsonPrimitive = string | number | boolean | null

interface PipelineJsonObject {
  readonly [key: string]: PipelineJsonValue
}

export type PipelineJsonValue =
  | PipelineJsonPrimitive
  | PipelineJsonObject
  | readonly PipelineJsonValue[]

export interface PipelineFailure {
  readonly stage: PipelineValidationStage
  readonly code: PipelineFailureCode
  readonly message: string
  readonly details?: Readonly<Record<string, PipelineJsonValue>>
}

export interface AdapterInvocationRecord {
  readonly invocationOrdinal: number
  readonly fixtureId: string | null
  readonly requestId: string | null
  readonly status:
    | 'success'
    | 'failure'
  readonly failureCode?: LLMFailureCode
  readonly providerId: string | null
  readonly providerVersion: string | null
}

export interface AdapterInvocationRecorder {
  record(input: {
    readonly fixtureId: string | null
    readonly request: LLMRequest | null | undefined
    readonly result: LLMInvocationResult
  }): AdapterInvocationRecord
  getRecords(): readonly AdapterInvocationRecord[]
  count(): number
  clear(): void
}

export interface PipelineCompatibilityVerificationRequest {
  readonly request: LLMRequest
  readonly capabilityAssertion: AdapterCapabilityAssertion
  readonly declaredCapabilities: readonly LLMDeclarativeCapability[]
  readonly resolvedProvider: LLMProviderDescriptor
}

export interface PipelineCompatibilityVerificationResult {
  readonly ok: boolean
  readonly status:
    | 'success'
    | 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly failures: readonly PipelineFailure[]
}

export interface PipelineCompatibilityVerifier {
  verify(
    request: PipelineCompatibilityVerificationRequest,
  ): PipelineCompatibilityVerificationResult
}

export interface PipelineLLMRequestTemplate {
  readonly requestId: string
  readonly protocolVersion: LLMProtocolVersion
  readonly executionMode: LLMRequest['executionMode']
  readonly provider: LLMRequest['provider']
  readonly tokenBudget: LLMRequest['tokenBudget']
  readonly requiredCapabilityFlags: LLMRequest['requiredCapabilityFlags']
  readonly traceability: {
    readonly traceId: string
    readonly relationId: string
    readonly requestId: string
    readonly contextRequestId: string
    readonly policyVersion: string
  }
}

export interface EndToEndPipelineFixture {
  readonly fixtureId: string
  readonly privacyBoundary: AIPrivacyBoundaryPort
  readonly privacyRequest: AIPrivacyAuthorizationRequest
  readonly contextBuilder: AIContextBuilderPort
  readonly sourceDescriptors: readonly AIContextSourceDescriptor[]
  readonly requestTemplate: PipelineLLMRequestTemplate
  readonly registry: LLMProviderRegistry
  readonly capabilityResolver: LLMCapabilityResolver
  readonly compliancePort: AdapterCompliancePort
  readonly adapter: LLMAdapterPort
  readonly capabilityAssertion: AdapterCapabilityAssertion
  readonly declaredCapabilities: readonly LLMDeclarativeCapability[]
  readonly allowedFailureCodes: readonly LLMFailureCode[]
  readonly complianceScenarios?: readonly AdapterTestScenario[]
  readonly finalInvocationOverrides?: Partial<Pick<
    LLMRequest,
    'protocolVersion' | 'executionMode' | 'provider' | 'tokenBudget' | 'requiredCapabilityFlags'
  >>
}

export interface PipelineValidationReport {
  readonly ok: boolean
  readonly status:
    | 'success'
    | 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly fixtureId: string | null
  readonly completedStages: readonly PipelineValidationStage[]
  readonly failure: PipelineFailure | null
  readonly response: LLMResponse | null
  readonly capabilityResolution: AdapterResolutionResult | null
  readonly complianceReport: AdapterComplianceReport | null
  readonly invocationResult: LLMInvocationResult | null
  readonly invocationRecords: readonly AdapterInvocationRecord[]
  readonly summary: {
    readonly totalStages: number
    readonly completedCount: number
    readonly failedStage: PipelineValidationStage | null
  }
}

export interface EndToEndPipelineValidator {
  validate(
    fixture: EndToEndPipelineFixture | null | undefined,
  ): PipelineValidationReport
}

export interface MockAdapterFixtures {
  createSuccessFixture(): EndToEndPipelineFixture
  createAuthorizationFailureFixture(): EndToEndPipelineFixture
  createContextFailureFixture(): EndToEndPipelineFixture
  createCompatibilityFailureFixture(): EndToEndPipelineFixture
  createAdapterFailureFixture(): EndToEndPipelineFixture
}

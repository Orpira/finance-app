import type {
  AIPrivacyAuthorizationRequest,
} from './aiFoundationContracts'
import type {
  AIPrivacyBoundaryPort,
} from './aiPrivacyBoundaryInterfaces'
import type {
  LLMAdapterPort,
  LLMCapabilityFlag,
  LLMExecutionMode,
  LLMFailureCode,
  LLMProtocolVersion,
  LLMRequest,
} from './llmAdapterContracts'
import type {
  LLMDeclarativeCapability,
} from './providerCapabilityRegistryContracts'

type ComplianceJsonPrimitive = string | number | boolean | null

interface ComplianceJsonObject {
  readonly [key: string]: ComplianceJsonValue
}

type ComplianceJsonValue =
  | ComplianceJsonPrimitive
  | ComplianceJsonObject
  | readonly ComplianceJsonValue[]

export const ADAPTER_COMPLIANCE_RULE_IDS = [
  'PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED',
  'ACCEPTS_CONTEXT_PACKAGE_ONLY',
  'ADAPTER_PORT_IMPLEMENTED',
  'CAPABILITY_DECLARATION_VALID',
  'FAIL_CLOSED_ENFORCED',
  'CONTRACT_RESULT_VALID',
  'PROTOCOL_VERSION_COMPATIBLE',
  'PROVIDER_VERSION_COMPATIBLE',
] as const

export type AdapterComplianceRuleId =
  (typeof ADAPTER_COMPLIANCE_RULE_IDS)[number]

export const ADAPTER_TEST_SCENARIO_TYPES = [
  'BASELINE',
  'INVALID_CONTEXT_PACKAGE',
  'FAIL_CLOSED_REQUEST',
] as const

export type AdapterTestScenarioType =
  (typeof ADAPTER_TEST_SCENARIO_TYPES)[number]

export const ADAPTER_COMPLIANCE_FAILURE_CODES = [
  'INVALID_FIXTURE',
  'INVALID_SCENARIO',
  'PRIVACY_BOUNDARY_VIOLATION',
  'CONTEXT_PACKAGE_ONLY_VIOLATION',
  'ADAPTER_PORT_MISSING',
  'CAPABILITY_ASSERTION_FAILED',
  'FAIL_CLOSED_VIOLATION',
  'INVALID_INVOCATION_RESULT',
  'PROTOCOL_VERSION_INCOMPATIBLE',
  'PROVIDER_VERSION_INCOMPATIBLE',
  'DETERMINISM_VIOLATION',
  'INCONSISTENT_VALIDATION_STATE',
] as const

export type AdapterComplianceFailureCode =
  (typeof ADAPTER_COMPLIANCE_FAILURE_CODES)[number]

export interface AdapterComplianceRule {
  readonly ruleId: AdapterComplianceRuleId
  readonly description: string
  readonly mandatory: true
}

export interface AdapterCapabilityAssertion {
  readonly protocolVersion: LLMProtocolVersion
  readonly executionMode: LLMExecutionMode
  readonly requiredProviderVersion?: string
  readonly requiredCapabilityFlags: readonly LLMCapabilityFlag[]
  readonly requiredDeclarativeCapabilities: readonly LLMDeclarativeCapability[]
  readonly requireDeterministicContracts: true
  readonly requireContextPackageOnly: true
  readonly requireFailClosed: true
}

export interface AdapterFixture {
  readonly fixtureId: string
  readonly privacyBoundary: AIPrivacyBoundaryPort
  readonly privacyRequest: AIPrivacyAuthorizationRequest
  readonly adapter: LLMAdapterPort
  readonly request: LLMRequest
  readonly capabilityAssertion: AdapterCapabilityAssertion
  readonly declaredCapabilities: readonly LLMDeclarativeCapability[]
  readonly allowedFailureCodes: readonly LLMFailureCode[]
  readonly metadata?: Readonly<Record<string, ComplianceJsonValue>>
}

export interface AdapterTestScenario {
  readonly scenarioId: string
  readonly scenarioType: AdapterTestScenarioType
  readonly request: LLMRequest | null | undefined
  readonly expectedStatus:
    | 'success'
    | 'failure'
  readonly expectedFailureCodes?: readonly LLMFailureCode[]
}

export interface AdapterComplianceFailure {
  readonly code: AdapterComplianceFailureCode
  readonly message: string
  readonly ruleId?: AdapterComplianceRuleId
  readonly details?: Readonly<Record<string, ComplianceJsonValue>>
}

export interface AdapterValidationResult {
  readonly ruleId: AdapterComplianceRuleId
  readonly passed: boolean
  readonly failure?: AdapterComplianceFailure
}

export interface AdapterComplianceSuite {
  readonly suiteId: string
  readonly suiteVersion: string
  readonly protocolVersion: LLMProtocolVersion
  readonly deterministic: true
  readonly failClosed: true
  readonly rules: readonly AdapterComplianceRule[]
}

export interface AdapterComplianceReport {
  readonly ok: boolean
  readonly status:
    | 'success'
    | 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly suiteId: string
  readonly suiteVersion: string
  readonly protocolVersion: LLMProtocolVersion
  readonly fixtureId: string | null
  readonly results: readonly AdapterValidationResult[]
  readonly failures: readonly AdapterComplianceFailure[]
  readonly summary: {
    readonly totalRules: number
    readonly passedRules: number
    readonly failedRules: number
  }
}

export interface AdapterContractVerifier {
  verifyRule(
    rule: AdapterComplianceRule,
    fixture: AdapterFixture,
    scenarios: readonly AdapterTestScenario[],
  ): AdapterValidationResult
}

export interface AdapterCompliancePort {
  runCompliance(
    fixture: AdapterFixture | null | undefined,
    scenarios?: readonly AdapterTestScenario[],
  ): AdapterComplianceReport
}

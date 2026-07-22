import type { AIPurpose } from './aiFoundationContracts'
import type {
  LLMExecutionMode,
  LLMProtocolVersion,
} from './llmAdapterContracts'

type RegistryJsonPrimitive = string | number | boolean | null

interface RegistryJsonObject {
  readonly [key: string]: RegistryJsonValue
}

type RegistryJsonValue =
  | RegistryJsonPrimitive
  | RegistryJsonObject
  | readonly RegistryJsonValue[]

export const LLM_DECLARATIVE_CAPABILITIES = [
  'TEXT_GENERATION',
  'STRUCTURED_OUTPUT',
  'FUNCTION_CALLING',
  'STREAMING',
  'LOCAL_EXECUTION',
  'EXTERNAL_EXECUTION',
  'MULTIMODAL_INPUT',
  'MULTIMODAL_OUTPUT',
  'TOKEN_ACCOUNTING_SUPPORTED',
] as const

export type LLMDeclarativeCapability =
  (typeof LLM_DECLARATIVE_CAPABILITIES)[number]

export interface LLMCapabilitySet {
  readonly protocolVersions: readonly LLMProtocolVersion[]
  readonly executionModes: readonly LLMExecutionMode[]
  readonly declaredCapabilities: readonly LLMDeclarativeCapability[]
  readonly supportsDeterministicResolution: true
  readonly failClosed: true
}

export interface LLMProviderDescriptor {
  readonly providerId: string
  readonly providerVersion: string
  readonly protocolVersion: LLMProtocolVersion
  readonly supportedPurposes: readonly AIPurpose[]
  readonly capabilitySet: LLMCapabilitySet
}

export interface AdapterSelectionPolicy {
  readonly policyId: string
  readonly policyVersion: string
  readonly deterministic: true
  readonly failClosed: true
  readonly fallbackBehavior: 'FAIL'
  readonly providerOrdering: 'provider-id-then-version-asc'
}

export interface LLMProviderRegistry {
  readonly registryId: string
  readonly registryVersion: string
  readonly protocolVersion: LLMProtocolVersion
  readonly providers: readonly LLMProviderDescriptor[]
  readonly selectionPolicy: AdapterSelectionPolicy
}

export interface AdapterResolutionRequest {
  readonly requestId: string
  readonly purpose: AIPurpose
  readonly protocolVersion: LLMProtocolVersion
  readonly executionMode: LLMExecutionMode
  readonly requiredCapabilities: readonly LLMDeclarativeCapability[]
  readonly requiredProviderVersion?: string
}

export interface CapabilityValidationResult {
  readonly compatible: boolean
  readonly protocolCompatible: boolean
  readonly executionModeCompatible: boolean
  readonly versionCompatible: boolean
  readonly purposeCompatible: boolean
  readonly missingCapabilities: readonly LLMDeclarativeCapability[]
}

export interface ProviderCompatibility {
  readonly providerId: string
  readonly providerVersion: string
  readonly compatible: boolean
  readonly validation: CapabilityValidationResult
}

export const ADAPTER_RESOLUTION_FAILURE_CODES = [
  'INVALID_REQUEST',
  'INVALID_REGISTRY',
  'EMPTY_REGISTRY',
  'NO_CAPABILITY_MATCH',
  'PROVIDER_INCOMPATIBLE',
  'VERSION_INCOMPATIBLE',
  'PROTOCOL_INCOMPATIBLE',
  'EXECUTION_MODE_INCOMPATIBLE',
] as const

export type AdapterResolutionFailureCode =
  (typeof ADAPTER_RESOLUTION_FAILURE_CODES)[number]

export interface AdapterResolutionSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly provider: LLMProviderDescriptor
  readonly compatibility: ProviderCompatibility
  readonly evaluatedProviders: readonly ProviderCompatibility[]
  readonly selectionPolicy: AdapterSelectionPolicy
}

export interface AdapterResolutionFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly code: AdapterResolutionFailureCode
  readonly message: string
  readonly evaluatedProviders: readonly ProviderCompatibility[]
  readonly details?: Readonly<Record<string, RegistryJsonValue>>
}

export type AdapterResolutionResult =
  | AdapterResolutionSuccess
  | AdapterResolutionFailure

export interface LLMCapabilityResolver {
  resolve(
    request: AdapterResolutionRequest | null | undefined,
    registry: LLMProviderRegistry | null | undefined,
  ): AdapterResolutionResult
}

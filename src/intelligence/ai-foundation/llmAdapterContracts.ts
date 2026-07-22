import type { AIContextPackage } from './aiContextBuilderContracts'
import type { AIProcessingMode } from './aiFoundationContracts'

type LLMJsonPrimitive = string | number | boolean | null

interface LLMJsonObject {
  readonly [key: string]: LLMJsonValue
}

type LLMJsonValue =
  | LLMJsonPrimitive
  | LLMJsonObject
  | readonly LLMJsonValue[]

export const LLM_PROTOCOL_VERSIONS = [1] as const

export type LLMProtocolVersion = (typeof LLM_PROTOCOL_VERSIONS)[number]

export const LLM_EXECUTION_MODES = [
  'LOCAL_ONLY',
  'EXTERNAL_PROVIDER',
] as const satisfies readonly AIProcessingMode[]

export type LLMExecutionMode = (typeof LLM_EXECUTION_MODES)[number]

export const LLM_CAPABILITY_FLAGS = [
  'CONTRACT_VALIDATION',
  'SYNC_INVOCATION',
  'STRUCTURED_JSON_OUTPUT',
  'TOKEN_BUDGET_ENFORCEMENT',
  'TRACEABILITY_PROPAGATION',
] as const

export type LLMCapabilityFlag = (typeof LLM_CAPABILITY_FLAGS)[number]

export interface LLMTokenBudget {
  readonly inputTokenLimit: number
  readonly outputTokenLimit: number
  readonly totalTokenLimit: number
  readonly reservedOutputTokens: number
}

export interface LLMCapabilities {
  readonly supportedProtocolVersions: readonly LLMProtocolVersion[]
  readonly supportedExecutionModes: readonly LLMExecutionMode[]
  readonly capabilityFlags: readonly LLMCapabilityFlag[]
  readonly maxInputTokens: number
  readonly maxOutputTokens: number
  readonly supportsDeterministicContracts: true
  readonly acceptsContextPackageOnly: true
}

export interface LLMProviderDescriptor {
  readonly providerId: string
  readonly providerVersion: string
  readonly protocolVersion: LLMProtocolVersion
  readonly capabilities: LLMCapabilities
}

export interface LLMInvocationTraceability {
  readonly traceId: string | null
  readonly relationId: string | null
  readonly requestId: string | null
  readonly contextRequestId: string | null
  readonly policyVersion: string | null
  readonly protocolVersion: LLMProtocolVersion | null
  readonly executionMode: LLMExecutionMode | null
  readonly providerId: string | null
  readonly providerVersion: string | null
  readonly decision:
    | 'accepted'
    | 'rejected'
  readonly failureCode?: LLMFailureCode
  readonly relation: {
    readonly requestToContext:
      | 'matched'
      | 'missing'
      | 'mismatch'
    readonly requestToProtocol:
      | 'matched'
      | 'missing'
      | 'mismatch'
    readonly requestToVersion:
      | 'matched'
      | 'missing'
      | 'mismatch'
    readonly requestToCapabilities:
      | 'matched'
      | 'missing'
      | 'mismatch'
  }
}

export interface LLMRequest {
  readonly requestId: string
  readonly protocolVersion: LLMProtocolVersion
  readonly executionMode: LLMExecutionMode
  readonly contextPackage: AIContextPackage
  readonly provider: LLMProviderDescriptor
  readonly tokenBudget: LLMTokenBudget
  readonly requiredCapabilityFlags: readonly LLMCapabilityFlag[]
  readonly traceability: {
    readonly traceId: string
    readonly relationId: string
    readonly requestId: string
    readonly contextRequestId: string
    readonly policyVersion: string
  }
}

export interface LLMResponse {
  readonly requestId: string
  readonly providerId: string
  readonly providerVersion: string
  readonly protocolVersion: LLMProtocolVersion
  readonly executionMode: LLMExecutionMode
  readonly tokenUsage: {
    readonly inputTokens: number
    readonly outputTokens: number
    readonly totalTokens: number
  }
  readonly output: Readonly<Record<string, LLMJsonValue>>
  readonly traceability: LLMInvocationTraceability
}

export const LLM_FAILURE_CODES = [
  'INVALID_REQUEST',
  'MISSING_CONTEXT_PACKAGE',
  'MISSING_PROTOCOL_VERSION',
  'UNSUPPORTED_PROTOCOL_VERSION',
  'MISSING_PROVIDER_DESCRIPTOR',
  'MISSING_PROVIDER_VERSION',
  'MISSING_CAPABILITIES',
  'INCOMPATIBLE_CAPABILITIES',
  'INCOMPATIBLE_EXECUTION_MODE',
  'TOKEN_BUDGET_INVALID',
  'INCONSISTENT_INVOCATION_RESULT',
  'INVOCATION_NOT_EXECUTED',
] as const

export type LLMFailureCode = (typeof LLM_FAILURE_CODES)[number]

export interface LLMInvocationSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly response: LLMResponse
  readonly traceability: LLMInvocationTraceability
}

export interface LLMInvocationFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly code: LLMFailureCode
  readonly message: string
  readonly traceability: LLMInvocationTraceability
  readonly details?: Readonly<Record<string, LLMJsonValue>>
}

export type LLMInvocationResult =
  | LLMInvocationSuccess
  | LLMInvocationFailure

export interface LLMAdapterPort {
  invoke(
    request: LLMRequest | null | undefined,
  ): LLMInvocationResult
}

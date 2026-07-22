import {
  LLM_CAPABILITY_FLAGS,
  LLM_EXECUTION_MODES,
  LLM_FAILURE_CODES,
  LLM_PROTOCOL_VERSIONS,
  type LLMCapabilityFlag,
  type LLMExecutionMode,
  type LLMFailureCode,
  type LLMInvocationFailure,
  type LLMInvocationResult,
  type LLMInvocationSuccess,
  type LLMRequest,
} from './llmAdapterContracts'
import {
  LLM_DECLARATIVE_CAPABILITIES,
  type AdapterResolutionResult,
  type LLMDeclarativeCapability,
  type LLMProviderDescriptor,
} from './providerCapabilityRegistryContracts'
import type {
  AdapterCompliancePort,
  AdapterComplianceReport,
  AdapterFixture,
  AdapterTestScenario,
} from './providerComplianceSuiteContracts'
import type {
  AIContextBuilderPort,
} from './aiContextBuilderInterfaces'
import type {
  AIContextBuildResult,
  AIContextPackage,
  AIContextSourceDescriptor,
} from './aiContextBuilderContracts'
import type {
  AIAuthorizedRequestEnvelope,
  AIPrivacyAuthorizationRequest,
  AIPrivacyAuthorizationResult,
} from './aiFoundationContracts'
import type {
  AIPrivacyBoundaryPort,
} from './aiPrivacyBoundaryInterfaces'
import type {
  LLMCapabilityResolver,
  LLMProviderRegistry,
} from './providerCapabilityRegistryContracts'
import type {
  AdapterCapabilityAssertion,
} from './providerComplianceSuiteContracts'
import {
  PIPELINE_VALIDATION_STAGES,
  type AdapterInvocationRecord,
  type AdapterInvocationRecorder,
  type EndToEndPipelineFixture,
  type EndToEndPipelineValidator,
  type PipelineCompatibilityVerificationRequest,
  type PipelineCompatibilityVerificationResult,
  type PipelineCompatibilityVerifier,
  type PipelineFailure,
  type PipelineFailureCode,
  type PipelineJsonValue,
  type PipelineValidationReport,
  type PipelineValidationStage,
} from './endToEndPipelineContracts'

const PIPELINE_STAGE_RANK = PIPELINE_VALIDATION_STAGES.reduce((accumulator, stage, index) => {
  accumulator[stage] = index
  return accumulator
}, {} as Record<PipelineValidationStage, number>)

const LLM_PROTOCOL_VERSION_SET = new Set<number>(LLM_PROTOCOL_VERSIONS)
const LLM_EXECUTION_MODE_SET = new Set<string>(LLM_EXECUTION_MODES)
const LLM_CAPABILITY_FLAG_SET = new Set<string>(LLM_CAPABILITY_FLAGS)
const LLM_FAILURE_CODE_SET = new Set<string>(LLM_FAILURE_CODES)
const DECLARATIVE_CAPABILITY_SET = new Set<string>(LLM_DECLARATIVE_CAPABILITIES)

const LLM_FAILURE_CODE_RANK = LLM_FAILURE_CODES.reduce((accumulator, code, index) => {
  accumulator[code] = index
  return accumulator
}, {} as Record<LLMFailureCode, number>)

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isKnownProtocolVersion(value: number): boolean {
  return LLM_PROTOCOL_VERSION_SET.has(value)
}

function isKnownExecutionMode(value: string): value is LLMExecutionMode {
  return LLM_EXECUTION_MODE_SET.has(value)
}

function isKnownCapabilityFlag(value: string): value is LLMCapabilityFlag {
  return LLM_CAPABILITY_FLAG_SET.has(value)
}

function isKnownFailureCode(value: string): value is LLMFailureCode {
  return LLM_FAILURE_CODE_SET.has(value)
}

function isKnownDeclarativeCapability(
  value: string,
): value is LLMDeclarativeCapability {
  return DECLARATIVE_CAPABILITY_SET.has(value)
}

function canonicalCompletedStages(
  stages: readonly PipelineValidationStage[],
): readonly PipelineValidationStage[] {
  const unique = new Set<PipelineValidationStage>()
  for (const stage of stages) {
    unique.add(stage)
  }

  return [...unique].sort((left, right) => PIPELINE_STAGE_RANK[left] - PIPELINE_STAGE_RANK[right])
}

function canonicalFailureCodes(
  codes: readonly LLMFailureCode[],
): readonly LLMFailureCode[] {
  const unique = new Set<LLMFailureCode>()
  for (const code of codes) {
    unique.add(code)
  }

  return [...unique].sort((left, right) => LLM_FAILURE_CODE_RANK[left] - LLM_FAILURE_CODE_RANK[right])
}

function hasTokenBudgetShape(value: unknown): value is LLMRequest['tokenBudget'] {
  if (!isRecord(value)) {
    return false
  }

  const inputTokenLimit = value.inputTokenLimit
  const outputTokenLimit = value.outputTokenLimit
  const totalTokenLimit = value.totalTokenLimit
  const reservedOutputTokens = value.reservedOutputTokens

  if (
    !isSafeNonNegativeInteger(inputTokenLimit) ||
    !isSafeNonNegativeInteger(outputTokenLimit) ||
    !isSafeNonNegativeInteger(totalTokenLimit) ||
    !isSafeNonNegativeInteger(reservedOutputTokens)
  ) {
    return false
  }

  if (reservedOutputTokens > outputTokenLimit) {
    return false
  }

  return totalTokenLimit >= inputTokenLimit + outputTokenLimit
}

function hasTokenBudgetFieldsShape(
  value: unknown,
): value is LLMRequest['tokenBudget'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    isSafeNonNegativeInteger(value.inputTokenLimit) &&
    isSafeNonNegativeInteger(value.outputTokenLimit) &&
    isSafeNonNegativeInteger(value.totalTokenLimit) &&
    isSafeNonNegativeInteger(value.reservedOutputTokens)
  )
}

function hasProviderCapabilitiesShape(
  value: unknown,
): value is LLMRequest['provider']['capabilities'] {
  if (!isRecord(value)) {
    return false
  }

  if (
    !Array.isArray(value.supportedProtocolVersions) ||
    !Array.isArray(value.supportedExecutionModes) ||
    !Array.isArray(value.capabilityFlags)
  ) {
    return false
  }

  for (const protocolVersion of value.supportedProtocolVersions) {
    if (typeof protocolVersion !== 'number' || !isKnownProtocolVersion(protocolVersion)) {
      return false
    }
  }

  for (const executionMode of value.supportedExecutionModes) {
    if (typeof executionMode !== 'string' || !isKnownExecutionMode(executionMode)) {
      return false
    }
  }

  for (const flag of value.capabilityFlags) {
    if (typeof flag !== 'string' || !isKnownCapabilityFlag(flag)) {
      return false
    }
  }

  if (
    !isSafeNonNegativeInteger(value.maxInputTokens) ||
    !isSafeNonNegativeInteger(value.maxOutputTokens)
  ) {
    return false
  }

  return (
    value.supportsDeterministicContracts === true &&
    value.acceptsContextPackageOnly === true
  )
}

function hasProviderShape(value: unknown): value is LLMRequest['provider'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.providerId) &&
    isNonEmptyString(value.providerVersion) &&
    typeof value.protocolVersion === 'number' &&
    isKnownProtocolVersion(value.protocolVersion) &&
    hasProviderCapabilitiesShape(value.capabilities)
  )
}

function hasTraceabilityShape(value: unknown): value is LLMRequest['traceability'] {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.traceId) &&
    isNonEmptyString(value.relationId) &&
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.contextRequestId) &&
    isNonEmptyString(value.policyVersion)
  )
}

function hasContextPackageShape(value: unknown): value is AIContextPackage {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.purpose) &&
    typeof value.processingMode === 'string' &&
    isKnownExecutionMode(value.processingMode) &&
    isNonEmptyString(value.policyVersion) &&
    typeof value.protocolVersion === 'number' &&
    isKnownProtocolVersion(value.protocolVersion) &&
    Array.isArray(value.orderedContextFragments) &&
    Array.isArray(value.appliedRedactions) &&
    Array.isArray(value.appliedMinimization) &&
    isRecord(value.traceability)
  )
}

function hasAuthorizedEnvelopeShape(value: unknown): value is AIAuthorizedRequestEnvelope {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.purpose) &&
    typeof value.processingMode === 'string' &&
    isKnownExecutionMode(value.processingMode) &&
    Array.isArray(value.authorizedDataReferences) &&
    Array.isArray(value.authorizedCategories) &&
    isNonEmptyString(value.maxAuthorizedClassification) &&
    isRecord(value.policy) &&
    isRecord(value.requirements) &&
    isRecord(value.governance) &&
    isRecord(value.traceability)
  )
}

function hasCapabilityAssertionShape(
  value: unknown,
): value is AdapterCapabilityAssertion {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.protocolVersion !== 'number' ||
    !isKnownProtocolVersion(value.protocolVersion) ||
    typeof value.executionMode !== 'string' ||
    !isKnownExecutionMode(value.executionMode)
  ) {
    return false
  }

  if (
    value.requiredProviderVersion !== undefined &&
    !isNonEmptyString(value.requiredProviderVersion)
  ) {
    return false
  }

  if (
    !Array.isArray(value.requiredCapabilityFlags) ||
    !Array.isArray(value.requiredDeclarativeCapabilities)
  ) {
    return false
  }

  for (const capabilityFlag of value.requiredCapabilityFlags) {
    if (typeof capabilityFlag !== 'string' || !isKnownCapabilityFlag(capabilityFlag)) {
      return false
    }
  }

  for (const declarativeCapability of value.requiredDeclarativeCapabilities) {
    if (
      typeof declarativeCapability !== 'string' ||
      !isKnownDeclarativeCapability(declarativeCapability)
    ) {
      return false
    }
  }

  return (
    value.requireDeterministicContracts === true &&
    value.requireContextPackageOnly === true &&
    value.requireFailClosed === true
  )
}

interface MutableFinalInvocationOverrides {
  protocolVersion?: LLMRequest['protocolVersion']
  executionMode?: LLMRequest['executionMode']
  provider?: LLMRequest['provider']
  tokenBudget?: LLMRequest['tokenBudget']
  requiredCapabilityFlags?: readonly LLMCapabilityFlag[]
}

function parseFinalInvocationOverrides(
  value: unknown,
): EndToEndPipelineFixture['finalInvocationOverrides'] | null {
  if (value === undefined) {
    return undefined
  }

  if (!isRecord(value)) {
    return null
  }

  const parsed: MutableFinalInvocationOverrides = {}

  if (Object.prototype.hasOwnProperty.call(value, 'protocolVersion')) {
    if (
      typeof value.protocolVersion !== 'number' ||
      !isKnownProtocolVersion(value.protocolVersion)
    ) {
      return null
    }

    parsed.protocolVersion = value.protocolVersion as LLMRequest['protocolVersion']
  }

  if (Object.prototype.hasOwnProperty.call(value, 'executionMode')) {
    if (
      typeof value.executionMode !== 'string' ||
      !isKnownExecutionMode(value.executionMode)
    ) {
      return null
    }

    parsed.executionMode = value.executionMode
  }

  if (Object.prototype.hasOwnProperty.call(value, 'provider')) {
    if (!hasProviderShape(value.provider)) {
      return null
    }

    parsed.provider = value.provider
  }

  if (Object.prototype.hasOwnProperty.call(value, 'tokenBudget')) {
    if (!hasTokenBudgetFieldsShape(value.tokenBudget)) {
      return null
    }

    parsed.tokenBudget = value.tokenBudget
  }

  if (Object.prototype.hasOwnProperty.call(value, 'requiredCapabilityFlags')) {
    if (!Array.isArray(value.requiredCapabilityFlags)) {
      return null
    }

    for (const capabilityFlag of value.requiredCapabilityFlags) {
      if (typeof capabilityFlag !== 'string' || !isKnownCapabilityFlag(capabilityFlag)) {
        return null
      }
    }

    parsed.requiredCapabilityFlags = [...value.requiredCapabilityFlags]
  }

  return parsed
}

interface ParsedPipelineFixture {
  readonly fixtureId: string
  readonly privacyBoundary: AIPrivacyBoundaryPort
  readonly privacyRequest: AIPrivacyAuthorizationRequest
  readonly contextBuilder: AIContextBuilderPort
  readonly sourceDescriptors: readonly AIContextSourceDescriptor[]
  readonly requestTemplate: EndToEndPipelineFixture['requestTemplate']
  readonly registry: LLMProviderRegistry
  readonly capabilityResolver: LLMCapabilityResolver
  readonly compliancePort: AdapterCompliancePort
  readonly adapter: EndToEndPipelineFixture['adapter']
  readonly capabilityAssertion: AdapterCapabilityAssertion
  readonly declaredCapabilities: readonly LLMDeclarativeCapability[]
  readonly allowedFailureCodes: readonly LLMFailureCode[]
  readonly complianceScenarios?: readonly AdapterTestScenario[]
  readonly finalInvocationOverrides?: EndToEndPipelineFixture['finalInvocationOverrides']
}

function parseFixture(value: unknown): ParsedPipelineFixture | null {
  if (!isRecord(value)) {
    return null
  }

  if (!isNonEmptyString(value.fixtureId)) {
    return null
  }

  if (!isRecord(value.privacyBoundary) || typeof value.privacyBoundary.authorize !== 'function') {
    return null
  }

  if (!isRecord(value.privacyRequest)) {
    return null
  }

  if (!isRecord(value.contextBuilder) || typeof value.contextBuilder.buildContext !== 'function') {
    return null
  }

  if (!Array.isArray(value.sourceDescriptors)) {
    return null
  }

  if (!isRecord(value.requestTemplate)) {
    return null
  }

  const template = value.requestTemplate
  if (
    !isNonEmptyString(template.requestId) ||
    typeof template.protocolVersion !== 'number' ||
    !isKnownProtocolVersion(template.protocolVersion) ||
    typeof template.executionMode !== 'string' ||
    !isKnownExecutionMode(template.executionMode) ||
    !hasProviderShape(template.provider) ||
    !hasTokenBudgetShape(template.tokenBudget) ||
    !Array.isArray(template.requiredCapabilityFlags) ||
    !hasTraceabilityShape(template.traceability)
  ) {
    return null
  }

  for (const capabilityFlag of template.requiredCapabilityFlags) {
    if (typeof capabilityFlag !== 'string' || !isKnownCapabilityFlag(capabilityFlag)) {
      return null
    }
  }

  if (!isRecord(value.registry)) {
    return null
  }

  if (!isRecord(value.capabilityResolver) || typeof value.capabilityResolver.resolve !== 'function') {
    return null
  }

  if (!isRecord(value.compliancePort) || typeof value.compliancePort.runCompliance !== 'function') {
    return null
  }

  if (!isRecord(value.adapter) || typeof value.adapter.invoke !== 'function') {
    return null
  }

  if (!hasCapabilityAssertionShape(value.capabilityAssertion)) {
    return null
  }

  if (!Array.isArray(value.declaredCapabilities)) {
    return null
  }

  for (const declarativeCapability of value.declaredCapabilities) {
    if (
      typeof declarativeCapability !== 'string' ||
      !isKnownDeclarativeCapability(declarativeCapability)
    ) {
      return null
    }
  }

  if (!Array.isArray(value.allowedFailureCodes)) {
    return null
  }

  for (const failureCode of value.allowedFailureCodes) {
    if (typeof failureCode !== 'string' || !isKnownFailureCode(failureCode)) {
      return null
    }
  }

  if (
    value.complianceScenarios !== undefined &&
    !Array.isArray(value.complianceScenarios)
  ) {
    return null
  }

  const parsedFinalInvocationOverrides = parseFinalInvocationOverrides(
    value.finalInvocationOverrides,
  )
  if (
    value.finalInvocationOverrides !== undefined &&
    parsedFinalInvocationOverrides === null
  ) {
    return null
  }

  const finalInvocationOverrides =
    parsedFinalInvocationOverrides === null
      ? undefined
      : parsedFinalInvocationOverrides

  return {
    fixtureId: value.fixtureId,
    privacyBoundary: value.privacyBoundary as unknown as AIPrivacyBoundaryPort,
    privacyRequest: deepClone(
      value.privacyRequest as unknown as AIPrivacyAuthorizationRequest,
    ),
    contextBuilder: value.contextBuilder as unknown as AIContextBuilderPort,
    sourceDescriptors: deepClone(
      value.sourceDescriptors as unknown as readonly AIContextSourceDescriptor[],
    ),
    requestTemplate: deepClone(
      value.requestTemplate as unknown as EndToEndPipelineFixture['requestTemplate'],
    ),
    registry: deepClone(value.registry as unknown as LLMProviderRegistry),
    capabilityResolver:
      value.capabilityResolver as unknown as LLMCapabilityResolver,
    compliancePort: value.compliancePort as unknown as AdapterCompliancePort,
    adapter: value.adapter as unknown as EndToEndPipelineFixture['adapter'],
    capabilityAssertion: deepClone(
      value.capabilityAssertion as unknown as AdapterCapabilityAssertion,
    ),
    declaredCapabilities: deepClone(
      value.declaredCapabilities as unknown as readonly LLMDeclarativeCapability[],
    ),
    allowedFailureCodes: canonicalFailureCodes(
      value.allowedFailureCodes as unknown as readonly LLMFailureCode[],
    ),
    ...(value.complianceScenarios === undefined
      ? {}
      : {
          complianceScenarios: deepClone(
            value.complianceScenarios as unknown as readonly AdapterTestScenario[],
          ),
        }),
    ...(finalInvocationOverrides === undefined
      ? {}
      : { finalInvocationOverrides: deepClone(finalInvocationOverrides) }),
  }
}

function isPrivacyAuthorizationSuccess(
  result: AIPrivacyAuthorizationResult,
): result is Extract<AIPrivacyAuthorizationResult, { readonly ok: true }> {
  return result.ok === true && hasAuthorizedEnvelopeShape(result.envelope)
}

function isContextBuildSuccess(
  result: AIContextBuildResult,
): result is Extract<AIContextBuildResult, { readonly ok: true }> {
  return result.ok === true && hasContextPackageShape(result.contextPackage)
}

function createPipelineFailure(input: {
  readonly stage: PipelineValidationStage
  readonly code: PipelineFailureCode
  readonly message: string
  readonly details?: Readonly<Record<string, PipelineJsonValue>>
}): PipelineFailure {
  const failure: PipelineFailure = {
    stage: input.stage,
    code: input.code,
    message: input.message,
    ...(input.details === undefined ? {} : { details: deepClone(input.details) }),
  }

  return deepFreeze(failure)
}

function createFailureReport(input: {
  readonly fixtureId: string | null
  readonly completedStages: readonly PipelineValidationStage[]
  readonly failure: PipelineFailure
  readonly capabilityResolution: AdapterResolutionResult | null
  readonly complianceReport: AdapterComplianceReport | null
  readonly invocationResult: LLMInvocationResult | null
  readonly invocationRecords: readonly AdapterInvocationRecord[]
}): PipelineValidationReport {
  const completedStages = canonicalCompletedStages(input.completedStages)

  return deepFreeze({
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    fixtureId: input.fixtureId,
    completedStages,
    failure: deepClone(input.failure),
    response: null,
    capabilityResolution:
      input.capabilityResolution === null
        ? null
        : deepClone(input.capabilityResolution),
    complianceReport:
      input.complianceReport === null
        ? null
        : deepClone(input.complianceReport),
    invocationResult:
      input.invocationResult === null
        ? null
        : deepClone(input.invocationResult),
    invocationRecords: deepClone(input.invocationRecords),
    summary: {
      totalStages: PIPELINE_VALIDATION_STAGES.length,
      completedCount: completedStages.length,
      failedStage: input.failure.stage,
    },
  })
}

function createSuccessReport(input: {
  readonly fixtureId: string
  readonly completedStages: readonly PipelineValidationStage[]
  readonly response: LLMInvocationSuccess['response']
  readonly capabilityResolution: AdapterResolutionResult
  readonly complianceReport: AdapterComplianceReport
  readonly invocationResult: LLMInvocationSuccess
  readonly invocationRecords: readonly AdapterInvocationRecord[]
}): PipelineValidationReport {
  const completedStages = canonicalCompletedStages(input.completedStages)

  return deepFreeze({
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    fixtureId: input.fixtureId,
    completedStages,
    failure: null,
    response: deepClone(input.response),
    capabilityResolution: deepClone(input.capabilityResolution),
    complianceReport: deepClone(input.complianceReport),
    invocationResult: deepClone(input.invocationResult),
    invocationRecords: deepClone(input.invocationRecords),
    summary: {
      totalStages: PIPELINE_VALIDATION_STAGES.length,
      completedCount: completedStages.length,
      failedStage: null,
    },
  })
}

function buildBaseRequest(input: {
  readonly template: EndToEndPipelineFixture['requestTemplate']
  readonly contextPackage: AIContextPackage
}): LLMRequest {
  return {
    requestId: input.template.requestId,
    protocolVersion: input.template.protocolVersion,
    executionMode: input.template.executionMode,
    contextPackage: deepClone(input.contextPackage),
    provider: deepClone(input.template.provider),
    tokenBudget: deepClone(input.template.tokenBudget),
    requiredCapabilityFlags: deepClone(input.template.requiredCapabilityFlags),
    traceability: {
      traceId: input.template.traceability.traceId,
      relationId: input.template.traceability.relationId,
      requestId: input.template.requestId,
      contextRequestId: input.contextPackage.requestId,
      policyVersion: input.contextPackage.policyVersion,
    },
  }
}

function alignRequestWithResolvedProvider(input: {
  readonly request: LLMRequest
  readonly resolvedProvider: LLMProviderDescriptor
}): LLMRequest {
  return {
    ...deepClone(input.request),
    provider: {
      ...deepClone(input.request.provider),
      providerId: input.resolvedProvider.providerId,
      providerVersion: input.resolvedProvider.providerVersion,
      protocolVersion: input.resolvedProvider.protocolVersion,
    },
  }
}

function applyInvocationOverrides(input: {
  readonly request: LLMRequest
  readonly overrides: EndToEndPipelineFixture['finalInvocationOverrides']
}): LLMRequest {
  if (input.overrides === undefined) {
    return deepClone(input.request)
  }

  const nextRequest: LLMRequest = {
    ...deepClone(input.request),
    ...(input.overrides.protocolVersion === undefined
      ? {}
      : { protocolVersion: input.overrides.protocolVersion }),
    ...(input.overrides.executionMode === undefined
      ? {}
      : { executionMode: input.overrides.executionMode }),
    ...(input.overrides.provider === undefined
      ? {}
      : { provider: deepClone(input.overrides.provider) }),
    ...(input.overrides.tokenBudget === undefined
      ? {}
      : { tokenBudget: deepClone(input.overrides.tokenBudget) }),
    ...(input.overrides.requiredCapabilityFlags === undefined
      ? {}
      : {
          requiredCapabilityFlags: deepClone(
            input.overrides.requiredCapabilityFlags,
          ),
        }),
  }

  return {
    ...nextRequest,
    traceability: {
      ...nextRequest.traceability,
      requestId: nextRequest.requestId,
      contextRequestId: nextRequest.contextPackage.requestId,
      policyVersion: nextRequest.contextPackage.policyVersion,
    },
  }
}

function validateLLMRequestContract(request: LLMRequest): PipelineFailure | null {
  if (!isNonEmptyString(request.requestId)) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request must declare requestId',
    })
  }

  if (!isKnownProtocolVersion(request.protocolVersion)) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request protocolVersion is not supported',
      details: {
        requestId: request.requestId,
        protocolVersion: request.protocolVersion,
      },
    })
  }

  if (!isKnownExecutionMode(request.executionMode)) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request executionMode is invalid',
      details: {
        requestId: request.requestId,
      },
    })
  }

  if (!hasContextPackageShape(request.contextPackage)) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request contextPackage must be contract-valid',
      details: {
        requestId: request.requestId,
      },
    })
  }

  if (
    request.contextPackage.processingMode !== request.executionMode ||
    request.contextPackage.protocolVersion !== request.protocolVersion
  ) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request must be aligned with context package mode and protocol',
      details: {
        requestId: request.requestId,
        requestMode: request.executionMode,
        contextMode: request.contextPackage.processingMode,
      },
    })
  }

  if (!hasProviderShape(request.provider)) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request provider descriptor must be complete',
      details: {
        requestId: request.requestId,
      },
    })
  }

  if (request.provider.protocolVersion !== request.protocolVersion) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request provider protocolVersion mismatch',
      details: {
        requestId: request.requestId,
        requestProtocolVersion: request.protocolVersion,
        providerProtocolVersion: request.provider.protocolVersion,
      },
    })
  }

  if (!hasTokenBudgetShape(request.tokenBudget)) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request tokenBudget must be valid and consistent',
      details: {
        requestId: request.requestId,
      },
    })
  }

  for (const requiredCapabilityFlag of request.requiredCapabilityFlags) {
    if (!isKnownCapabilityFlag(requiredCapabilityFlag)) {
      return createPipelineFailure({
        stage: 'LLM_CONTRACTS',
        code: 'LLM_REQUEST_CONTRACT_INVALID',
        message: 'LLM request requiredCapabilityFlags contains unknown flag',
        details: {
          requestId: request.requestId,
          capabilityFlag: requiredCapabilityFlag,
        },
      })
    }

    if (!request.provider.capabilities.capabilityFlags.includes(requiredCapabilityFlag)) {
      return createPipelineFailure({
        stage: 'LLM_CONTRACTS',
        code: 'LLM_REQUEST_CONTRACT_INVALID',
        message: 'LLM provider capabilities do not satisfy required capability flags',
        details: {
          requestId: request.requestId,
          capabilityFlag: requiredCapabilityFlag,
        },
      })
    }
  }

  if (!hasTraceabilityShape(request.traceability)) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request traceability is invalid',
      details: {
        requestId: request.requestId,
      },
    })
  }

  if (
    request.traceability.requestId !== request.requestId ||
    request.traceability.contextRequestId !== request.contextPackage.requestId ||
    request.traceability.policyVersion !== request.contextPackage.policyVersion
  ) {
    return createPipelineFailure({
      stage: 'LLM_CONTRACTS',
      code: 'LLM_REQUEST_CONTRACT_INVALID',
      message: 'LLM request traceability is not aligned with request and context package',
      details: {
        requestId: request.requestId,
      },
    })
  }

  return null
}

function isInvocationFailureShape(value: unknown): value is LLMInvocationFailure {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === false &&
    value.status === 'failure' &&
    value.deterministic === true &&
    value.failClosed === true &&
    isNonEmptyString(value.code) &&
    isKnownFailureCode(value.code) &&
    isNonEmptyString(value.message) &&
    isRecord(value.traceability)
  )
}

function isInvocationSuccessShape(value: unknown): value is LLMInvocationSuccess {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === true &&
    value.status === 'success' &&
    value.deterministic === true &&
    value.failClosed === true &&
    isRecord(value.response) &&
    isRecord(value.traceability)
  )
}

function isInvocationResultShape(value: unknown): value is LLMInvocationResult {
  return isInvocationSuccessShape(value) || isInvocationFailureShape(value)
}

function isInvocationSuccessConsistent(input: {
  readonly request: LLMRequest
  readonly result: LLMInvocationSuccess
}): boolean {
  return (
    input.result.response.requestId === input.request.requestId &&
    input.result.response.providerId === input.request.provider.providerId &&
    input.result.response.providerVersion === input.request.provider.providerVersion &&
    input.result.response.protocolVersion === input.request.protocolVersion &&
    input.result.response.executionMode === input.request.executionMode &&
    input.result.response.traceability.requestId === input.request.requestId &&
    input.result.traceability.requestId === input.request.requestId &&
    input.result.response.traceability.contextRequestId === input.request.contextPackage.requestId &&
    input.result.traceability.contextRequestId === input.request.contextPackage.requestId &&
    input.result.response.traceability.policyVersion === input.request.contextPackage.policyVersion &&
    input.result.traceability.policyVersion === input.request.contextPackage.policyVersion
  )
}

export function createAdapterInvocationRecorder(): AdapterInvocationRecorder {
  let records: AdapterInvocationRecord[] = []

  return {
    record(input): AdapterInvocationRecord {
      const nextOrdinal = records.length + 1
      const requestRecord =
        input.request !== null && input.request !== undefined
          ? input.request
          : null

      const providerIdFromTraceability =
        input.result.traceability.providerId === null
          ? null
          : input.result.traceability.providerId

      const providerVersionFromTraceability =
        input.result.traceability.providerVersion === null
          ? null
          : input.result.traceability.providerVersion

      const record: AdapterInvocationRecord = deepFreeze({
        invocationOrdinal: nextOrdinal,
        fixtureId: input.fixtureId,
        requestId: requestRecord?.requestId ?? null,
        status: input.result.status,
        ...(input.result.ok ? {} : { failureCode: input.result.code }),
        providerId: requestRecord?.provider.providerId ?? providerIdFromTraceability,
        providerVersion:
          requestRecord?.provider.providerVersion ?? providerVersionFromTraceability,
      })

      records.push(record)
      records = [...records].sort((left, right) => left.invocationOrdinal - right.invocationOrdinal)

      return deepClone(record)
    },

    getRecords(): readonly AdapterInvocationRecord[] {
      return deepFreeze(deepClone(records))
    },

    count(): number {
      return records.length
    },

    clear(): void {
      records = []
    },
  }
}

function createCompatibilityFailure(input: {
  readonly message: string
  readonly details?: Readonly<Record<string, PipelineJsonValue>>
}): PipelineFailure {
  return createPipelineFailure({
    stage: 'PIPELINE_COMPATIBILITY',
    code: 'PIPELINE_COMPATIBILITY_FAILED',
    message: input.message,
    ...(input.details === undefined ? {} : { details: input.details }),
  })
}

export function createPipelineCompatibilityVerifier(): PipelineCompatibilityVerifier {
  return {
    verify(
      request: PipelineCompatibilityVerificationRequest,
    ): PipelineCompatibilityVerificationResult {
      const failures: PipelineFailure[] = []

      const requiredRequestFlags = request.capabilityAssertion.requiredCapabilityFlags
      const requiredDeclarativeCapabilities =
        request.capabilityAssertion.requiredDeclarativeCapabilities

      if (request.request.protocolVersion !== request.capabilityAssertion.protocolVersion) {
        failures.push(createCompatibilityFailure({
          message: 'request protocolVersion does not match capability assertion',
          details: {
            expectedProtocolVersion: request.capabilityAssertion.protocolVersion,
            requestProtocolVersion: request.request.protocolVersion,
          },
        }))
      }

      if (request.request.executionMode !== request.capabilityAssertion.executionMode) {
        failures.push(createCompatibilityFailure({
          message: 'request executionMode does not match capability assertion',
          details: {
            expectedExecutionMode: request.capabilityAssertion.executionMode,
            requestExecutionMode: request.request.executionMode,
          },
        }))
      }

      if (
        request.capabilityAssertion.requiredProviderVersion !== undefined &&
        request.request.provider.providerVersion !==
          request.capabilityAssertion.requiredProviderVersion
      ) {
        failures.push(createCompatibilityFailure({
          message: 'request providerVersion does not satisfy required provider version',
          details: {
            expectedProviderVersion: request.capabilityAssertion.requiredProviderVersion,
            requestProviderVersion: request.request.provider.providerVersion,
          },
        }))
      }

      if (
        request.request.provider.providerId !== request.resolvedProvider.providerId ||
        request.request.provider.providerVersion !== request.resolvedProvider.providerVersion
      ) {
        failures.push(createCompatibilityFailure({
          message: 'request provider descriptor does not match resolved provider',
          details: {
            requestProviderId: request.request.provider.providerId,
            requestProviderVersion: request.request.provider.providerVersion,
            resolvedProviderId: request.resolvedProvider.providerId,
            resolvedProviderVersion: request.resolvedProvider.providerVersion,
          },
        }))
      }

      if (request.request.provider.protocolVersion !== request.resolvedProvider.protocolVersion) {
        failures.push(createCompatibilityFailure({
          message: 'request provider protocolVersion does not match resolved provider',
          details: {
            requestProviderProtocolVersion: request.request.provider.protocolVersion,
            resolvedProviderProtocolVersion: request.resolvedProvider.protocolVersion,
          },
        }))
      }

      const missingRequestFlags = requiredRequestFlags.filter((flag) => {
        return !request.request.requiredCapabilityFlags.includes(flag)
      })

      if (missingRequestFlags.length > 0) {
        failures.push(createCompatibilityFailure({
          message: 'request requiredCapabilityFlags does not include all required assertion flags',
          details: {
            missingRequestFlags: deepClone(missingRequestFlags),
          },
        }))
      }

      const missingProviderFlags = requiredRequestFlags.filter((flag) => {
        return !request.request.provider.capabilities.capabilityFlags.includes(flag)
      })

      if (missingProviderFlags.length > 0) {
        failures.push(createCompatibilityFailure({
          message: 'provider capabilityFlags does not include all required assertion flags',
          details: {
            missingProviderFlags: deepClone(missingProviderFlags),
          },
        }))
      }

      const missingDeclaredCapabilities = requiredDeclarativeCapabilities.filter((capability) => {
        return !request.declaredCapabilities.includes(capability)
      })

      if (missingDeclaredCapabilities.length > 0) {
        failures.push(createCompatibilityFailure({
          message: 'fixture declared capabilities do not satisfy required declarative capabilities',
          details: {
            missingDeclaredCapabilities: deepClone(missingDeclaredCapabilities),
          },
        }))
      }

      const missingResolvedCapabilities = requiredDeclarativeCapabilities.filter((capability) => {
        return !request.resolvedProvider.capabilitySet.declaredCapabilities.includes(capability)
      })

      if (missingResolvedCapabilities.length > 0) {
        failures.push(createCompatibilityFailure({
          message: 'resolved provider does not satisfy required declarative capabilities',
          details: {
            missingResolvedCapabilities: deepClone(missingResolvedCapabilities),
          },
        }))
      }

      if (
        !request.request.provider.capabilities.supportedProtocolVersions.includes(
          request.request.protocolVersion,
        )
      ) {
        failures.push(createCompatibilityFailure({
          message: 'provider capabilities do not support request protocol version',
          details: {
            requestProtocolVersion: request.request.protocolVersion,
          },
        }))
      }

      if (
        !request.resolvedProvider.capabilitySet.protocolVersions.includes(
          request.request.protocolVersion,
        )
      ) {
        failures.push(createCompatibilityFailure({
          message: 'resolved provider capability set does not support request protocol version',
          details: {
            requestProtocolVersion: request.request.protocolVersion,
          },
        }))
      }

      if (
        !request.request.provider.capabilities.supportedExecutionModes.includes(
          request.request.executionMode,
        )
      ) {
        failures.push(createCompatibilityFailure({
          message: 'provider capabilities do not support request execution mode',
          details: {
            requestExecutionMode: request.request.executionMode,
          },
        }))
      }

      if (
        !request.resolvedProvider.capabilitySet.executionModes.includes(
          request.request.executionMode,
        )
      ) {
        failures.push(createCompatibilityFailure({
          message: 'resolved provider capability set does not support request execution mode',
          details: {
            requestExecutionMode: request.request.executionMode,
          },
        }))
      }

      if (
        request.capabilityAssertion.requireDeterministicContracts &&
        request.request.provider.capabilities.supportsDeterministicContracts !== true
      ) {
        failures.push(createCompatibilityFailure({
          message: 'provider capabilities must enforce deterministic contracts',
        }))
      }

      if (
        request.capabilityAssertion.requireContextPackageOnly &&
        request.request.provider.capabilities.acceptsContextPackageOnly !== true
      ) {
        failures.push(createCompatibilityFailure({
          message: 'provider capabilities must enforce context package only input',
        }))
      }

      if (failures.length > 0) {
        return deepFreeze({
          ok: false,
          status: 'failure',
          deterministic: true,
          failClosed: true,
          failures,
        })
      }

      return deepFreeze({
        ok: true,
        status: 'success',
        deterministic: true,
        failClosed: true,
        failures: [],
      })
    },
  }
}

export interface CreateEndToEndPipelineValidatorInput {
  readonly recorder?: AdapterInvocationRecorder
  readonly compatibilityVerifier?: PipelineCompatibilityVerifier
}

function toAdapterFixture(input: {
  readonly fixture: ParsedPipelineFixture
  readonly request: LLMRequest
}): AdapterFixture {
  return {
    fixtureId: input.fixture.fixtureId,
    privacyBoundary: input.fixture.privacyBoundary,
    privacyRequest: deepClone(input.fixture.privacyRequest),
    adapter: input.fixture.adapter,
    request: deepClone(input.request),
    capabilityAssertion: deepClone(input.fixture.capabilityAssertion),
    declaredCapabilities: deepClone(input.fixture.declaredCapabilities),
    allowedFailureCodes: canonicalFailureCodes(input.fixture.allowedFailureCodes),
  }
}

function extractCompatibilityDetails(
  failures: readonly PipelineFailure[],
): Readonly<Record<string, PipelineJsonValue>> {
  return {
    failures: failures.map((failure) => {
      return {
        message: failure.message,
        ...(failure.details === undefined ? {} : { details: failure.details }),
      }
    }),
  }
}

function extractComplianceDetails(
  report: AdapterComplianceReport,
): Readonly<Record<string, PipelineJsonValue>> {
  const firstFailure = report.failures[0]

  return {
    failedRules: report.summary.failedRules,
    firstFailureCode: firstFailure?.code ?? null,
    firstFailureRuleId: firstFailure?.ruleId ?? null,
  }
}

export function createEndToEndPipelineValidator(
  input: CreateEndToEndPipelineValidatorInput = {},
): EndToEndPipelineValidator {
  const recorder = input.recorder ?? createAdapterInvocationRecorder()
  const compatibilityVerifier =
    input.compatibilityVerifier ?? createPipelineCompatibilityVerifier()

  return {
    validate(
      fixture: EndToEndPipelineFixture | null | undefined,
    ): PipelineValidationReport {
      recorder.clear()

      const completedStages: PipelineValidationStage[] = []
      let currentStage: PipelineValidationStage = 'PRIVACY_BOUNDARY'
      let capabilityResolution: AdapterResolutionResult | null = null
      let complianceReport: AdapterComplianceReport | null = null
      let invocationResult: LLMInvocationResult | null = null

      try {
        const parsedFixture = parseFixture(fixture)
        if (parsedFixture === null) {
          return createFailureReport({
            fixtureId: null,
            completedStages,
            failure: createPipelineFailure({
              stage: 'PRIVACY_BOUNDARY',
              code: 'INVALID_PIPELINE_FIXTURE',
              message: 'pipeline fixture is invalid or incomplete',
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        currentStage = 'PRIVACY_BOUNDARY'
        const authorization = parsedFixture.privacyBoundary.authorize(
          deepClone(parsedFixture.privacyRequest),
        )

        if (!isPrivacyAuthorizationSuccess(authorization)) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'PRIVACY_BOUNDARY',
              code: 'PRIVACY_AUTHORIZATION_FAILED',
              message: 'privacy boundary denied pipeline authorization request',
              details: {
                authorizationCode: authorization.code,
              },
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        completedStages.push('PRIVACY_BOUNDARY')

        currentStage = 'AUTHORIZED_CONTEXT_BUILDER'
        const contextBuildRequest = {
          envelope: deepClone(authorization.envelope),
          sourceDescriptors: deepClone(parsedFixture.sourceDescriptors),
        }

        const contextResult = parsedFixture.contextBuilder.buildContext(contextBuildRequest)
        if (!isContextBuildSuccess(contextResult)) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'AUTHORIZED_CONTEXT_BUILDER',
              code: 'CONTEXT_BUILD_FAILED',
              message: 'authorized context builder failed to build AI context package',
              details: {
                contextCode: contextResult.code,
              },
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        completedStages.push('AUTHORIZED_CONTEXT_BUILDER')

        const baseRequest = buildBaseRequest({
          template: parsedFixture.requestTemplate,
          contextPackage: contextResult.contextPackage,
        })

        currentStage = 'LLM_CONTRACTS'
        const contractFailure = validateLLMRequestContract(baseRequest)
        if (contractFailure !== null) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: contractFailure,
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        completedStages.push('LLM_CONTRACTS')

        currentStage = 'CAPABILITY_REGISTRY'
        const resolutionRequest = {
          requestId: baseRequest.requestId,
          purpose: baseRequest.contextPackage.purpose,
          protocolVersion: baseRequest.protocolVersion,
          executionMode: baseRequest.executionMode,
          requiredCapabilities: deepClone(
            parsedFixture.capabilityAssertion.requiredDeclarativeCapabilities,
          ),
          ...(parsedFixture.capabilityAssertion.requiredProviderVersion === undefined
            ? {}
            : {
                requiredProviderVersion:
                  parsedFixture.capabilityAssertion.requiredProviderVersion,
              }),
        }

        capabilityResolution = parsedFixture.capabilityResolver.resolve(
          resolutionRequest,
          deepClone(parsedFixture.registry),
        )

        if (!capabilityResolution.ok) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'CAPABILITY_REGISTRY',
              code: 'CAPABILITY_RESOLUTION_FAILED',
              message: 'provider capability resolver failed to select a compatible provider',
              details: {
                resolutionCode: capabilityResolution.code,
              },
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        completedStages.push('CAPABILITY_REGISTRY')

        const compatibleRequest = alignRequestWithResolvedProvider({
          request: baseRequest,
          resolvedProvider: capabilityResolution.provider,
        })

        currentStage = 'PIPELINE_COMPATIBILITY'
        const compatibilityResult = compatibilityVerifier.verify({
          request: compatibleRequest,
          capabilityAssertion: deepClone(parsedFixture.capabilityAssertion),
          declaredCapabilities: deepClone(parsedFixture.declaredCapabilities),
          resolvedProvider: deepClone(capabilityResolution.provider),
        })

        if (!compatibilityResult.ok) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'PIPELINE_COMPATIBILITY',
              code: 'PIPELINE_COMPATIBILITY_FAILED',
              message: 'pipeline compatibility verification failed',
              details: extractCompatibilityDetails(compatibilityResult.failures),
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        completedStages.push('PIPELINE_COMPATIBILITY')

        currentStage = 'COMPLIANCE_SUITE'
        complianceReport = parsedFixture.compliancePort.runCompliance(
          toAdapterFixture({
            fixture: parsedFixture,
            request: compatibleRequest,
          }),
          parsedFixture.complianceScenarios,
        )

        if (!complianceReport.ok) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'COMPLIANCE_SUITE',
              code: 'COMPLIANCE_SUITE_FAILED',
              message: 'provider compliance suite rejected mock adapter fixture',
              details: extractComplianceDetails(complianceReport),
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        completedStages.push('COMPLIANCE_SUITE')

        currentStage = 'MOCK_ADAPTER'
        const invocationRequest = applyInvocationOverrides({
          request: compatibleRequest,
          overrides: parsedFixture.finalInvocationOverrides,
        })

        const rawInvocationResult = parsedFixture.adapter.invoke(
          deepClone(invocationRequest),
        )

        if (!isInvocationResultShape(rawInvocationResult)) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'MOCK_ADAPTER',
              code: 'INCONSISTENT_PIPELINE_RESULT',
              message: 'mock adapter returned an invalid invocation result shape',
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        invocationResult = deepClone(rawInvocationResult)

        recorder.record({
          fixtureId: parsedFixture.fixtureId,
          request: invocationRequest,
          result: invocationResult,
        })

        if (!invocationResult.ok) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'MOCK_ADAPTER',
              code: 'ADAPTER_INVOCATION_FAILED',
              message: 'mock adapter rejected invocation request',
              details: {
                invocationCode: invocationResult.code,
              },
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        if (!isInvocationSuccessConsistent({ request: invocationRequest, result: invocationResult })) {
          return createFailureReport({
            fixtureId: parsedFixture.fixtureId,
            completedStages,
            failure: createPipelineFailure({
              stage: 'MOCK_ADAPTER',
              code: 'INCONSISTENT_PIPELINE_RESULT',
              message: 'mock adapter invocation result is inconsistent with request',
            }),
            capabilityResolution,
            complianceReport,
            invocationResult,
            invocationRecords: recorder.getRecords(),
          })
        }

        completedStages.push('MOCK_ADAPTER')

        return createSuccessReport({
          fixtureId: parsedFixture.fixtureId,
          completedStages,
          response: invocationResult.response,
          capabilityResolution,
          complianceReport,
          invocationResult,
          invocationRecords: recorder.getRecords(),
        })
      } catch {
        return createFailureReport({
          fixtureId: null,
          completedStages,
          failure: createPipelineFailure({
            stage: currentStage,
            code: 'INCONSISTENT_PIPELINE_RESULT',
            message: 'unexpected pipeline exception converted to fail-closed result',
          }),
          capabilityResolution,
          complianceReport,
          invocationResult,
          invocationRecords: recorder.getRecords(),
        })
      }
    },
  }
}

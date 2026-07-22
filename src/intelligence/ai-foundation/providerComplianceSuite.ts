import type {
  AIAuthorizedRequestEnvelope,
  AIPrivacyAuthorizationResult,
} from './aiFoundationContracts'
import {
  LLM_CAPABILITY_FLAGS,
  LLM_FAILURE_CODES,
  LLM_PROTOCOL_VERSIONS,
  type LLMAdapterPort,
  type LLMCapabilityFlag,
  type LLMExecutionMode,
  type LLMFailureCode,
  type LLMInvocationResult,
  type LLMProtocolVersion,
  type LLMRequest,
} from './llmAdapterContracts'
import {
  LLM_DECLARATIVE_CAPABILITIES,
  type LLMDeclarativeCapability,
} from './providerCapabilityRegistryContracts'
import type {
  AdapterCapabilityAssertion,
  AdapterComplianceFailure,
  AdapterComplianceFailureCode,
  AdapterCompliancePort,
  AdapterComplianceReport,
  AdapterComplianceRule,
  AdapterComplianceRuleId,
  AdapterComplianceSuite,
  AdapterContractVerifier,
  AdapterFixture,
  AdapterTestScenario,
  AdapterTestScenarioType,
  AdapterValidationResult,
} from './providerComplianceSuiteContracts'
import {
  ADAPTER_COMPLIANCE_RULE_IDS,
  ADAPTER_TEST_SCENARIO_TYPES,
} from './providerComplianceSuiteContracts'

const RULE_DESCRIPTIONS: Record<AdapterComplianceRuleId, string> = {
  PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED:
    'privacy boundary must authorize request and envelope must match context package',
  ACCEPTS_CONTEXT_PACKAGE_ONLY:
    'adapter must reject requests that do not provide a valid context package',
  ADAPTER_PORT_IMPLEMENTED:
    'adapter fixture must implement LLMAdapterPort.invoke',
  CAPABILITY_DECLARATION_VALID:
    'capability declaration must satisfy required flags and declarative capabilities',
  FAIL_CLOSED_ENFORCED:
    'adapter must fail closed for invalid requests',
  CONTRACT_RESULT_VALID:
    'adapter invocation result must preserve contract invariants',
  PROTOCOL_VERSION_COMPATIBLE:
    'adapter protocol version must be compatible with suite assertion',
  PROVIDER_VERSION_COMPATIBLE:
    'provider version must satisfy fixture assertion when required',
}

const RULE_RANK = ADAPTER_COMPLIANCE_RULE_IDS.reduce((accumulator, ruleId, index) => {
  accumulator[ruleId] = index
  return accumulator
}, {} as Record<AdapterComplianceRuleId, number>)

const SCENARIO_TYPE_RANK = ADAPTER_TEST_SCENARIO_TYPES.reduce(
  (accumulator, scenarioType, index) => {
    accumulator[scenarioType] = index
    return accumulator
  },
  {} as Record<AdapterTestScenarioType, number>,
)

const LLM_FAILURE_CODE_RANK = LLM_FAILURE_CODES.reduce((accumulator, code, index) => {
  accumulator[code] = index
  return accumulator
}, {} as Record<LLMFailureCode, number>)

const LLM_CAPABILITY_FLAG_SET = new Set<string>(LLM_CAPABILITY_FLAGS)
const DECLARATIVE_CAPABILITY_SET = new Set<string>(LLM_DECLARATIVE_CAPABILITIES)
const LLM_FAILURE_CODE_SET = new Set<string>(LLM_FAILURE_CODES)
const RULE_ID_SET = new Set<string>(ADAPTER_COMPLIANCE_RULE_IDS)
const SCENARIO_TYPE_SET = new Set<string>(ADAPTER_TEST_SCENARIO_TYPES)

const DEFAULT_ALLOWED_FAILURE_CODES: readonly LLMFailureCode[] = [
  'INVALID_REQUEST',
  'MISSING_CONTEXT_PACKAGE',
]

const DEFAULT_COMPLIANCE_SUITE: AdapterComplianceSuite = deepFreeze({
  suiteId: 'provider-adapter-compliance-suite',
  suiteVersion: '1.0.0',
  protocolVersion: LLM_PROTOCOL_VERSIONS[0],
  deterministic: true,
  failClosed: true,
  rules: canonicalRules(
    ADAPTER_COMPLIANCE_RULE_IDS.map((ruleId) => ({
      ruleId,
      description: RULE_DESCRIPTIONS[ruleId],
      mandatory: true,
    })),
  ),
})

export interface CreateAdapterCompliancePortInput {
  readonly suite?: AdapterComplianceSuite
  readonly verifier?: AdapterContractVerifier
}

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

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function isKnownRuleId(value: string): value is AdapterComplianceRuleId {
  return RULE_ID_SET.has(value)
}

function isKnownScenarioType(value: string): value is AdapterTestScenarioType {
  return SCENARIO_TYPE_SET.has(value)
}

function isKnownFailureCode(value: string): value is LLMFailureCode {
  return LLM_FAILURE_CODE_SET.has(value)
}

function isKnownCapabilityFlag(value: string): value is LLMCapabilityFlag {
  return LLM_CAPABILITY_FLAG_SET.has(value)
}

function isKnownDeclarativeCapability(value: string): value is LLMDeclarativeCapability {
  return DECLARATIVE_CAPABILITY_SET.has(value)
}

function canonicalFailureCodes(codes: readonly LLMFailureCode[]): readonly LLMFailureCode[] {
  const unique = new Set<LLMFailureCode>()
  for (const code of codes) {
    unique.add(code)
  }

  return [...unique].sort((left, right) => LLM_FAILURE_CODE_RANK[left] - LLM_FAILURE_CODE_RANK[right])
}

function canonicalRules(rules: readonly AdapterComplianceRule[]): readonly AdapterComplianceRule[] {
  const deduplicated = new Map<AdapterComplianceRuleId, AdapterComplianceRule>()
  for (const rule of rules) {
    deduplicated.set(rule.ruleId, {
      ruleId: rule.ruleId,
      description: rule.description,
      mandatory: true,
    })
  }

  return [...deduplicated.values()].sort((left, right) => {
    const byRank = RULE_RANK[left.ruleId] - RULE_RANK[right.ruleId]
    if (byRank !== 0) {
      return byRank
    }

    return compareStrings(left.description, right.description)
  })
}

function canonicalDeclarativeCapabilities(
  capabilities: readonly LLMDeclarativeCapability[],
): readonly LLMDeclarativeCapability[] {
  const rank = LLM_DECLARATIVE_CAPABILITIES.reduce((accumulator, capability, index) => {
    accumulator[capability] = index
    return accumulator
  }, {} as Record<LLMDeclarativeCapability, number>)

  const unique = new Set<LLMDeclarativeCapability>()
  for (const capability of capabilities) {
    unique.add(capability)
  }

  return [...unique].sort((left, right) => rank[left] - rank[right])
}

function canonicalCapabilityFlags(
  flags: readonly LLMCapabilityFlag[],
): readonly LLMCapabilityFlag[] {
  const rank = LLM_CAPABILITY_FLAGS.reduce((accumulator, flag, index) => {
    accumulator[flag] = index
    return accumulator
  }, {} as Record<LLMCapabilityFlag, number>)

  const unique = new Set<LLMCapabilityFlag>()
  for (const flag of flags) {
    unique.add(flag)
  }

  return [...unique].sort((left, right) => rank[left] - rank[right])
}

function parseComplianceSuite(value: unknown): AdapterComplianceSuite {
  if (!isRecord(value)) {
    return deepClone(DEFAULT_COMPLIANCE_SUITE)
  }

  const suiteId = value.suiteId
  const suiteVersion = value.suiteVersion
  const protocolVersion = value.protocolVersion
  const deterministic = value.deterministic
  const failClosed = value.failClosed
  const rulesRaw = value.rules

  if (
    !isNonEmptyString(suiteId) ||
    !isNonEmptyString(suiteVersion) ||
    typeof protocolVersion !== 'number' ||
    !LLM_PROTOCOL_VERSIONS.includes(protocolVersion as LLMProtocolVersion) ||
    deterministic !== true ||
    failClosed !== true ||
    !Array.isArray(rulesRaw)
  ) {
    return deepClone(DEFAULT_COMPLIANCE_SUITE)
  }

  const parsedRules: AdapterComplianceRule[] = []
  for (const entry of rulesRaw) {
    if (!isRecord(entry)) {
      return deepClone(DEFAULT_COMPLIANCE_SUITE)
    }

    const ruleId = entry.ruleId
    const description = entry.description

    if (
      typeof ruleId !== 'string' ||
      !isKnownRuleId(ruleId) ||
      !isNonEmptyString(description) ||
      entry.mandatory !== true
    ) {
      return deepClone(DEFAULT_COMPLIANCE_SUITE)
    }

    parsedRules.push({
      ruleId,
      description,
      mandatory: true,
    })
  }

  if (parsedRules.length === 0) {
    return deepClone(DEFAULT_COMPLIANCE_SUITE)
  }

  return {
    suiteId,
    suiteVersion,
    protocolVersion: protocolVersion as LLMProtocolVersion,
    deterministic: true,
    failClosed: true,
    rules: canonicalRules(parsedRules),
  }
}

function parseCapabilityAssertion(value: unknown): AdapterCapabilityAssertion | null {
  if (!isRecord(value)) {
    return null
  }

  const protocolVersion = value.protocolVersion
  const executionMode = value.executionMode
  const requiredCapabilityFlagsRaw = value.requiredCapabilityFlags
  const requiredDeclarativeCapabilitiesRaw = value.requiredDeclarativeCapabilities

  if (
    typeof protocolVersion !== 'number' ||
    !LLM_PROTOCOL_VERSIONS.includes(protocolVersion as LLMProtocolVersion) ||
    (executionMode !== 'LOCAL_ONLY' && executionMode !== 'EXTERNAL_PROVIDER') ||
    !Array.isArray(requiredCapabilityFlagsRaw) ||
    !Array.isArray(requiredDeclarativeCapabilitiesRaw)
  ) {
    return null
  }

  const requiredCapabilityFlags: LLMCapabilityFlag[] = []
  for (const entry of requiredCapabilityFlagsRaw) {
    if (typeof entry !== 'string' || !isKnownCapabilityFlag(entry)) {
      return null
    }

    requiredCapabilityFlags.push(entry)
  }

  const requiredDeclarativeCapabilities: LLMDeclarativeCapability[] = []
  for (const entry of requiredDeclarativeCapabilitiesRaw) {
    if (typeof entry !== 'string' || !isKnownDeclarativeCapability(entry)) {
      return null
    }

    requiredDeclarativeCapabilities.push(entry)
  }

  const requiredProviderVersion = value.requiredProviderVersion
  if (requiredProviderVersion !== undefined && !isNonEmptyString(requiredProviderVersion)) {
    return null
  }

  if (
    value.requireDeterministicContracts !== true ||
    value.requireContextPackageOnly !== true ||
    value.requireFailClosed !== true
  ) {
    return null
  }

  return {
    protocolVersion: protocolVersion as LLMProtocolVersion,
    executionMode: executionMode as LLMExecutionMode,
    ...(requiredProviderVersion === undefined ? {} : { requiredProviderVersion }),
    requiredCapabilityFlags: canonicalCapabilityFlags(requiredCapabilityFlags),
    requiredDeclarativeCapabilities: canonicalDeclarativeCapabilities(
      requiredDeclarativeCapabilities,
    ),
    requireDeterministicContracts: true,
    requireContextPackageOnly: true,
    requireFailClosed: true,
  }
}

function parseRequest(value: unknown): LLMRequest | null {
  if (!isRecord(value)) {
    return null
  }

  const requestId = value.requestId
  const protocolVersion = value.protocolVersion
  const executionMode = value.executionMode
  const contextPackage = value.contextPackage
  const provider = value.provider
  const tokenBudget = value.tokenBudget
  const requiredCapabilityFlagsRaw = value.requiredCapabilityFlags
  const traceability = value.traceability

  if (
    !isNonEmptyString(requestId) ||
    typeof protocolVersion !== 'number' ||
    !LLM_PROTOCOL_VERSIONS.includes(protocolVersion as LLMProtocolVersion) ||
    (executionMode !== 'LOCAL_ONLY' && executionMode !== 'EXTERNAL_PROVIDER') ||
    !isRecord(contextPackage) ||
    !isRecord(provider) ||
    !isRecord(provider.capabilities) ||
    !isRecord(tokenBudget) ||
    !Array.isArray(requiredCapabilityFlagsRaw) ||
    !isRecord(traceability)
  ) {
    return null
  }

  const contextRequestId = contextPackage.requestId
  const contextPurpose = contextPackage.purpose
  const contextProcessingMode = contextPackage.processingMode
  const contextPolicyVersion = contextPackage.policyVersion
  const contextProtocolVersion = contextPackage.protocolVersion

  if (
    !isNonEmptyString(contextRequestId) ||
    !isNonEmptyString(contextPurpose) ||
    !isNonEmptyString(contextProcessingMode) ||
    !isNonEmptyString(contextPolicyVersion) ||
    typeof contextProtocolVersion !== 'number' ||
    !LLM_PROTOCOL_VERSIONS.includes(contextProtocolVersion as LLMProtocolVersion)
  ) {
    return null
  }

  const providerId = provider.providerId
  const providerVersion = provider.providerVersion
  const providerProtocolVersion = provider.protocolVersion

  if (
    !isNonEmptyString(providerId) ||
    !isNonEmptyString(providerVersion) ||
    typeof providerProtocolVersion !== 'number' ||
    !LLM_PROTOCOL_VERSIONS.includes(providerProtocolVersion as LLMProtocolVersion)
  ) {
    return null
  }

  const supportedProtocolVersionsRaw = provider.capabilities.supportedProtocolVersions
  const supportedExecutionModesRaw = provider.capabilities.supportedExecutionModes
  const capabilityFlagsRaw = provider.capabilities.capabilityFlags

  if (
    !Array.isArray(supportedProtocolVersionsRaw) ||
    !Array.isArray(supportedExecutionModesRaw) ||
    !Array.isArray(capabilityFlagsRaw) ||
    provider.capabilities.supportsDeterministicContracts !== true ||
    provider.capabilities.acceptsContextPackageOnly !== true
  ) {
    return null
  }

  const supportedProtocolVersions: LLMProtocolVersion[] = []
  for (const entry of supportedProtocolVersionsRaw) {
    if (typeof entry !== 'number' || !LLM_PROTOCOL_VERSIONS.includes(entry as LLMProtocolVersion)) {
      return null
    }

    supportedProtocolVersions.push(entry as LLMProtocolVersion)
  }

  const supportedExecutionModes: LLMExecutionMode[] = []
  for (const entry of supportedExecutionModesRaw) {
    if (entry !== 'LOCAL_ONLY' && entry !== 'EXTERNAL_PROVIDER') {
      return null
    }

    supportedExecutionModes.push(entry)
  }

  const capabilityFlags: LLMCapabilityFlag[] = []
  for (const entry of capabilityFlagsRaw) {
    if (typeof entry !== 'string' || !isKnownCapabilityFlag(entry)) {
      return null
    }

    capabilityFlags.push(entry)
  }

  if (
    !isSafeNonNegativeInteger(provider.capabilities.maxInputTokens) ||
    !isSafeNonNegativeInteger(provider.capabilities.maxOutputTokens)
  ) {
    return null
  }

  if (
    !isSafeNonNegativeInteger(tokenBudget.inputTokenLimit) ||
    !isSafeNonNegativeInteger(tokenBudget.outputTokenLimit) ||
    !isSafeNonNegativeInteger(tokenBudget.totalTokenLimit) ||
    !isSafeNonNegativeInteger(tokenBudget.reservedOutputTokens)
  ) {
    return null
  }

  const requiredCapabilityFlags: LLMCapabilityFlag[] = []
  for (const entry of requiredCapabilityFlagsRaw) {
    if (typeof entry !== 'string' || !isKnownCapabilityFlag(entry)) {
      return null
    }

    requiredCapabilityFlags.push(entry)
  }

  if (
    !isNonEmptyString(traceability.traceId) ||
    !isNonEmptyString(traceability.relationId) ||
    !isNonEmptyString(traceability.requestId) ||
    !isNonEmptyString(traceability.contextRequestId) ||
    !isNonEmptyString(traceability.policyVersion)
  ) {
    return null
  }

  return {
    requestId,
    protocolVersion: protocolVersion as LLMProtocolVersion,
    executionMode: executionMode as LLMExecutionMode,
    contextPackage: deepClone(
      contextPackage as unknown as LLMRequest['contextPackage'],
    ),
    provider: {
      providerId,
      providerVersion,
      protocolVersion: providerProtocolVersion as LLMProtocolVersion,
      capabilities: {
        supportedProtocolVersions,
        supportedExecutionModes,
        capabilityFlags: canonicalCapabilityFlags(capabilityFlags),
        maxInputTokens: provider.capabilities.maxInputTokens,
        maxOutputTokens: provider.capabilities.maxOutputTokens,
        supportsDeterministicContracts: true,
        acceptsContextPackageOnly: true,
      },
    },
    tokenBudget: {
      inputTokenLimit: tokenBudget.inputTokenLimit,
      outputTokenLimit: tokenBudget.outputTokenLimit,
      totalTokenLimit: tokenBudget.totalTokenLimit,
      reservedOutputTokens: tokenBudget.reservedOutputTokens,
    },
    requiredCapabilityFlags: canonicalCapabilityFlags(requiredCapabilityFlags),
    traceability: {
      traceId: traceability.traceId,
      relationId: traceability.relationId,
      requestId: traceability.requestId,
      contextRequestId: traceability.contextRequestId,
      policyVersion: traceability.policyVersion,
    },
  }
}

function parseAllowedFailureCodes(value: unknown): readonly LLMFailureCode[] | null {
  if (!Array.isArray(value)) {
    return canonicalFailureCodes(DEFAULT_ALLOWED_FAILURE_CODES)
  }

  const codes: LLMFailureCode[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || !isKnownFailureCode(entry)) {
      return null
    }

    codes.push(entry)
  }

  if (codes.length === 0) {
    return canonicalFailureCodes(DEFAULT_ALLOWED_FAILURE_CODES)
  }

  return canonicalFailureCodes(codes)
}

function parseDeclaredCapabilities(
  value: unknown,
): readonly LLMDeclarativeCapability[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const capabilities: LLMDeclarativeCapability[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || !isKnownDeclarativeCapability(entry)) {
      return null
    }

    capabilities.push(entry)
  }

  return canonicalDeclarativeCapabilities(capabilities)
}

function parseFixture(fixture: AdapterFixture | null | undefined): AdapterFixture | null {
  if (!isRecord(fixture)) {
    return null
  }

  const fixtureId = fixture.fixtureId
  const request = parseRequest(fixture.request)
  const capabilityAssertion = parseCapabilityAssertion(fixture.capabilityAssertion)
  const declaredCapabilities = parseDeclaredCapabilities(fixture.declaredCapabilities)
  const allowedFailureCodes = parseAllowedFailureCodes(fixture.allowedFailureCodes)

  if (
    !isNonEmptyString(fixtureId) ||
    !isRecord(fixture.privacyBoundary) ||
    typeof fixture.privacyBoundary.authorize !== 'function' ||
    !isRecord(fixture.adapter) ||
    request === null ||
    capabilityAssertion === null ||
    declaredCapabilities === null ||
    allowedFailureCodes === null
  ) {
    return null
  }

  return {
    fixtureId,
    privacyBoundary: fixture.privacyBoundary,
    privacyRequest: deepClone(fixture.privacyRequest),
    adapter: fixture.adapter as LLMAdapterPort,
    request,
    capabilityAssertion,
    declaredCapabilities,
    allowedFailureCodes,
    ...(fixture.metadata === undefined
      ? {}
      : { metadata: deepClone(fixture.metadata) }),
  }
}

function parseScenarios(
  scenarios: readonly AdapterTestScenario[] | undefined,
  request: LLMRequest,
  allowedFailureCodes: readonly LLMFailureCode[],
): readonly AdapterTestScenario[] {
  if (scenarios === undefined) {
    const invalidContextRequest = {
      ...deepClone(request),
      contextPackage: {
        invalid: true,
      },
    } as unknown as LLMRequest

    return deepFreeze([
      {
        scenarioId: 'scenario:baseline',
        scenarioType: 'BASELINE',
        request: deepClone(request),
        expectedStatus: 'success',
      },
      {
        scenarioId: 'scenario:invalid-context-package',
        scenarioType: 'INVALID_CONTEXT_PACKAGE',
        request: invalidContextRequest,
        expectedStatus: 'failure',
        expectedFailureCodes: canonicalFailureCodes(allowedFailureCodes),
      },
      {
        scenarioId: 'scenario:fail-closed-request',
        scenarioType: 'FAIL_CLOSED_REQUEST',
        request: null,
        expectedStatus: 'failure',
        expectedFailureCodes: canonicalFailureCodes(allowedFailureCodes),
      },
    ])
  }

  const parsed: AdapterTestScenario[] = []
  for (const entry of scenarios) {
    if (!isRecord(entry)) {
      continue
    }

    const scenarioId = entry.scenarioId
    const scenarioType = entry.scenarioType
    const expectedStatus = entry.expectedStatus

    if (
      !isNonEmptyString(scenarioId) ||
      typeof scenarioType !== 'string' ||
      !isKnownScenarioType(scenarioType) ||
      (expectedStatus !== 'success' && expectedStatus !== 'failure')
    ) {
      continue
    }

    const expectedFailureCodesRaw = entry.expectedFailureCodes
    let expectedFailureCodes: readonly LLMFailureCode[] | undefined

    if (expectedFailureCodesRaw !== undefined) {
      const parsedCodes = parseAllowedFailureCodes(expectedFailureCodesRaw)
      if (parsedCodes === null) {
        continue
      }

      expectedFailureCodes = parsedCodes
    }

    parsed.push({
      scenarioId,
      scenarioType,
      request: entry.request,
      expectedStatus,
      ...(expectedFailureCodes === undefined ? {} : { expectedFailureCodes }),
    })
  }

  if (parsed.length === 0) {
    return parseScenarios(undefined, request, allowedFailureCodes)
  }

  const deduplicated = new Map<string, AdapterTestScenario>()
  for (const entry of parsed) {
    deduplicated.set(entry.scenarioId, entry)
  }

  const ordered = [...deduplicated.values()].sort((left, right) => {
    const byType =
      SCENARIO_TYPE_RANK[left.scenarioType] -
      SCENARIO_TYPE_RANK[right.scenarioType]

    if (byType !== 0) {
      return byType
    }

    return compareStrings(left.scenarioId, right.scenarioId)
  })

  return deepFreeze(ordered)
}

function findScenario(
  scenarios: readonly AdapterTestScenario[],
  scenarioType: AdapterTestScenarioType,
): AdapterTestScenario | null {
  for (const scenario of scenarios) {
    if (scenario.scenarioType === scenarioType) {
      return scenario
    }
  }

  return null
}

function isJsonSafe(
  value: unknown,
  ancestors: ReadonlySet<object> = new Set(),
): boolean {
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
    return value.every((entry) => isJsonSafe(entry, ancestors))
  }

  if (!isRecord(value)) {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  for (const entry of Object.values(value)) {
    if (!isJsonSafe(entry, nextAncestors)) {
      return false
    }
  }

  return true
}

function asAuthorizationSuccess(
  result: AIPrivacyAuthorizationResult,
): AIAuthorizedRequestEnvelope | null {
  if (!isRecord(result) || result.ok !== true || result.status !== 'success') {
    return null
  }

  if (!isRecord(result.envelope)) {
    return null
  }

  return result.envelope as AIAuthorizedRequestEnvelope
}

function invoke(
  adapter: LLMAdapterPort,
  request: LLMRequest | null | undefined,
): LLMInvocationResult | null {
  if (!isRecord(adapter) || typeof adapter.invoke !== 'function') {
    return null
  }

  try {
    return adapter.invoke(request)
  }
  catch {
    return null
  }
}

function createFailure(input: {
  readonly code: AdapterComplianceFailureCode
  readonly message: string
  readonly ruleId?: AdapterComplianceRuleId
  readonly details?: AdapterComplianceFailure['details']
}): AdapterComplianceFailure {
  return {
    code: input.code,
    message: input.message,
    ...(input.ruleId === undefined ? {} : { ruleId: input.ruleId }),
    ...(input.details === undefined ? {} : { details: input.details }),
  }
}

function createValidationPass(ruleId: AdapterComplianceRuleId): AdapterValidationResult {
  return {
    ruleId,
    passed: true,
  }
}

function createValidationFailure(input: {
  readonly ruleId: AdapterComplianceRuleId
  readonly code: AdapterComplianceFailureCode
  readonly message: string
  readonly details?: AdapterComplianceFailure['details']
}): AdapterValidationResult {
  return {
    ruleId: input.ruleId,
    passed: false,
    failure: createFailure({
      ruleId: input.ruleId,
      code: input.code,
      message: input.message,
      ...(input.details === undefined ? {} : { details: input.details }),
    }),
  }
}

function verifyAdapterPortImplemented(
  fixture: AdapterFixture,
): AdapterValidationResult {
  if (!isRecord(fixture.adapter) || typeof fixture.adapter.invoke !== 'function') {
    return createValidationFailure({
      ruleId: 'ADAPTER_PORT_IMPLEMENTED',
      code: 'ADAPTER_PORT_MISSING',
      message: 'adapter fixture must implement invoke(request)',
    })
  }

  const baselineResult = invoke(fixture.adapter, fixture.request)
  if (!isRecord(baselineResult)) {
    return createValidationFailure({
      ruleId: 'ADAPTER_PORT_IMPLEMENTED',
      code: 'INVALID_INVOCATION_RESULT',
      message: 'adapter invocation must return a contract result object',
    })
  }

  if (baselineResult.ok !== true && baselineResult.ok !== false) {
    return createValidationFailure({
      ruleId: 'ADAPTER_PORT_IMPLEMENTED',
      code: 'INVALID_INVOCATION_RESULT',
      message: 'adapter invocation result must include a boolean ok discriminator',
    })
  }

  return createValidationPass('ADAPTER_PORT_IMPLEMENTED')
}

function verifyPrivacyBoundary(
  fixture: AdapterFixture,
): AdapterValidationResult {
  if (!isRecord(fixture.privacyBoundary) || typeof fixture.privacyBoundary.authorize !== 'function') {
    return createValidationFailure({
      ruleId: 'PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED',
      code: 'PRIVACY_BOUNDARY_VIOLATION',
      message: 'privacy boundary must expose authorize(request)',
    })
  }

  let authorization: AIPrivacyAuthorizationResult
  try {
    authorization = fixture.privacyBoundary.authorize(fixture.privacyRequest)
  }
  catch {
    return createValidationFailure({
      ruleId: 'PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED',
      code: 'PRIVACY_BOUNDARY_VIOLATION',
      message: 'privacy boundary authorization threw an exception',
    })
  }

  const envelope = asAuthorizationSuccess(authorization)
  if (envelope === null) {
    return createValidationFailure({
      ruleId: 'PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED',
      code: 'PRIVACY_BOUNDARY_VIOLATION',
      message: 'privacy boundary must authorize fixture request for compliance run',
    })
  }

  const contextPackage = fixture.request.contextPackage
  const matchesEnvelope =
    envelope.requestId === contextPackage.requestId &&
    envelope.purpose === contextPackage.purpose &&
    envelope.processingMode === contextPackage.processingMode &&
    envelope.policy.policyVersion === contextPackage.policyVersion &&
    envelope.policy.protocolVersion === contextPackage.protocolVersion

  if (!matchesEnvelope) {
    return createValidationFailure({
      ruleId: 'PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED',
      code: 'PRIVACY_BOUNDARY_VIOLATION',
      message: 'authorized envelope must match adapter context package invariants',
      details: {
        contextRequestId: contextPackage.requestId,
        envelopeRequestId: envelope.requestId,
      },
    })
  }

  return createValidationPass('PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED')
}

function verifyCapabilityDeclaration(
  fixture: AdapterFixture,
): AdapterValidationResult {
  const assertion = fixture.capabilityAssertion
  const providerCapabilities = fixture.request.provider.capabilities

  if (
    assertion.requireDeterministicContracts !== true ||
    assertion.requireContextPackageOnly !== true ||
    assertion.requireFailClosed !== true ||
    providerCapabilities.supportsDeterministicContracts !== true ||
    providerCapabilities.acceptsContextPackageOnly !== true
  ) {
    return createValidationFailure({
      ruleId: 'CAPABILITY_DECLARATION_VALID',
      code: 'CAPABILITY_ASSERTION_FAILED',
      message: 'capability declaration must enforce deterministic and context-only contracts',
    })
  }

  if (
    fixture.request.protocolVersion !== assertion.protocolVersion ||
    fixture.request.executionMode !== assertion.executionMode
  ) {
    return createValidationFailure({
      ruleId: 'CAPABILITY_DECLARATION_VALID',
      code: 'CAPABILITY_ASSERTION_FAILED',
      message: 'request protocol or execution mode does not match capability assertion',
    })
  }

  for (const requiredFlag of assertion.requiredCapabilityFlags) {
    if (!providerCapabilities.capabilityFlags.includes(requiredFlag)) {
      return createValidationFailure({
        ruleId: 'CAPABILITY_DECLARATION_VALID',
        code: 'CAPABILITY_ASSERTION_FAILED',
        message: 'provider capability flags do not satisfy mandatory assertion',
        details: {
          requiredFlag,
        },
      })
    }
  }

  for (const requiredCapability of assertion.requiredDeclarativeCapabilities) {
    if (!fixture.declaredCapabilities.includes(requiredCapability)) {
      return createValidationFailure({
        ruleId: 'CAPABILITY_DECLARATION_VALID',
        code: 'CAPABILITY_ASSERTION_FAILED',
        message: 'declared capabilities do not satisfy mandatory assertion',
        details: {
          requiredCapability,
        },
      })
    }
  }

  return createValidationPass('CAPABILITY_DECLARATION_VALID')
}

function verifyProtocolVersionCompatibility(
  fixture: AdapterFixture,
): AdapterValidationResult {
  const request = fixture.request
  const assertion = fixture.capabilityAssertion

  const compatible =
    request.protocolVersion === assertion.protocolVersion &&
    request.provider.protocolVersion === request.protocolVersion &&
    request.provider.capabilities.supportedProtocolVersions.includes(
      request.protocolVersion,
    )

  if (!compatible) {
    return createValidationFailure({
      ruleId: 'PROTOCOL_VERSION_COMPATIBLE',
      code: 'PROTOCOL_VERSION_INCOMPATIBLE',
      message: 'protocol version compatibility contract failed',
      details: {
        requestProtocolVersion: request.protocolVersion,
        assertionProtocolVersion: assertion.protocolVersion,
      },
    })
  }

  return createValidationPass('PROTOCOL_VERSION_COMPATIBLE')
}

function verifyProviderVersionCompatibility(
  fixture: AdapterFixture,
): AdapterValidationResult {
  const requiredVersion = fixture.capabilityAssertion.requiredProviderVersion
  if (requiredVersion === undefined) {
    return createValidationPass('PROVIDER_VERSION_COMPATIBLE')
  }

  if (fixture.request.provider.providerVersion !== requiredVersion) {
    return createValidationFailure({
      ruleId: 'PROVIDER_VERSION_COMPATIBLE',
      code: 'PROVIDER_VERSION_INCOMPATIBLE',
      message: 'provider version does not satisfy required capability assertion',
      details: {
        requiredVersion,
        providerVersion: fixture.request.provider.providerVersion,
      },
    })
  }

  return createValidationPass('PROVIDER_VERSION_COMPATIBLE')
}

function verifyScenarioFailureExpectation(input: {
  readonly ruleId: AdapterComplianceRuleId
  readonly result: LLMInvocationResult | null
  readonly scenario: AdapterTestScenario
  readonly fallbackFailureCodes: readonly LLMFailureCode[]
  readonly missingMessage: string
  readonly invalidMessage: string
}): AdapterValidationResult {
  if (input.result === null || !isRecord(input.result)) {
    return createValidationFailure({
      ruleId: input.ruleId,
      code: 'INVALID_INVOCATION_RESULT',
      message: input.invalidMessage,
    })
  }

  if (input.result.ok !== false || input.result.status !== 'failure') {
    return createValidationFailure({
      ruleId: input.ruleId,
      code: 'FAIL_CLOSED_VIOLATION',
      message: input.missingMessage,
    })
  }

  if (input.result.failClosed !== true || input.result.deterministic !== true) {
    return createValidationFailure({
      ruleId: input.ruleId,
      code: 'FAIL_CLOSED_VIOLATION',
      message: 'adapter failure result must preserve failClosed and deterministic true',
    })
  }

  const expectedFailureCodes =
    input.scenario.expectedFailureCodes === undefined
      ? input.fallbackFailureCodes
      : input.scenario.expectedFailureCodes

  if (expectedFailureCodes.length > 0 && !expectedFailureCodes.includes(input.result.code)) {
    return createValidationFailure({
      ruleId: input.ruleId,
      code: 'FAIL_CLOSED_VIOLATION',
      message: 'adapter failure code does not match allowed scenario codes',
      details: {
        resultCode: input.result.code,
      },
    })
  }

  return createValidationPass(input.ruleId)
}

function verifyContextPackageOnly(
  fixture: AdapterFixture,
  scenarios: readonly AdapterTestScenario[],
): AdapterValidationResult {
  const scenario = findScenario(scenarios, 'INVALID_CONTEXT_PACKAGE')
  if (scenario === null) {
    return createValidationFailure({
      ruleId: 'ACCEPTS_CONTEXT_PACKAGE_ONLY',
      code: 'INVALID_SCENARIO',
      message: 'scenario INVALID_CONTEXT_PACKAGE is required by compliance suite',
    })
  }

  const result = invoke(fixture.adapter, scenario.request)
  const validation = verifyScenarioFailureExpectation({
    ruleId: 'ACCEPTS_CONTEXT_PACKAGE_ONLY',
    result,
    scenario,
    fallbackFailureCodes: fixture.allowedFailureCodes,
    missingMessage: 'adapter must reject invalid context package requests',
    invalidMessage: 'adapter must return a valid failure result for invalid context package',
  })

  if (!validation.passed) {
    return createValidationFailure({
      ruleId: 'ACCEPTS_CONTEXT_PACKAGE_ONLY',
      code: 'CONTEXT_PACKAGE_ONLY_VIOLATION',
      message: validation.failure?.message ?? 'context package only rule failed',
      ...(validation.failure?.details === undefined
        ? {}
        : { details: validation.failure.details }),
    })
  }

  return validation
}

function verifyFailClosed(
  fixture: AdapterFixture,
  scenarios: readonly AdapterTestScenario[],
): AdapterValidationResult {
  const scenario = findScenario(scenarios, 'FAIL_CLOSED_REQUEST')
  if (scenario === null) {
    return createValidationFailure({
      ruleId: 'FAIL_CLOSED_ENFORCED',
      code: 'INVALID_SCENARIO',
      message: 'scenario FAIL_CLOSED_REQUEST is required by compliance suite',
    })
  }

  return verifyScenarioFailureExpectation({
    ruleId: 'FAIL_CLOSED_ENFORCED',
    result: invoke(fixture.adapter, scenario.request),
    scenario,
    fallbackFailureCodes: fixture.allowedFailureCodes,
    missingMessage: 'adapter must fail closed for invalid requests',
    invalidMessage: 'adapter must return a valid failure result for fail-closed scenario',
  })
}

function verifyContractResult(
  fixture: AdapterFixture,
  scenarios: readonly AdapterTestScenario[],
): AdapterValidationResult {
  const scenario = findScenario(scenarios, 'BASELINE')
  if (scenario === null) {
    return createValidationFailure({
      ruleId: 'CONTRACT_RESULT_VALID',
      code: 'INVALID_SCENARIO',
      message: 'scenario BASELINE is required by compliance suite',
    })
  }

  const first = invoke(fixture.adapter, scenario.request)
  const second = invoke(fixture.adapter, scenario.request)

  if (first === null || second === null || !isRecord(first) || !isRecord(second)) {
    return createValidationFailure({
      ruleId: 'CONTRACT_RESULT_VALID',
      code: 'INVALID_INVOCATION_RESULT',
      message: 'adapter baseline invocation must return a structured result',
    })
  }

  if (JSON.stringify(first) !== JSON.stringify(second)) {
    return createValidationFailure({
      ruleId: 'CONTRACT_RESULT_VALID',
      code: 'DETERMINISM_VIOLATION',
      message: 'same baseline input must produce exactly the same output',
    })
  }

  if (first.deterministic !== true || first.failClosed !== true) {
    return createValidationFailure({
      ruleId: 'CONTRACT_RESULT_VALID',
      code: 'INVALID_INVOCATION_RESULT',
      message: 'baseline invocation must preserve deterministic and failClosed metadata',
    })
  }

  if (!isJsonSafe(first)) {
    return createValidationFailure({
      ruleId: 'CONTRACT_RESULT_VALID',
      code: 'INVALID_INVOCATION_RESULT',
      message: 'baseline invocation result must be JSON-safe',
    })
  }

  if (scenario.expectedStatus === 'success') {
    if (first.ok !== true || first.status !== 'success' || !isRecord(first.response)) {
      return createValidationFailure({
        ruleId: 'CONTRACT_RESULT_VALID',
        code: 'INVALID_INVOCATION_RESULT',
        message: 'baseline scenario expects success response contract',
      })
    }

    const response = first.response
    if (
      response.requestId !== fixture.request.requestId ||
      response.providerId !== fixture.request.provider.providerId ||
      response.providerVersion !== fixture.request.provider.providerVersion ||
      response.protocolVersion !== fixture.request.protocolVersion ||
      response.executionMode !== fixture.request.executionMode
    ) {
      return createValidationFailure({
        ruleId: 'CONTRACT_RESULT_VALID',
        code: 'INVALID_INVOCATION_RESULT',
        message: 'success response fields must be traceable to baseline request',
      })
    }

    if (
      !isRecord(response.tokenUsage) ||
      !isSafeNonNegativeInteger(response.tokenUsage.inputTokens) ||
      !isSafeNonNegativeInteger(response.tokenUsage.outputTokens) ||
      !isSafeNonNegativeInteger(response.tokenUsage.totalTokens)
    ) {
      return createValidationFailure({
        ruleId: 'CONTRACT_RESULT_VALID',
        code: 'INVALID_INVOCATION_RESULT',
        message: 'success response token usage must be non-negative safe integers',
      })
    }

    if (!isRecord(response.output)) {
      return createValidationFailure({
        ruleId: 'CONTRACT_RESULT_VALID',
        code: 'INVALID_INVOCATION_RESULT',
        message: 'success response output must be a JSON object',
      })
    }

    return createValidationPass('CONTRACT_RESULT_VALID')
  }

  if (first.ok !== false || first.status !== 'failure') {
    return createValidationFailure({
      ruleId: 'CONTRACT_RESULT_VALID',
      code: 'INVALID_INVOCATION_RESULT',
      message: 'baseline scenario expects failure response contract',
    })
  }

  if (!isKnownFailureCode(first.code) || !isNonEmptyString(first.message)) {
    return createValidationFailure({
      ruleId: 'CONTRACT_RESULT_VALID',
      code: 'INVALID_INVOCATION_RESULT',
      message: 'failure response must expose known failure code and message',
    })
  }

  return createValidationPass('CONTRACT_RESULT_VALID')
}

function createInvalidFixtureReport(
  suite: AdapterComplianceSuite,
): AdapterComplianceReport {
  const failure = createFailure({
    code: 'INVALID_FIXTURE',
    message: 'adapter compliance fixture must be valid and complete',
  })

  return deepFreeze({
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    suiteId: suite.suiteId,
    suiteVersion: suite.suiteVersion,
    protocolVersion: suite.protocolVersion,
    fixtureId: null,
    results: [],
    failures: [failure],
    summary: {
      totalRules: 0,
      passedRules: 0,
      failedRules: 1,
    },
  })
}

function toComplianceReport(input: {
  readonly suite: AdapterComplianceSuite
  readonly fixtureId: string
  readonly results: readonly AdapterValidationResult[]
}): AdapterComplianceReport {
  const failures = input.results
    .map((result) => result.failure)
    .filter((failure): failure is AdapterComplianceFailure => failure !== undefined)

  const passedRules = input.results.filter((result) => result.passed).length
  const failedRules = failures.length

  return deepFreeze({
    ok: failedRules === 0,
    status: failedRules === 0 ? 'success' : 'failure',
    deterministic: true,
    failClosed: true,
    suiteId: input.suite.suiteId,
    suiteVersion: input.suite.suiteVersion,
    protocolVersion: input.suite.protocolVersion,
    fixtureId: input.fixtureId,
    results: deepClone(input.results),
    failures: deepClone(failures),
    summary: {
      totalRules: input.results.length,
      passedRules,
      failedRules,
    },
  })
}

export function createDefaultAdapterComplianceSuite(): AdapterComplianceSuite {
  return deepClone(DEFAULT_COMPLIANCE_SUITE)
}

export function createAdapterContractVerifier(): AdapterContractVerifier {
  return {
    verifyRule(rule, fixture, scenarios): AdapterValidationResult {
      switch (rule.ruleId) {
        case 'ADAPTER_PORT_IMPLEMENTED':
          return verifyAdapterPortImplemented(fixture)

        case 'PRIVACY_BOUNDARY_AUTHORIZATION_REQUIRED':
          return verifyPrivacyBoundary(fixture)

        case 'CAPABILITY_DECLARATION_VALID':
          return verifyCapabilityDeclaration(fixture)

        case 'PROTOCOL_VERSION_COMPATIBLE':
          return verifyProtocolVersionCompatibility(fixture)

        case 'PROVIDER_VERSION_COMPATIBLE':
          return verifyProviderVersionCompatibility(fixture)

        case 'ACCEPTS_CONTEXT_PACKAGE_ONLY':
          return verifyContextPackageOnly(fixture, scenarios)

        case 'FAIL_CLOSED_ENFORCED':
          return verifyFailClosed(fixture, scenarios)

        case 'CONTRACT_RESULT_VALID':
          return verifyContractResult(fixture, scenarios)

        default:
          return createValidationFailure({
            ruleId: rule.ruleId,
            code: 'INCONSISTENT_VALIDATION_STATE',
            message: 'unknown rule identifier in compliance suite',
          })
      }
    },
  }
}

export function createAdapterCompliancePort(
  input: CreateAdapterCompliancePortInput = {},
): AdapterCompliancePort {
  const suite = parseComplianceSuite(input.suite)
  const verifier = input.verifier ?? createAdapterContractVerifier()

  return {
    runCompliance(
      fixture: AdapterFixture | null | undefined,
      scenarios?: readonly AdapterTestScenario[],
    ): AdapterComplianceReport {
      const parsedFixture = parseFixture(fixture)
      if (parsedFixture === null) {
        return createInvalidFixtureReport(suite)
      }

      const parsedScenarios = parseScenarios(
        scenarios,
        parsedFixture.request,
        parsedFixture.allowedFailureCodes,
      )

      const results = suite.rules.map((rule) => {
        return verifier.verifyRule(rule, parsedFixture, parsedScenarios)
      })

      return toComplianceReport({
        suite,
        fixtureId: parsedFixture.fixtureId,
        results,
      })
    },
  }
}

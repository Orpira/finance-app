import {
  AI_PURPOSES,
  type AIPurpose,
} from './aiFoundationContracts'
import {
  LLM_EXECUTION_MODES,
  LLM_PROTOCOL_VERSIONS,
  type LLMExecutionMode,
  type LLMProtocolVersion,
} from './llmAdapterContracts'
import type {
  AdapterResolutionFailure,
  AdapterResolutionFailureCode,
  AdapterResolutionRequest,
  AdapterResolutionResult,
  AdapterResolutionSuccess,
  AdapterSelectionPolicy,
  CapabilityValidationResult,
  LLMCapabilityResolver,
  LLMCapabilitySet,
  LLMDeclarativeCapability,
  LLMProviderDescriptor,
  LLMProviderRegistry,
  ProviderCompatibility,
} from './providerCapabilityRegistryContracts'
import {
  LLM_DECLARATIVE_CAPABILITIES,
} from './providerCapabilityRegistryContracts'

const PURPOSE_SET = new Set<string>(AI_PURPOSES)
const PROTOCOL_VERSION_SET = new Set<number>(LLM_PROTOCOL_VERSIONS)
const EXECUTION_MODE_SET = new Set<string>(LLM_EXECUTION_MODES)
const DECLARATIVE_CAPABILITY_SET = new Set<string>(LLM_DECLARATIVE_CAPABILITIES)

const PURPOSE_RANK = AI_PURPOSES.reduce((accumulator, purpose, index) => {
  accumulator[purpose] = index
  return accumulator
}, {} as Record<AIPurpose, number>)

const EXECUTION_MODE_RANK = LLM_EXECUTION_MODES.reduce((accumulator, mode, index) => {
  accumulator[mode] = index
  return accumulator
}, {} as Record<LLMExecutionMode, number>)

const DECLARATIVE_CAPABILITY_RANK = LLM_DECLARATIVE_CAPABILITIES.reduce((accumulator, capability, index) => {
  accumulator[capability] = index
  return accumulator
}, {} as Record<LLMDeclarativeCapability, number>)

const REQUIRED_EXECUTION_CAPABILITY: Record<
  LLMExecutionMode,
  LLMDeclarativeCapability
> = {
  LOCAL_ONLY: 'LOCAL_EXECUTION',
  EXTERNAL_PROVIDER: 'EXTERNAL_EXECUTION',
}

const DEFAULT_ADAPTER_SELECTION_POLICY: AdapterSelectionPolicy = deepFreeze({
  policyId: 'provider-capability-registry/default-selection-policy',
  policyVersion: '1.0.0',
  deterministic: true,
  failClosed: true,
  fallbackBehavior: 'FAIL',
  providerOrdering: 'provider-id-then-version-asc',
})

export interface CreateLLMProviderRegistryInput {
  readonly registryId?: string
  readonly registryVersion?: string
  readonly protocolVersion?: LLMProtocolVersion
  readonly providers?: readonly LLMProviderDescriptor[]
  readonly selectionPolicy?: AdapterSelectionPolicy
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

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function isKnownPurpose(value: string): value is AIPurpose {
  return PURPOSE_SET.has(value)
}

function isKnownProtocolVersion(value: number): value is LLMProtocolVersion {
  return PROTOCOL_VERSION_SET.has(value)
}

function isKnownExecutionMode(value: string): value is LLMExecutionMode {
  return EXECUTION_MODE_SET.has(value)
}

function isKnownDeclarativeCapability(value: string): value is LLMDeclarativeCapability {
  return DECLARATIVE_CAPABILITY_SET.has(value)
}

function canonicalPurposes(purposes: readonly AIPurpose[]): readonly AIPurpose[] {
  const unique = new Set<AIPurpose>()
  for (const purpose of purposes) {
    unique.add(purpose)
  }

  return [...unique].sort((left, right) => PURPOSE_RANK[left] - PURPOSE_RANK[right])
}

function canonicalProtocolVersions(
  versions: readonly LLMProtocolVersion[],
): readonly LLMProtocolVersion[] {
  const unique = new Set<LLMProtocolVersion>()
  for (const version of versions) {
    unique.add(version)
  }

  return [...unique].sort((left, right) => left - right)
}

function canonicalExecutionModes(
  modes: readonly LLMExecutionMode[],
): readonly LLMExecutionMode[] {
  const unique = new Set<LLMExecutionMode>()
  for (const mode of modes) {
    unique.add(mode)
  }

  return [...unique].sort((left, right) => EXECUTION_MODE_RANK[left] - EXECUTION_MODE_RANK[right])
}

function canonicalDeclarativeCapabilities(
  capabilities: readonly LLMDeclarativeCapability[],
): readonly LLMDeclarativeCapability[] {
  const unique = new Set<LLMDeclarativeCapability>()
  for (const capability of capabilities) {
    unique.add(capability)
  }

  return [...unique].sort((left, right) => {
    return DECLARATIVE_CAPABILITY_RANK[left] - DECLARATIVE_CAPABILITY_RANK[right]
  })
}

function canonicalCapabilitySet(capabilitySet: LLMCapabilitySet): LLMCapabilitySet {
  return {
    protocolVersions: canonicalProtocolVersions(capabilitySet.protocolVersions),
    executionModes: canonicalExecutionModes(capabilitySet.executionModes),
    declaredCapabilities: canonicalDeclarativeCapabilities(
      capabilitySet.declaredCapabilities,
    ),
    supportsDeterministicResolution: true,
    failClosed: true,
  }
}

function canonicalProviderDescriptor(
  provider: LLMProviderDescriptor,
): LLMProviderDescriptor {
  return {
    providerId: provider.providerId,
    providerVersion: provider.providerVersion,
    protocolVersion: provider.protocolVersion,
    supportedPurposes: canonicalPurposes(provider.supportedPurposes),
    capabilitySet: canonicalCapabilitySet(provider.capabilitySet),
  }
}

function canonicalProviders(
  providers: readonly LLMProviderDescriptor[],
): readonly LLMProviderDescriptor[] {
  const canonical = providers.map((provider) => canonicalProviderDescriptor(provider))

  return canonical.sort((left, right) => {
    const byId = compareStrings(left.providerId, right.providerId)
    if (byId !== 0) {
      return byId
    }

    return compareStrings(left.providerVersion, right.providerVersion)
  })
}

function parseSelectionPolicy(value: unknown): AdapterSelectionPolicy {
  if (!isRecord(value)) {
    return deepClone(DEFAULT_ADAPTER_SELECTION_POLICY)
  }

  const policyId = value.policyId
  const policyVersion = value.policyVersion
  const deterministic = value.deterministic
  const failClosed = value.failClosed
  const fallbackBehavior = value.fallbackBehavior
  const providerOrdering = value.providerOrdering

  if (
    !isNonEmptyString(policyId) ||
    !isNonEmptyString(policyVersion) ||
    deterministic !== true ||
    failClosed !== true ||
    fallbackBehavior !== 'FAIL' ||
    providerOrdering !== 'provider-id-then-version-asc'
  ) {
    return deepClone(DEFAULT_ADAPTER_SELECTION_POLICY)
  }

  return {
    policyId,
    policyVersion,
    deterministic: true,
    failClosed: true,
    fallbackBehavior: 'FAIL',
    providerOrdering: 'provider-id-then-version-asc',
  }
}

function parseCapabilitySet(value: unknown): LLMCapabilitySet | null {
  if (!isRecord(value)) {
    return null
  }

  const protocolVersionsRaw = value.protocolVersions
  const executionModesRaw = value.executionModes
  const capabilitiesRaw = value.declaredCapabilities

  if (
    !Array.isArray(protocolVersionsRaw) ||
    !Array.isArray(executionModesRaw) ||
    !Array.isArray(capabilitiesRaw)
  ) {
    return null
  }

  const protocolVersions: LLMProtocolVersion[] = []
  for (const entry of protocolVersionsRaw) {
    if (typeof entry !== 'number' || !isKnownProtocolVersion(entry)) {
      return null
    }
    protocolVersions.push(entry)
  }

  const executionModes: LLMExecutionMode[] = []
  for (const entry of executionModesRaw) {
    if (typeof entry !== 'string' || !isKnownExecutionMode(entry)) {
      return null
    }
    executionModes.push(entry)
  }

  const declaredCapabilities: LLMDeclarativeCapability[] = []
  for (const entry of capabilitiesRaw) {
    if (typeof entry !== 'string' || !isKnownDeclarativeCapability(entry)) {
      return null
    }
    declaredCapabilities.push(entry)
  }

  if (
    value.supportsDeterministicResolution !== true ||
    value.failClosed !== true
  ) {
    return null
  }

  return {
    protocolVersions: canonicalProtocolVersions(protocolVersions),
    executionModes: canonicalExecutionModes(executionModes),
    declaredCapabilities: canonicalDeclarativeCapabilities(declaredCapabilities),
    supportsDeterministicResolution: true,
    failClosed: true,
  }
}

function parseProviderDescriptor(value: unknown): LLMProviderDescriptor | null {
  if (!isRecord(value)) {
    return null
  }

  const providerId = value.providerId
  const providerVersion = value.providerVersion
  const protocolVersion = value.protocolVersion
  const supportedPurposesRaw = value.supportedPurposes
  const capabilitySet = parseCapabilitySet(value.capabilitySet)

  if (
    !isNonEmptyString(providerId) ||
    !isNonEmptyString(providerVersion) ||
    typeof protocolVersion !== 'number' ||
    !isKnownProtocolVersion(protocolVersion) ||
    !Array.isArray(supportedPurposesRaw) ||
    capabilitySet === null
  ) {
    return null
  }

  const supportedPurposes: AIPurpose[] = []
  for (const purpose of supportedPurposesRaw) {
    if (typeof purpose !== 'string' || !isKnownPurpose(purpose)) {
      return null
    }

    supportedPurposes.push(purpose)
  }

  return {
    providerId,
    providerVersion,
    protocolVersion,
    supportedPurposes: canonicalPurposes(supportedPurposes),
    capabilitySet,
  }
}

function parseRegistry(registry: unknown): LLMProviderRegistry | null {
  if (!isRecord(registry)) {
    return null
  }

  const registryId = registry.registryId
  const registryVersion = registry.registryVersion
  const protocolVersion = registry.protocolVersion
  const providersRaw = registry.providers

  if (
    !isNonEmptyString(registryId) ||
    !isNonEmptyString(registryVersion) ||
    typeof protocolVersion !== 'number' ||
    !isKnownProtocolVersion(protocolVersion) ||
    !Array.isArray(providersRaw)
  ) {
    return null
  }

  const providers: LLMProviderDescriptor[] = []
  for (const provider of providersRaw) {
    const parsedProvider = parseProviderDescriptor(provider)
    if (parsedProvider === null) {
      return null
    }

    providers.push(parsedProvider)
  }

  return {
    registryId,
    registryVersion,
    protocolVersion,
    providers: canonicalProviders(providers),
    selectionPolicy: parseSelectionPolicy(registry.selectionPolicy),
  }
}

function parseResolutionRequest(
  request: AdapterResolutionRequest | null | undefined,
): AdapterResolutionRequest | null {
  if (!isRecord(request)) {
    return null
  }

  const requestId = request.requestId
  const purpose = request.purpose
  const protocolVersion = request.protocolVersion
  const executionMode = request.executionMode
  const requiredCapabilitiesRaw = request.requiredCapabilities

  if (
    !isNonEmptyString(requestId) ||
    typeof purpose !== 'string' ||
    !isKnownPurpose(purpose) ||
    typeof protocolVersion !== 'number' ||
    !isKnownProtocolVersion(protocolVersion) ||
    typeof executionMode !== 'string' ||
    !isKnownExecutionMode(executionMode) ||
    !Array.isArray(requiredCapabilitiesRaw)
  ) {
    return null
  }

  const requiredCapabilities: LLMDeclarativeCapability[] = []
  for (const capability of requiredCapabilitiesRaw) {
    if (typeof capability !== 'string' || !isKnownDeclarativeCapability(capability)) {
      return null
    }

    requiredCapabilities.push(capability)
  }

  const requiredProviderVersion = request.requiredProviderVersion
  if (
    requiredProviderVersion !== undefined &&
    !isNonEmptyString(requiredProviderVersion)
  ) {
    return null
  }

  return {
    requestId,
    purpose,
    protocolVersion,
    executionMode,
    requiredCapabilities: canonicalDeclarativeCapabilities(requiredCapabilities),
    ...(requiredProviderVersion === undefined
      ? {}
      : { requiredProviderVersion }),
  }
}

function createCapabilityValidationResult(input: {
  readonly protocolCompatible: boolean
  readonly executionModeCompatible: boolean
  readonly versionCompatible: boolean
  readonly purposeCompatible: boolean
  readonly missingCapabilities: readonly LLMDeclarativeCapability[]
}): CapabilityValidationResult {
  const missingCapabilities = canonicalDeclarativeCapabilities(
    input.missingCapabilities,
  )

  return {
    compatible:
      input.protocolCompatible &&
      input.executionModeCompatible &&
      input.versionCompatible &&
      input.purposeCompatible &&
      missingCapabilities.length === 0,
    protocolCompatible: input.protocolCompatible,
    executionModeCompatible: input.executionModeCompatible,
    versionCompatible: input.versionCompatible,
    purposeCompatible: input.purposeCompatible,
    missingCapabilities,
  }
}

function evaluateProviderCompatibility(input: {
  readonly request: AdapterResolutionRequest
  readonly registry: LLMProviderRegistry
  readonly provider: LLMProviderDescriptor
}): ProviderCompatibility {
  const missingCapabilities = input.request.requiredCapabilities.filter(
    (requiredCapability) => {
      return !input.provider.capabilitySet.declaredCapabilities.includes(
        requiredCapability,
      )
    },
  )

  const requiredExecutionCapability =
    REQUIRED_EXECUTION_CAPABILITY[input.request.executionMode]

  const protocolCompatible =
    input.registry.protocolVersion === input.request.protocolVersion &&
    input.provider.protocolVersion === input.request.protocolVersion &&
    input.provider.capabilitySet.protocolVersions.includes(
      input.request.protocolVersion,
    )

  const executionModeCompatible =
    input.provider.capabilitySet.executionModes.includes(
      input.request.executionMode,
    ) &&
    input.provider.capabilitySet.declaredCapabilities.includes(
      requiredExecutionCapability,
    )

  const versionCompatible =
    input.request.requiredProviderVersion === undefined ||
    input.provider.providerVersion === input.request.requiredProviderVersion

  const purposeCompatible = input.provider.supportedPurposes.includes(
    input.request.purpose,
  )

  const validation = createCapabilityValidationResult({
    protocolCompatible,
    executionModeCompatible,
    versionCompatible,
    purposeCompatible,
    missingCapabilities,
  })

  return {
    providerId: input.provider.providerId,
    providerVersion: input.provider.providerVersion,
    compatible: validation.compatible,
    validation,
  }
}

function deriveFailureCode(input: {
  readonly request: AdapterResolutionRequest
  readonly evaluatedProviders: readonly ProviderCompatibility[]
}): AdapterResolutionFailureCode {
  if (input.evaluatedProviders.every((entry) => !entry.validation.protocolCompatible)) {
    return 'PROTOCOL_INCOMPATIBLE'
  }

  if (
    input.evaluatedProviders.every(
      (entry) => !entry.validation.executionModeCompatible,
    )
  ) {
    return 'EXECUTION_MODE_INCOMPATIBLE'
  }

  if (
    input.request.requiredProviderVersion !== undefined &&
    input.evaluatedProviders.every((entry) => !entry.validation.versionCompatible)
  ) {
    return 'VERSION_INCOMPATIBLE'
  }

  if (
    input.request.requiredCapabilities.length > 0 &&
    input.evaluatedProviders.every(
      (entry) => entry.validation.missingCapabilities.length > 0,
    )
  ) {
    return 'NO_CAPABILITY_MATCH'
  }

  return 'PROVIDER_INCOMPATIBLE'
}

function createResolutionFailure(input: {
  readonly code: AdapterResolutionFailureCode
  readonly message: string
  readonly evaluatedProviders: readonly ProviderCompatibility[]
  readonly details?: AdapterResolutionFailure['details']
}): AdapterResolutionFailure {
  return deepFreeze({
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    code: input.code,
    message: input.message,
    evaluatedProviders: deepClone(input.evaluatedProviders),
    ...(input.details === undefined ? {} : { details: input.details }),
  })
}

function createResolutionSuccess(input: {
  readonly provider: LLMProviderDescriptor
  readonly compatibility: ProviderCompatibility
  readonly evaluatedProviders: readonly ProviderCompatibility[]
  readonly selectionPolicy: AdapterSelectionPolicy
}): AdapterResolutionSuccess {
  return deepFreeze({
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    provider: deepClone(input.provider),
    compatibility: deepClone(input.compatibility),
    evaluatedProviders: deepClone(input.evaluatedProviders),
    selectionPolicy: deepClone(input.selectionPolicy),
  })
}

export function createDefaultAdapterSelectionPolicy(): AdapterSelectionPolicy {
  return deepClone(DEFAULT_ADAPTER_SELECTION_POLICY)
}

export function createLLMProviderRegistry(
  input: CreateLLMProviderRegistryInput = {},
): LLMProviderRegistry {
  const registryId =
    isNonEmptyString(input.registryId)
      ? input.registryId
      : 'provider-capability-registry'

  const registryVersion =
    isNonEmptyString(input.registryVersion)
      ? input.registryVersion
      : '1.0.0'

  const protocolVersion =
    input.protocolVersion === undefined
      ? LLM_PROTOCOL_VERSIONS[0]
      : input.protocolVersion

  const providers =
    input.providers === undefined
      ? []
      : canonicalProviders(input.providers)

  const selectionPolicy =
    input.selectionPolicy === undefined
      ? createDefaultAdapterSelectionPolicy()
      : parseSelectionPolicy(input.selectionPolicy)

  return deepFreeze({
    registryId,
    registryVersion,
    protocolVersion,
    providers,
    selectionPolicy,
  })
}

export function createLLMCapabilityResolver(
  policy?: AdapterSelectionPolicy,
): LLMCapabilityResolver {
  const fallbackPolicy =
    policy === undefined
      ? createDefaultAdapterSelectionPolicy()
      : parseSelectionPolicy(policy)

  return {
    resolve(request, registry): AdapterResolutionResult {
      const parsedRequest = parseResolutionRequest(request)
      if (parsedRequest === null) {
        return createResolutionFailure({
          code: 'INVALID_REQUEST',
          message: 'adapter resolution request must be valid and complete',
          evaluatedProviders: [],
        })
      }

      const parsedRegistry = parseRegistry(registry)
      if (parsedRegistry === null) {
        return createResolutionFailure({
          code: 'INVALID_REGISTRY',
          message: 'provider registry must be valid and complete',
          evaluatedProviders: [],
        })
      }

      if (parsedRegistry.providers.length === 0) {
        return createResolutionFailure({
          code: 'EMPTY_REGISTRY',
          message: 'provider registry does not contain providers',
          evaluatedProviders: [],
        })
      }

      const evaluatedProviders = parsedRegistry.providers.map((provider) => {
        return evaluateProviderCompatibility({
          request: parsedRequest,
          registry: parsedRegistry,
          provider,
        })
      })

      const compatibleProvider = evaluatedProviders.find(
        (entry) => entry.compatible,
      )

      if (compatibleProvider === undefined) {
        const code = deriveFailureCode({
          request: parsedRequest,
          evaluatedProviders,
        })

        return createResolutionFailure({
          code,
          message: 'no compatible provider found for adapter resolution request',
          evaluatedProviders,
          details: {
            registryId: parsedRegistry.registryId,
            registryVersion: parsedRegistry.registryVersion,
            requestId: parsedRequest.requestId,
          },
        })
      }

      const selectedProvider = parsedRegistry.providers.find((provider) => {
        return (
          provider.providerId === compatibleProvider.providerId &&
          provider.providerVersion === compatibleProvider.providerVersion
        )
      })

      if (selectedProvider === undefined) {
        return createResolutionFailure({
          code: 'PROVIDER_INCOMPATIBLE',
          message: 'compatible provider descriptor could not be resolved',
          evaluatedProviders,
        })
      }

      return createResolutionSuccess({
        provider: selectedProvider,
        compatibility: compatibleProvider,
        evaluatedProviders,
        selectionPolicy: parsedRegistry.selectionPolicy ?? fallbackPolicy,
      })
    },
  }
}

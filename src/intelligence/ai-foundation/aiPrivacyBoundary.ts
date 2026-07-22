import {
  AI_ALLOWED_PURPOSES,
  AI_CONSENT_STATUSES,
  AI_DATA_CATEGORIES,
  AI_DATA_CLASSIFICATIONS,
  AI_PRIVACY_POLICY_VERSION,
  AI_PRIVACY_PROTOCOL_VERSION,
  AI_PROCESSING_MODES,
  AI_PROHIBITED_PURPOSES,
  type AILoggingDirective,
  type AIRetentionDirective,
  type AITrainingDirective,
  type AIAuthorizedDataReference,
  type AIAuthorizedRequestEnvelope,
  type AIConsentRecord,
  type AIContextBuilderConstraint,
  type AIDataCategory,
  type AIDataClassification,
  type AIProcessingMode,
  type AIPrivacyAuthorizationFailure,
  type AIPrivacyAuthorizationRequest,
  type AIPrivacyAuthorizationResult,
  type AIPrivacyAuthorizationSuccess,
  type AIPrivacyFailureCode,
  type AIPrivacyModePolicy,
  type AIPrivacyPolicy,
  type AIPrivacyTraceability,
} from './aiFoundationContracts'
import { createDefaultAIPrivacyPolicy, resolveModePolicy } from './aiPrivacyPolicy'
import type {
  AIPrivacyBoundaryDependencies,
  AIPrivacyBoundaryPort,
} from './aiPrivacyBoundaryInterfaces'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isBoolean(value: unknown): value is boolean {
  return value === true || value === false
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

const PROCESSING_MODE_SET = new Set<string>(AI_PROCESSING_MODES)
const DATA_CATEGORY_SET = new Set<string>(AI_DATA_CATEGORIES)
const DATA_CLASSIFICATION_SET = new Set<string>(AI_DATA_CLASSIFICATIONS)
const PURPOSE_SET = new Set<string>([
  ...AI_ALLOWED_PURPOSES,
  ...AI_PROHIBITED_PURPOSES,
])
const ALLOWED_PURPOSE_SET = new Set<string>(AI_ALLOWED_PURPOSES)
const PROHIBITED_PURPOSE_SET = new Set<string>(AI_PROHIBITED_PURPOSES)
const CONSENT_STATUS_SET = new Set<string>(AI_CONSENT_STATUSES)
const RETENTION_SET = new Set<string>(['PROHIBITED', 'EPHEMERAL'])
const TRAINING_SET = new Set<string>(['PROHIBITED', 'ALLOW_EXTERNAL'])
const LOGGING_SET = new Set<string>(['NONE', 'METADATA_ONLY', 'CONTENT'])

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

interface ParsedDataReference {
  readonly referenceId: string
  readonly category: string
  readonly classification: string
  readonly selector: string
}

interface ParsedTraceabilityInput {
  readonly traceId: string
  readonly relationId: string
  readonly requestId: string
  readonly policyId: string
  readonly policyVersion: string
  readonly consentId: string | null
  readonly purpose: string
  readonly processingMode: string
  readonly dataCategories: readonly string[]
}

interface ParsedAuthorizationRequest {
  readonly requestId: string
  readonly protocolVersion: number
  readonly purpose: string
  readonly processingMode: string
  readonly dataReferences: readonly ParsedDataReference[]
  readonly policy: AIPrivacyPolicy | null
  readonly consent: AIConsentRecord | null
  readonly retention: AIRetentionDirective
  readonly training: AITrainingDirective
  readonly logging: AILoggingDirective
  readonly minimization: {
    readonly applied: boolean
    readonly strategyCodes: readonly string[]
  }
  readonly redaction: {
    readonly applied: boolean
    readonly strategyCodes: readonly string[]
  }
  readonly traceability: ParsedTraceabilityInput
  readonly contextBuilderConstraints: readonly AIContextBuilderConstraint[]
}

interface RequestSummary {
  readonly traceId: string | null
  readonly relationId: string | null
  readonly requestId: string | null
  readonly policyId: string | null
  readonly policyVersion: string | null
  readonly consentId: string | null
  readonly purpose: string | null
  readonly processingMode: string | null
  readonly categories: readonly AIDataCategory[]
  readonly maxClassification: AIDataClassification | null
}

function canonicalUniqueStrings(values: readonly string[]): readonly string[] {
  const deduplicated = new Set<string>()
  for (const value of values) {
    deduplicated.add(value)
  }

  return [...deduplicated].sort(compareStrings)
}

function canonicalConstraintList(
  value: unknown,
): readonly AIContextBuilderConstraint[] {
  if (!Array.isArray(value)) {
    return []
  }

  const valid: AIContextBuilderConstraint[] = []
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue
    }

    const code = entry.code
    const requirement = entry.requirement

    if (!isNonEmptyString(code) || !isNonEmptyString(requirement)) {
      continue
    }

    valid.push({ code, requirement })
  }

  return [...valid].sort((left, right) => {
    const byCode = compareStrings(left.code, right.code)
    if (byCode !== 0) {
      return byCode
    }
    return compareStrings(left.requirement, right.requirement)
  })
}

function canonicalCategories(
  values: readonly AIDataCategory[],
): readonly AIDataCategory[] {
  const deduplicated = new Set<AIDataCategory>()
  for (const value of values) {
    deduplicated.add(value)
  }

  return [...deduplicated].sort((left, right) => CATEGORY_RANK[left] - CATEGORY_RANK[right])
}

function canonicalClassifications(
  values: readonly AIDataClassification[],
): readonly AIDataClassification[] {
  const deduplicated = new Set<AIDataClassification>()
  for (const value of values) {
    deduplicated.add(value)
  }

  return [...deduplicated].sort((left, right) => CLASSIFICATION_RANK[left] - CLASSIFICATION_RANK[right])
}

function highestClassification(
  values: readonly AIDataClassification[],
): AIDataClassification {
  const ranked = canonicalClassifications(values)
  return ranked[ranked.length - 1] ?? 'PUBLIC'
}

function isKnownPurpose(value: string): boolean {
  return PURPOSE_SET.has(value)
}

function isAllowedPurpose(value: string): boolean {
  return ALLOWED_PURPOSE_SET.has(value)
}

function isProhibitedPurpose(value: string): boolean {
  return PROHIBITED_PURPOSE_SET.has(value)
}

function isKnownProcessingMode(value: string): value is AIProcessingMode {
  return PROCESSING_MODE_SET.has(value)
}

function isKnownDataCategory(value: string): value is AIDataCategory {
  return DATA_CATEGORY_SET.has(value)
}

function isKnownDataClassification(
  value: string,
): value is AIDataClassification {
  return DATA_CLASSIFICATION_SET.has(value)
}

function isKnownConsentStatus(value: string): boolean {
  return CONSENT_STATUS_SET.has(value)
}

function isKnownRetentionDirective(value: string): value is AIRetentionDirective {
  return RETENTION_SET.has(value)
}

function isKnownTrainingDirective(value: string): value is AITrainingDirective {
  return TRAINING_SET.has(value)
}

function isKnownLoggingDirective(value: string): value is AILoggingDirective {
  return LOGGING_SET.has(value)
}

function parseDataReference(value: unknown): ParsedDataReference | null {
  if (!isRecord(value)) {
    return null
  }

  const referenceId = value.referenceId
  const category = value.category
  const classification = value.classification
  const selector = value.selector

  if (
    !isNonEmptyString(referenceId) ||
    !isNonEmptyString(category) ||
    !isNonEmptyString(classification) ||
    !isNonEmptyString(selector)
  ) {
    return null
  }

  return {
    referenceId,
    category,
    classification,
    selector,
  }
}

function parseTraceabilityInput(value: unknown): ParsedTraceabilityInput | null {
  if (!isRecord(value)) {
    return null
  }

  const traceId = value.traceId
  const relationId = value.relationId
  const requestId = value.requestId
  const policyId = value.policyId
  const policyVersion = value.policyVersion
  const consentId = value.consentId
  const purpose = value.purpose
  const processingMode = value.processingMode
  const dataCategories = value.dataCategories

  if (
    !isNonEmptyString(traceId) ||
    !isNonEmptyString(relationId) ||
    !isNonEmptyString(requestId) ||
    !isNonEmptyString(policyId) ||
    !isNonEmptyString(policyVersion) ||
    !isNonEmptyString(purpose) ||
    !isNonEmptyString(processingMode)
  ) {
    return null
  }

  if (consentId !== null && !isNonEmptyString(consentId)) {
    return null
  }

  if (!Array.isArray(dataCategories)) {
    return null
  }

  const parsedCategories: string[] = []
  for (const entry of dataCategories) {
    if (!isNonEmptyString(entry)) {
      return null
    }
    parsedCategories.push(entry)
  }

  return {
    traceId,
    relationId,
    requestId,
    policyId,
    policyVersion,
    consentId,
    purpose,
    processingMode,
    dataCategories: parsedCategories,
  }
}

function parseAuthorizationRequest(
  request: AIPrivacyAuthorizationRequest | null | undefined,
): ParsedAuthorizationRequest | null {
  if (!isRecord(request)) {
    return null
  }

  const requestId = request.requestId
  const protocolVersion = request.protocolVersion
  const purpose = request.purpose
  const processingMode = request.processingMode
  const dataReferences = request.dataReferences
  const retention = request.retention
  const training = request.training
  const logging = request.logging
  const minimization = request.minimization
  const redaction = request.redaction
  const traceability = parseTraceabilityInput(request.traceability)

  if (
    !isNonEmptyString(requestId) ||
    !isSafeNonNegativeInteger(protocolVersion) ||
    !isNonEmptyString(purpose) ||
    !isNonEmptyString(processingMode) ||
    !isNonEmptyString(retention) ||
    !isNonEmptyString(training) ||
    !isNonEmptyString(logging) ||
    !isRecord(minimization) ||
    !isRecord(redaction) ||
    traceability === null
  ) {
    return null
  }

  if (
    !isKnownRetentionDirective(retention) ||
    !isKnownTrainingDirective(training) ||
    !isKnownLoggingDirective(logging)
  ) {
    return null
  }

  if (!Array.isArray(dataReferences) || dataReferences.length === 0) {
    return null
  }

  const parsedDataReferences: ParsedDataReference[] = []
  for (const dataReference of dataReferences) {
    const parsedReference = parseDataReference(dataReference)
    if (parsedReference === null) {
      return null
    }
    parsedDataReferences.push(parsedReference)
  }

  const minimizationApplied = minimization.applied
  const minimizationStrategyCodes = minimization.strategyCodes
  const redactionApplied = redaction.applied
  const redactionStrategyCodes = redaction.strategyCodes

  if (
    !isBoolean(minimizationApplied) ||
    !Array.isArray(minimizationStrategyCodes) ||
    !isBoolean(redactionApplied) ||
    !Array.isArray(redactionStrategyCodes)
  ) {
    return null
  }

  const parsedMinimizationStrategyCodes: string[] = []
  for (const code of minimizationStrategyCodes) {
    if (!isNonEmptyString(code)) {
      return null
    }
    parsedMinimizationStrategyCodes.push(code)
  }

  const parsedRedactionStrategyCodes: string[] = []
  for (const code of redactionStrategyCodes) {
    if (!isNonEmptyString(code)) {
      return null
    }
    parsedRedactionStrategyCodes.push(code)
  }

  const contextBuilderConstraints = canonicalConstraintList(
    request.contextBuilderConstraints,
  )

  const policy = request.policy
  const consent = request.consent

  return {
    requestId,
    protocolVersion,
    purpose,
    processingMode,
    dataReferences: parsedDataReferences,
    policy: policy ?? null,
    consent: consent ?? null,
    retention,
    training,
    logging,
    minimization: {
      applied: minimizationApplied,
      strategyCodes: canonicalUniqueStrings(parsedMinimizationStrategyCodes),
    },
    redaction: {
      applied: redactionApplied,
      strategyCodes: canonicalUniqueStrings(parsedRedactionStrategyCodes),
    },
    traceability,
    contextBuilderConstraints,
  }
}

function readKnownCategories(
  parsedRequest: ParsedAuthorizationRequest | null,
): readonly AIDataCategory[] {
  if (parsedRequest === null) {
    return []
  }

  const categories: AIDataCategory[] = []
  for (const reference of parsedRequest.dataReferences) {
    if (isKnownDataCategory(reference.category)) {
      categories.push(reference.category)
    }
  }

  return canonicalCategories(categories)
}

function readKnownMaxClassification(
  parsedRequest: ParsedAuthorizationRequest | null,
): AIDataClassification | null {
  if (parsedRequest === null) {
    return null
  }

  const classifications: AIDataClassification[] = []
  for (const reference of parsedRequest.dataReferences) {
    if (isKnownDataClassification(reference.classification)) {
      classifications.push(reference.classification)
    }
  }

  if (classifications.length === 0) {
    return null
  }

  return highestClassification(classifications)
}

function summarizeRequest(
  parsedRequest: ParsedAuthorizationRequest | null,
): RequestSummary {
  return {
    traceId: parsedRequest?.traceability.traceId ?? null,
    relationId: parsedRequest?.traceability.relationId ?? null,
    requestId: parsedRequest?.requestId ?? null,
    policyId: parsedRequest?.traceability.policyId ?? null,
    policyVersion: parsedRequest?.traceability.policyVersion ?? null,
    consentId: parsedRequest?.traceability.consentId ?? null,
    purpose: parsedRequest?.purpose ?? null,
    processingMode: parsedRequest?.processingMode ?? null,
    categories: readKnownCategories(parsedRequest),
    maxClassification: readKnownMaxClassification(parsedRequest),
  }
}

function isModePolicyShape(value: unknown): value is AIPrivacyModePolicy {
  if (!isRecord(value)) {
    return false
  }

  if (!isNonEmptyString(value.mode) || !isKnownProcessingMode(value.mode)) {
    return false
  }

  const allowedClassifications = value.allowedClassifications
  const allowedDataCategories = value.allowedDataCategories
  const allowedRetention = value.allowedRetention
  const allowedTraining = value.allowedTraining
  const allowedLogging = value.allowedLogging

  if (
    !Array.isArray(allowedClassifications) ||
    !Array.isArray(allowedDataCategories) ||
    !Array.isArray(allowedRetention) ||
    !Array.isArray(allowedTraining) ||
    !Array.isArray(allowedLogging)
  ) {
    return false
  }

  for (const classification of allowedClassifications) {
    if (!isNonEmptyString(classification) || !isKnownDataClassification(classification)) {
      return false
    }
  }

  for (const category of allowedDataCategories) {
    if (!isNonEmptyString(category) || !isKnownDataCategory(category)) {
      return false
    }
  }

  for (const retention of allowedRetention) {
    if (retention !== 'PROHIBITED' && retention !== 'EPHEMERAL') {
      return false
    }
  }

  for (const training of allowedTraining) {
    if (training !== 'PROHIBITED' && training !== 'ALLOW_EXTERNAL') {
      return false
    }
  }

  for (const logging of allowedLogging) {
    if (logging !== 'NONE' && logging !== 'METADATA_ONLY' && logging !== 'CONTENT') {
      return false
    }
  }

  return (
    isBoolean(value.consentRequired) &&
    isBoolean(value.specificPurposeRequired) &&
    isBoolean(value.minimizationRequired) &&
    isBoolean(value.redactionRequired)
  )
}

function isPolicyShape(value: unknown): value is AIPrivacyPolicy {
  if (!isRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.policyId) ||
    !isNonEmptyString(value.policyVersion) ||
    !isSafeNonNegativeInteger(value.protocolVersion)
  ) {
    return false
  }

  if (value.defaultDecision !== 'DENY') {
    return false
  }

  if (!Array.isArray(value.supportedProtocols) || !Array.isArray(value.allowedProcessingModes)) {
    return false
  }

  if (!Array.isArray(value.allowedPurposes) || !Array.isArray(value.prohibitedPurposes)) {
    return false
  }

  if (!Array.isArray(value.modePolicies) || value.modePolicies.length === 0) {
    return false
  }

  if (!Array.isArray(value.forbiddenCombinations)) {
    return false
  }

  if (!isRecord(value.traceabilityLimits)) {
    return false
  }

  if (
    value.requireExactConsentPolicyVersion !== true ||
    value.requireCanonicalOrdering !== true
  ) {
    return false
  }

  for (const protocol of value.supportedProtocols) {
    if (!isSafeNonNegativeInteger(protocol)) {
      return false
    }
  }

  for (const mode of value.allowedProcessingModes) {
    if (!isNonEmptyString(mode) || !isKnownProcessingMode(mode)) {
      return false
    }
  }

  for (const purpose of value.allowedPurposes) {
    if (!isNonEmptyString(purpose) || !isKnownPurpose(purpose)) {
      return false
    }
  }

  for (const purpose of value.prohibitedPurposes) {
    if (!isNonEmptyString(purpose) || !isKnownPurpose(purpose)) {
      return false
    }
  }

  for (const modePolicy of value.modePolicies) {
    if (!isModePolicyShape(modePolicy)) {
      return false
    }
  }

  for (const forbiddenCombination of value.forbiddenCombinations) {
    if (!isRecord(forbiddenCombination)) {
      return false
    }
    if (!isNonEmptyString(forbiddenCombination.combinationId)) {
      return false
    }
    if (!isNonEmptyString(forbiddenCombination.failureCode)) {
      return false
    }
  }

  const limits = value.traceabilityLimits
  if (
    limits.allowSensitiveContent !== false ||
    limits.allowUserText !== false ||
    limits.allowDomainPayloads !== false ||
    !isSafeNonNegativeInteger(limits.maxCategoryCount)
  ) {
    return false
  }

  return true
}

function detectPolicyConflict(policy: AIPrivacyPolicy): boolean {
  const modeSet = new Set<string>()
  for (const mode of policy.allowedProcessingModes) {
    if (modeSet.has(mode)) {
      return true
    }
    modeSet.add(mode)
  }

  const modePolicySet = new Set<string>()
  for (const modePolicy of policy.modePolicies) {
    if (modePolicySet.has(modePolicy.mode)) {
      return true
    }
    modePolicySet.add(modePolicy.mode)

    if (!modeSet.has(modePolicy.mode)) {
      return true
    }

    if (modePolicy.allowedClassifications.length === 0) {
      return true
    }

    if (modePolicy.allowedDataCategories.length === 0) {
      return true
    }
  }

  for (const purpose of policy.allowedPurposes) {
    if (policy.prohibitedPurposes.includes(purpose as (typeof policy.prohibitedPurposes)[number])) {
      return true
    }
  }

  if (!policy.supportedProtocols.includes(policy.protocolVersion)) {
    return true
  }

  return false
}

function isConsentScopeShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.scopeId) ||
    !isNonEmptyString(value.purpose) ||
    !isSafeNonNegativeInteger(value.policyProtocolVersion) ||
    !isNonEmptyString(value.policyVersion) ||
    !isNonEmptyString(value.maxClassification)
  ) {
    return false
  }

  if (!Array.isArray(value.dataCategories) || !Array.isArray(value.processingModes)) {
    return false
  }

  for (const category of value.dataCategories) {
    if (!isNonEmptyString(category) || !isKnownDataCategory(category)) {
      return false
    }
  }

  for (const mode of value.processingModes) {
    if (!isNonEmptyString(mode) || !isKnownProcessingMode(mode)) {
      return false
    }
  }

  if (!isKnownPurpose(value.purpose)) {
    return false
  }

  if (!isKnownDataClassification(value.maxClassification)) {
    return false
  }

  return true
}

function isConsentShape(value: unknown): value is AIConsentRecord {
  if (!isRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.consentId) ||
    !isNonEmptyString(value.consentTextVersion) ||
    !isNonEmptyString(value.policyVersion) ||
    !isSafeNonNegativeInteger(value.policyProtocolVersion) ||
    !isNonEmptyString(value.status) ||
    !isKnownConsentStatus(value.status)
  ) {
    return false
  }

  if (!isConsentScopeShape(value.scope)) {
    return false
  }

  if (!isRecord(value.revocation) || !isRecord(value.confirmation)) {
    return false
  }

  if (
    !isBoolean(value.revocation.revocable) ||
    !isBoolean(value.revocation.revoked)
  ) {
    return false
  }

  if (
    !isNonEmptyString(value.confirmation.evidenceId) ||
    !isNonEmptyString(value.confirmation.evidenceType) ||
    !isNonEmptyString(value.confirmation.evidenceDigest)
  ) {
    return false
  }

  return true
}

function buildTraceability(input: {
  readonly summary: RequestSummary
  readonly decision: 'authorized' | 'rejected'
  readonly failureCode?: AIPrivacyFailureCode
  readonly requestToPolicy: 'matched' | 'missing' | 'mismatch'
  readonly requestToConsent: 'matched' | 'not-required' | 'missing' | 'mismatch'
}): AIPrivacyTraceability {
  return {
    traceId: input.summary.traceId,
    relationId: input.summary.relationId,
    requestId: input.summary.requestId,
    policyId: input.summary.policyId,
    policyVersion: input.summary.policyVersion,
    consentId: input.summary.consentId,
    purpose: input.summary.purpose,
    processingMode: input.summary.processingMode,
    categories: canonicalCategories(input.summary.categories),
    maxClassification: input.summary.maxClassification,
    decision: input.decision,
    ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
    relation: {
      requestToPolicy: input.requestToPolicy,
      requestToConsent: input.requestToConsent,
    },
  }
}

function buildFailure(input: {
  readonly code: AIPrivacyFailureCode
  readonly message: string
  readonly summary: RequestSummary
  readonly requestToPolicy: 'matched' | 'missing' | 'mismatch'
  readonly requestToConsent: 'matched' | 'not-required' | 'missing' | 'mismatch'
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}): AIPrivacyAuthorizationFailure {
  return {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    code: input.code,
    message: input.message,
    traceability: buildTraceability({
      summary: input.summary,
      decision: 'rejected',
      failureCode: input.code,
      requestToPolicy: input.requestToPolicy,
      requestToConsent: input.requestToConsent,
    }),
    ...(input.details === undefined ? {} : { details: input.details }),
  }
}

function toModePolicy(
  policy: AIPrivacyPolicy,
  mode: string,
): AIPrivacyModePolicy | null {
  if (!isKnownProcessingMode(mode)) {
    return null
  }

  return resolveModePolicy(policy, mode)
}

function authorizedReferences(
  parsedReferences: readonly ParsedDataReference[],
): readonly AIAuthorizedDataReference[] {
  const references: AIAuthorizedDataReference[] = parsedReferences.map((reference) => ({
    referenceId: reference.referenceId,
    category: reference.category as AIDataCategory,
    classification: reference.classification as AIDataClassification,
    selector: reference.selector,
  }))

  return references.sort((left, right) => {
    const byCategory = CATEGORY_RANK[left.category] - CATEGORY_RANK[right.category]
    if (byCategory !== 0) {
      return byCategory
    }

    const byClassification =
      CLASSIFICATION_RANK[left.classification] - CLASSIFICATION_RANK[right.classification]
    if (byClassification !== 0) {
      return byClassification
    }

    const byReferenceId = compareStrings(left.referenceId, right.referenceId)
    if (byReferenceId !== 0) {
      return byReferenceId
    }

    return compareStrings(left.selector, right.selector)
  })
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

function isJsonSafeValue(value: unknown, ancestors: ReadonlySet<object>): boolean {
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
    return value.every((entry) => isJsonSafeValue(entry, ancestors))
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
    if (!isJsonSafeValue(entry, nextAncestors)) {
      return false
    }
  }

  return true
}

function isSuccessConsistent(result: AIPrivacyAuthorizationSuccess): boolean {
  return (
    result.traceability.requestId === result.envelope.requestId &&
    result.traceability.decision === 'authorized' &&
    result.envelope.traceability.requestId === result.envelope.requestId &&
    result.envelope.traceability.decision === 'authorized'
  )
}

function applyForbiddenCombinations(input: {
  readonly policy: AIPrivacyPolicy
  readonly parsedRequest: ParsedAuthorizationRequest
}): AIPrivacyFailureCode | null {
  const categories = input.parsedRequest.dataReferences.map((reference) => reference.category)
  const classifications = input.parsedRequest.dataReferences.map(
    (reference) => reference.classification,
  )

  for (const forbidden of input.policy.forbiddenCombinations) {
    const matchesMode =
      forbidden.mode === undefined || forbidden.mode === input.parsedRequest.processingMode
    const matchesPurpose =
      forbidden.purpose === undefined || forbidden.purpose === input.parsedRequest.purpose
    const matchesCategory =
      forbidden.dataCategory === undefined || categories.includes(forbidden.dataCategory)
    const matchesClassification =
      forbidden.dataClassification === undefined ||
      classifications.includes(forbidden.dataClassification)
    const matchesRetention =
      forbidden.retention === undefined || forbidden.retention === input.parsedRequest.retention
    const matchesTraining =
      forbidden.training === undefined || forbidden.training === input.parsedRequest.training
    const matchesLogging =
      forbidden.logging === undefined || forbidden.logging === input.parsedRequest.logging

    if (
      matchesMode &&
      matchesPurpose &&
      matchesCategory &&
      matchesClassification &&
      matchesRetention &&
      matchesTraining &&
      matchesLogging
    ) {
      return forbidden.failureCode
    }
  }

  return null
}

function expectedConsentRelation(modePolicy: AIPrivacyModePolicy): 'matched' | 'not-required' {
  return modePolicy.consentRequired ? 'matched' : 'not-required'
}

function validateTraceability(
  parsedRequest: ParsedAuthorizationRequest,
  policy: AIPrivacyPolicy,
  consent: AIConsentRecord | null,
  categories: readonly AIDataCategory[],
): boolean {
  const traceability = parsedRequest.traceability

  if (traceability.requestId !== parsedRequest.requestId) {
    return false
  }

  if (traceability.policyId !== policy.policyId) {
    return false
  }

  if (traceability.policyVersion !== policy.policyVersion) {
    return false
  }

  if (traceability.purpose !== parsedRequest.purpose) {
    return false
  }

  if (traceability.processingMode !== parsedRequest.processingMode) {
    return false
  }

  const traceabilityCategories: AIDataCategory[] = []
  for (const category of traceability.dataCategories) {
    if (!isKnownDataCategory(category)) {
      return false
    }
    traceabilityCategories.push(category)
  }

  if (
    !sameOrderedValues(
      canonicalCategories(traceabilityCategories),
      canonicalCategories(categories),
    )
  ) {
    return false
  }

  const expectedConsentId = consent?.consentId ?? null
  if (traceability.consentId !== expectedConsentId) {
    return false
  }

  return true
}

function resolvePolicy(
  parsedRequest: ParsedAuthorizationRequest,
  dependencies: AIPrivacyBoundaryDependencies,
): AIPrivacyPolicy | null {
  if (parsedRequest.policy !== null) {
    return deepClone(parsedRequest.policy)
  }

  if (dependencies.defaultPolicy !== undefined) {
    return deepClone(dependencies.defaultPolicy)
  }

  return null
}

function sanitizeSummaryForSuccess(input: {
  readonly parsedRequest: ParsedAuthorizationRequest
  readonly policy: AIPrivacyPolicy
  readonly consent: AIConsentRecord | null
  readonly categories: readonly AIDataCategory[]
  readonly maxClassification: AIDataClassification
}): RequestSummary {
  return {
    traceId: input.parsedRequest.traceability.traceId,
    relationId: input.parsedRequest.traceability.relationId,
    requestId: input.parsedRequest.requestId,
    policyId: input.policy.policyId,
    policyVersion: input.policy.policyVersion,
    consentId: input.consent?.consentId ?? null,
    purpose: input.parsedRequest.purpose,
    processingMode: input.parsedRequest.processingMode,
    categories: canonicalCategories(input.categories),
    maxClassification: input.maxClassification,
  }
}

export function createAIPrivacyBoundary(
  dependencies: AIPrivacyBoundaryDependencies = {
    defaultPolicy: createDefaultAIPrivacyPolicy(),
  },
): AIPrivacyBoundaryPort {
  return {
    authorize(
      request: AIPrivacyAuthorizationRequest | null | undefined,
    ): AIPrivacyAuthorizationResult {
      const parsedRequest = parseAuthorizationRequest(request)
      const parsedSummary = summarizeRequest(parsedRequest)

      try {
        if (parsedRequest === null) {
          return buildFailure({
            code: 'INVALID_REQUEST',
            message: 'authorization request must be a non-null object with required fields',
            summary: parsedSummary,
            requestToPolicy: 'missing',
            requestToConsent: 'missing',
          })
        }

        const policy = resolvePolicy(parsedRequest, dependencies)
        if (policy === null) {
          return buildFailure({
            code: 'MISSING_POLICY',
            message: 'privacy policy is required for authorization',
            summary: parsedSummary,
            requestToPolicy: 'missing',
            requestToConsent: 'missing',
          })
        }

        if (!isPolicyShape(policy)) {
          return buildFailure({
            code: 'POLICY_CONFLICT',
            message: 'privacy policy structure is invalid',
            summary: parsedSummary,
            requestToPolicy: 'mismatch',
            requestToConsent: 'missing',
          })
        }

        if (policy.policyVersion !== AI_PRIVACY_POLICY_VERSION) {
          return buildFailure({
            code: 'UNSUPPORTED_POLICY_VERSION',
            message: 'policy version is not supported by this boundary',
            summary: parsedSummary,
            requestToPolicy: 'mismatch',
            requestToConsent: 'missing',
            details: {
              policyVersion: policy.policyVersion,
            },
          })
        }

        if (policy.protocolVersion !== AI_PRIVACY_PROTOCOL_VERSION) {
          return buildFailure({
            code: 'UNSUPPORTED_PROTOCOL',
            message: 'policy protocol version is not supported by this boundary',
            summary: parsedSummary,
            requestToPolicy: 'mismatch',
            requestToConsent: 'missing',
            details: {
              policyProtocolVersion: policy.protocolVersion,
            },
          })
        }

        if (!policy.supportedProtocols.includes(parsedRequest.protocolVersion)) {
          return buildFailure({
            code: 'UNSUPPORTED_PROTOCOL',
            message: 'request protocol version is not supported by policy',
            summary: parsedSummary,
            requestToPolicy: 'mismatch',
            requestToConsent: 'missing',
            details: {
              protocolVersion: parsedRequest.protocolVersion,
            },
          })
        }

        if (detectPolicyConflict(policy)) {
          return buildFailure({
            code: 'POLICY_CONFLICT',
            message: 'privacy policy contains conflicting constraints',
            summary: parsedSummary,
            requestToPolicy: 'mismatch',
            requestToConsent: 'missing',
          })
        }

        if (!isKnownPurpose(parsedRequest.purpose)) {
          return buildFailure({
            code: 'PURPOSE_NOT_ALLOWED',
            message: 'requested purpose is unknown',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: 'missing',
          })
        }

        if (
          isProhibitedPurpose(parsedRequest.purpose) ||
          !isAllowedPurpose(parsedRequest.purpose) ||
          !(policy.allowedPurposes as readonly string[]).includes(parsedRequest.purpose)
        ) {
          return buildFailure({
            code: 'PURPOSE_NOT_ALLOWED',
            message: 'requested purpose is not authorized by policy',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: 'missing',
          })
        }

        if ((policy.prohibitedPurposes as readonly string[]).includes(parsedRequest.purpose)) {
          return buildFailure({
            code: 'PURPOSE_NOT_ALLOWED',
            message: 'requested purpose is explicitly prohibited by policy',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: 'missing',
          })
        }

        if (!isKnownProcessingMode(parsedRequest.processingMode)) {
          return buildFailure({
            code: 'PROCESSING_MODE_NOT_ALLOWED',
            message: 'requested processing mode is unknown',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: 'missing',
          })
        }

        if (!(policy.allowedProcessingModes as readonly string[]).includes(parsedRequest.processingMode)) {
          return buildFailure({
            code: 'PROCESSING_MODE_NOT_ALLOWED',
            message: 'requested processing mode is not allowed by policy',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: 'missing',
          })
        }

        const modePolicy = toModePolicy(policy, parsedRequest.processingMode)
        if (modePolicy === null) {
          return buildFailure({
            code: 'POLICY_CONFLICT',
            message: 'missing mode policy for requested processing mode',
            summary: parsedSummary,
            requestToPolicy: 'mismatch',
            requestToConsent: 'missing',
          })
        }

        const knownCategories: AIDataCategory[] = []
        const knownClassifications: AIDataClassification[] = []

        for (const reference of parsedRequest.dataReferences) {
          if (!isKnownDataCategory(reference.category)) {
            return buildFailure({
              code: 'DATA_CATEGORY_NOT_ALLOWED',
              message: 'request contains unknown data category',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: expectedConsentRelation(modePolicy),
            })
          }

          if (!isKnownDataClassification(reference.classification)) {
            return buildFailure({
              code: 'DATA_CLASSIFICATION_NOT_ALLOWED',
              message: 'request contains unknown data classification',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: expectedConsentRelation(modePolicy),
            })
          }

          if (reference.classification === 'CREDENTIAL_OR_SECRET') {
            return buildFailure({
              code: 'SECRET_DATA_PROHIBITED',
              message: 'secret material is never authorizable',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: expectedConsentRelation(modePolicy),
            })
          }

          if (!modePolicy.allowedDataCategories.includes(reference.category)) {
            return buildFailure({
              code: 'DATA_CATEGORY_NOT_ALLOWED',
              message: 'data category is not allowed for processing mode',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: expectedConsentRelation(modePolicy),
            })
          }

          if (!modePolicy.allowedClassifications.includes(reference.classification)) {
            return buildFailure({
              code: 'DATA_CLASSIFICATION_NOT_ALLOWED',
              message: 'data classification is not allowed for processing mode',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: expectedConsentRelation(modePolicy),
            })
          }

          knownCategories.push(reference.category)
          knownClassifications.push(reference.classification)
        }

        const categories = canonicalCategories(knownCategories)
        const maxClassification = highestClassification(knownClassifications)

        if (categories.length > policy.traceabilityLimits.maxCategoryCount) {
          return buildFailure({
            code: 'POLICY_CONFLICT',
            message: 'traceability limits reject the amount of requested categories',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: expectedConsentRelation(modePolicy),
          })
        }

        const forbiddenFailureCode = applyForbiddenCombinations({
          policy,
          parsedRequest,
        })

        if (forbiddenFailureCode !== null) {
          return buildFailure({
            code: forbiddenFailureCode,
            message: 'request violates a forbidden policy combination',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: expectedConsentRelation(modePolicy),
          })
        }

        if (!modePolicy.allowedRetention.includes(parsedRequest.retention)) {
          return buildFailure({
            code: 'RETENTION_POLICY_VIOLATION',
            message: 'retention directive is not authorized by policy',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: expectedConsentRelation(modePolicy),
          })
        }

        if (!modePolicy.allowedTraining.includes(parsedRequest.training)) {
          return buildFailure({
            code: 'TRAINING_POLICY_VIOLATION',
            message: 'training directive is not authorized by policy',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: expectedConsentRelation(modePolicy),
          })
        }

        if (!modePolicy.allowedLogging.includes(parsedRequest.logging)) {
          return buildFailure({
            code: 'LOGGING_POLICY_VIOLATION',
            message: 'logging directive is not authorized by policy',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: expectedConsentRelation(modePolicy),
          })
        }

        if (
          modePolicy.minimizationRequired &&
          (!parsedRequest.minimization.applied ||
            parsedRequest.minimization.strategyCodes.length === 0)
        ) {
          return buildFailure({
            code: 'MINIMIZATION_REQUIRED',
            message: 'minimization requirements are missing',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: expectedConsentRelation(modePolicy),
          })
        }

        if (
          modePolicy.redactionRequired &&
          (!parsedRequest.redaction.applied ||
            parsedRequest.redaction.strategyCodes.length === 0)
        ) {
          return buildFailure({
            code: 'REDACTION_REQUIRED',
            message: 'redaction requirements are missing',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: expectedConsentRelation(modePolicy),
          })
        }

        const consent = parsedRequest.consent

        if (modePolicy.consentRequired && consent === null) {
          const failureCode: AIPrivacyFailureCode =
            parsedRequest.processingMode === 'EXTERNAL_PROVIDER'
              ? 'EXTERNAL_PROCESSING_NOT_AUTHORIZED'
              : 'MISSING_CONSENT'

          return buildFailure({
            code: failureCode,
            message: 'explicit consent is required for this request',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: 'missing',
          })
        }

        if (consent !== null && !isConsentShape(consent)) {
          return buildFailure({
            code: 'INVALID_CONSENT',
            message: 'consent record has an invalid structure',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: 'mismatch',
          })
        }

        if (consent !== null) {
          if (consent.status === 'REVOKED' || consent.revocation.revoked) {
            return buildFailure({
              code: 'REVOKED_CONSENT',
              message: 'consent is revoked and cannot authorize processing',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }

          if (consent.status !== 'ACTIVE') {
            return buildFailure({
              code: 'INVALID_CONSENT',
              message: 'consent is not active',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }

          if (
            policy.requireExactConsentPolicyVersion &&
            consent.policyVersion !== policy.policyVersion
          ) {
            return buildFailure({
              code: 'INVALID_CONSENT',
              message: 'consent policy version does not match active policy',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }

          if (consent.policyProtocolVersion !== parsedRequest.protocolVersion) {
            return buildFailure({
              code: 'INVALID_CONSENT',
              message: 'consent protocol version does not match request protocol',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }

          if (consent.scope.purpose !== parsedRequest.purpose) {
            return buildFailure({
              code: 'CONSENT_PURPOSE_MISMATCH',
              message: 'consent purpose does not match requested purpose',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }

          if (
            !sameOrderedValues(
              canonicalCategories(consent.scope.dataCategories),
              canonicalCategories(categories),
            )
          ) {
            return buildFailure({
              code: 'CONSENT_DATA_SCOPE_MISMATCH',
              message: 'consent data categories do not match requested categories',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }

          const consentModes = canonicalUniqueStrings(consent.scope.processingModes)
          const requestedModes = canonicalUniqueStrings([parsedRequest.processingMode])

          if (!sameOrderedValues(consentModes, requestedModes)) {
            return buildFailure({
              code: 'CONSENT_PROCESSING_MODE_MISMATCH',
              message: 'consent processing mode does not match request',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }

          if (
            CLASSIFICATION_RANK[consent.scope.maxClassification] <
            CLASSIFICATION_RANK[maxClassification]
          ) {
            return buildFailure({
              code: 'CONSENT_DATA_SCOPE_MISMATCH',
              message: 'consent maximum classification is lower than requested',
              summary: parsedSummary,
              requestToPolicy: 'matched',
              requestToConsent: 'mismatch',
            })
          }
        }

        if (!validateTraceability(parsedRequest, policy, consent, categories)) {
          return buildFailure({
            code: 'TRACEABILITY_MISMATCH',
            message: 'traceability metadata does not match request/policy/consent',
            summary: parsedSummary,
            requestToPolicy: 'matched',
            requestToConsent: consent === null ? expectedConsentRelation(modePolicy) : 'mismatch',
          })
        }

        const sanitizedSummary = sanitizeSummaryForSuccess({
          parsedRequest,
          policy,
          consent,
          categories,
          maxClassification,
        })

        const traceability = buildTraceability({
          summary: sanitizedSummary,
          decision: 'authorized',
          requestToPolicy: 'matched',
          requestToConsent: consent === null ? 'not-required' : 'matched',
        })

        const envelope: AIAuthorizedRequestEnvelope = {
          requestId: parsedRequest.requestId,
          purpose: parsedRequest.purpose as AIAuthorizedRequestEnvelope['purpose'],
          processingMode: parsedRequest.processingMode as AIAuthorizedRequestEnvelope['processingMode'],
          authorizedDataReferences: authorizedReferences(parsedRequest.dataReferences),
          authorizedCategories: canonicalCategories(categories),
          maxAuthorizedClassification: maxClassification,
          policy: {
            policyId: policy.policyId,
            policyVersion: policy.policyVersion,
            protocolVersion: parsedRequest.protocolVersion,
          },
          consent:
            consent === null
              ? null
              : {
                  consentId: consent.consentId,
                  status: consent.status,
                  scopeId: consent.scope.scopeId,
                  consentTextVersion: consent.consentTextVersion,
                  policyVersion: consent.policyVersion,
                },
          requirements: {
            minimizationRequired: modePolicy.minimizationRequired,
            minimizationApplied: parsedRequest.minimization.applied,
            minimizationStrategyCodes: canonicalUniqueStrings(
              parsedRequest.minimization.strategyCodes,
            ),
            redactionRequired: modePolicy.redactionRequired,
            redactionApplied: parsedRequest.redaction.applied,
            redactionStrategyCodes: canonicalUniqueStrings(
              parsedRequest.redaction.strategyCodes,
            ),
            contextBuilderConstraints: deepClone(parsedRequest.contextBuilderConstraints),
          },
          governance: {
            retention: parsedRequest.retention,
            training: parsedRequest.training,
            logging: parsedRequest.logging,
          },
          traceability,
        }

        const success: AIPrivacyAuthorizationSuccess = {
          ok: true,
          status: 'success',
          deterministic: true,
          failClosed: true,
          envelope,
          traceability,
        }

        if (!isSuccessConsistent(success) || !isJsonSafeValue(success, new Set())) {
          return buildFailure({
            code: 'INCONSISTENT_AUTHORIZATION_RESULT',
            message: 'authorization result consistency validation failed',
            summary: sanitizedSummary,
            requestToPolicy: 'matched',
            requestToConsent: consent === null ? 'not-required' : 'matched',
          })
        }

        return deepClone(success)
      } catch {
        return buildFailure({
          code: 'INCONSISTENT_AUTHORIZATION_RESULT',
          message: 'unexpected boundary exception converted to fail-closed result',
          summary: parsedSummary,
          requestToPolicy: parsedRequest === null ? 'missing' : 'mismatch',
          requestToConsent: parsedRequest === null ? 'missing' : 'mismatch',
        })
      }
    },
  }
}

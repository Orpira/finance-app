import {
  AI_ALLOWED_PURPOSES,
  AI_DATA_CATEGORIES,
  AI_DATA_CLASSIFICATIONS,
  AI_DATA_CLASSIFICATION_SENSITIVITY_ORDER,
  AI_PROCESSING_MODES,
  type AIAuthorizedRequestEnvelope,
  type AIDataCategory,
  type AIDataClassification,
  type AIProcessingMode,
} from './aiFoundationContracts'
import type { SnapshotJsonObject } from '../../types/financialSnapshot'
import type {
  AIContextBuildFailure,
  AIContextBuildRequest,
  AIContextBuildResult,
  AIContextBuildSuccess,
  AIContextBuilderFailureCode,
  AIContextDescriptorType,
  AIContextFragment,
  AIContextPackage,
  AIContextRedactionStrategy,
  AIContextSourceDescriptor,
  AIContextTraceability,
  AIAppliedMinimization,
  AIAppliedRedaction,
  ContextResolutionResult,
  ContextSourceResolverPort,
  ResolvedContextFragment,
} from './aiContextBuilderContracts'
import type {
  AIContextBuilderDependencies,
  AIContextBuilderPort,
} from './aiContextBuilderInterfaces'

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

const PURPOSE_SET = new Set<string>(AI_ALLOWED_PURPOSES)
const PROCESSING_MODE_SET = new Set<string>(AI_PROCESSING_MODES)
const DATA_CATEGORY_SET = new Set<string>(AI_DATA_CATEGORIES)
const DATA_CLASSIFICATION_SET = new Set<string>(AI_DATA_CLASSIFICATIONS)

const CATEGORY_RANK: Record<AIDataCategory, number> = {
  INSIGHT_SUMMARY: 0,
  INSIGHT_READ_MODEL: 1,
  FINANCIAL_SNAPSHOT: 2,
  KNOWLEDGE_COLLECTION: 3,
  USER_PROVIDED_TEXT: 4,
  APP_METADATA: 5,
  DIAGNOSTIC_METADATA: 6,
}

const CLASSIFICATION_RANK: Record<AIDataClassification, number> = {
  PUBLIC: 0,
  INTERNAL: 1,
  PERSONAL: 2,
  FINANCIAL: 3,
  HIGHLY_SENSITIVE_FINANCIAL: 4,
  CREDENTIAL_OR_SECRET: 5,
}

const DESCRIPTOR_CATEGORY: Record<AIContextDescriptorType, AIDataCategory> = {
  InsightSummaryReference: 'INSIGHT_SUMMARY',
  InsightReadModelReference: 'INSIGHT_READ_MODEL',
  SnapshotReference: 'FINANCIAL_SNAPSHOT',
  KnowledgeReference: 'KNOWLEDGE_COLLECTION',
  MetadataReference: 'APP_METADATA',
  UserTextReference: 'USER_PROVIDED_TEXT',
  DiagnosticReference: 'DIAGNOSTIC_METADATA',
}

const REDACTION_PRIORITY: Record<AIContextRedactionStrategy, number> = {
  REMOVE: 0,
  MASK: 1,
  HASH_REFERENCE: 2,
  KEEP: 3,
}

const SENSITIVE_REMOVE_KEYS = new Set([
  'apikey',
  'api_key',
  'secret',
  'token',
  'password',
  'credential',
  'credentials',
  'privatekey',
  'private_key',
])

const TEXT_MASK_KEYS = new Set([
  'text',
  'usertext',
  'description',
  'note',
  'notes',
  'comment',
])

const REFERENCE_HASH_KEYS = new Set([
  'reference',
  'referenceid',
  'selector',
  'source',
])

const MINIMIZATION_DROP_KEYS = new Set([
  'internalid',
  'internal_id',
  'debug',
  'debuginfo',
  'stack',
  'stacktrace',
  'trace',
  'traceid',
  'token',
  'secret',
  'password',
  'apikey',
  'api_key',
  'credential',
  'credentials',
  'createdat',
  'updatedat',
  'generatedat',
  'timestamp',
  'recordedat',
])

interface ParsedRequest {
  readonly envelope: AIAuthorizedRequestEnvelope
  readonly sourceDescriptors: readonly AIContextSourceDescriptor[]
}

interface ParsedAuthorizedReference {
  readonly referenceId: string
  readonly category: AIDataCategory
  readonly classification: AIDataClassification
  readonly selector: string
}

interface BuildSummary {
  readonly traceId: string | null
  readonly relationId: string | null
  readonly requestId: string | null
  readonly policyVersion: string | null
  readonly protocolVersion: number | null
  readonly purpose: string | null
  readonly processingMode: AIProcessingMode | null
  readonly authorizedCategories: readonly AIDataCategory[]
}

function isKnownPurpose(value: string): value is AIAuthorizedRequestEnvelope['purpose'] {
  return PURPOSE_SET.has(value)
}

function isKnownProcessingMode(value: string): value is AIProcessingMode {
  return PROCESSING_MODE_SET.has(value)
}

function isKnownCategory(value: string): value is AIDataCategory {
  return DATA_CATEGORY_SET.has(value)
}

function isKnownClassification(value: string): value is AIDataClassification {
  return DATA_CLASSIFICATION_SET.has(value)
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
  const sorted = [...new Set(classifications)].sort(
    (left, right) => CLASSIFICATION_RANK[left] - CLASSIFICATION_RANK[right],
  )

  return sorted[sorted.length - 1] ?? AI_DATA_CLASSIFICATION_SENSITIVITY_ORDER[0]
}

function parseRedactionStrategies(codes: readonly string[]): readonly AIContextRedactionStrategy[] {
  const strategies = new Set<AIContextRedactionStrategy>()

  for (const code of codes) {
    const normalized = code.toLowerCase()
    if (normalized.includes('remove')) {
      strategies.add('REMOVE')
    }
    if (normalized.includes('mask')) {
      strategies.add('MASK')
    }
    if (normalized.includes('hash')) {
      strategies.add('HASH_REFERENCE')
    }
    if (normalized.includes('keep')) {
      strategies.add('KEEP')
    }
  }

  if (strategies.size === 0) {
    strategies.add('KEEP')
  }

  return [...strategies].sort(
    (left, right) => REDACTION_PRIORITY[left] - REDACTION_PRIORITY[right],
  )
}

function normalizeKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
}

function referenceKey(input: {
  readonly referenceId: string
  readonly category: AIDataCategory
  readonly classification: AIDataClassification
  readonly selector: string
}): string {
  return [
    input.referenceId,
    input.category,
    input.classification,
    input.selector,
  ].join('|')
}

function descriptorOrder(
  left: AIContextSourceDescriptor,
  right: AIContextSourceDescriptor,
): number {
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

  const bySelector = compareStrings(left.selector, right.selector)
  if (bySelector !== 0) {
    return bySelector
  }

  return compareStrings(left.descriptorType, right.descriptorType)
}

function fragmentOrder(left: AIContextFragment, right: AIContextFragment): number {
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

  return compareStrings(left.descriptorType, right.descriptorType)
}

function stableStringify(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`
  }

  if (!isRecord(value)) {
    return JSON.stringify(String(value))
  }

  const keys = Object.keys(value).sort(compareStrings)
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
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

function toHashedReference(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24)
  }

  return `ref_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function isEnvelopeShape(value: unknown): value is AIAuthorizedRequestEnvelope {
  if (!isRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.requestId) ||
    !isNonEmptyString(value.purpose) ||
    !isKnownPurpose(value.purpose) ||
    !isNonEmptyString(value.processingMode) ||
    !isKnownProcessingMode(value.processingMode)
  ) {
    return false
  }

  if (!Array.isArray(value.authorizedDataReferences) || value.authorizedDataReferences.length === 0) {
    return false
  }

  if (!Array.isArray(value.authorizedCategories) || value.authorizedCategories.length === 0) {
    return false
  }

  if (!isNonEmptyString(value.maxAuthorizedClassification) || !isKnownClassification(value.maxAuthorizedClassification)) {
    return false
  }

  if (!isRecord(value.policy)) {
    return false
  }

  if (
    !isNonEmptyString(value.policy.policyId) ||
    !isNonEmptyString(value.policy.policyVersion) ||
    !isSafeNonNegativeInteger(value.policy.protocolVersion)
  ) {
    return false
  }

  if (!isRecord(value.requirements)) {
    return false
  }

  if (
    !isBoolean(value.requirements.minimizationRequired) ||
    !isBoolean(value.requirements.minimizationApplied) ||
    !Array.isArray(value.requirements.minimizationStrategyCodes) ||
    !isBoolean(value.requirements.redactionRequired) ||
    !isBoolean(value.requirements.redactionApplied) ||
    !Array.isArray(value.requirements.redactionStrategyCodes) ||
    !Array.isArray(value.requirements.contextBuilderConstraints)
  ) {
    return false
  }

  for (const code of value.requirements.minimizationStrategyCodes) {
    if (!isNonEmptyString(code)) {
      return false
    }
  }

  for (const code of value.requirements.redactionStrategyCodes) {
    if (!isNonEmptyString(code)) {
      return false
    }
  }

  for (const constraint of value.requirements.contextBuilderConstraints) {
    if (!isRecord(constraint) || !isNonEmptyString(constraint.code) || !isNonEmptyString(constraint.requirement)) {
      return false
    }
  }

  if (!isRecord(value.governance)) {
    return false
  }

  if (
    !isNonEmptyString(value.governance.retention) ||
    !isNonEmptyString(value.governance.training) ||
    !isNonEmptyString(value.governance.logging)
  ) {
    return false
  }

  if (!isRecord(value.traceability)) {
    return false
  }

  if (
    !isNonEmptyString(value.traceability.traceId) ||
    !isNonEmptyString(value.traceability.relationId) ||
    !isNonEmptyString(value.traceability.requestId) ||
    !isNonEmptyString(value.traceability.policyVersion) ||
    !isNonEmptyString(value.traceability.purpose) ||
    !isNonEmptyString(value.traceability.processingMode)
  ) {
    return false
  }

  if (!Array.isArray(value.traceability.categories)) {
    return false
  }

  if (!isRecord(value.traceability.relation)) {
    return false
  }

  return true
}

function parseAuthorizedReferences(
  envelope: AIAuthorizedRequestEnvelope,
): readonly ParsedAuthorizedReference[] | null {
  const parsed: ParsedAuthorizedReference[] = []
  const seenByReferenceId = new Set<string>()

  for (const entry of envelope.authorizedDataReferences) {
    if (!isRecord(entry)) {
      return null
    }

    if (
      !isNonEmptyString(entry.referenceId) ||
      !isNonEmptyString(entry.category) ||
      !isKnownCategory(entry.category) ||
      !isNonEmptyString(entry.classification) ||
      !isKnownClassification(entry.classification) ||
      !isNonEmptyString(entry.selector)
    ) {
      return null
    }

    if (seenByReferenceId.has(entry.referenceId)) {
      return null
    }

    seenByReferenceId.add(entry.referenceId)
    parsed.push({
      referenceId: entry.referenceId,
      category: entry.category,
      classification: entry.classification,
      selector: entry.selector,
    })
  }

  const expectedCategories = canonicalCategories(parsed.map((entry) => entry.category))
  const declaredCategories = canonicalCategories(
    envelope.authorizedCategories.filter((category): category is AIDataCategory =>
      isKnownCategory(category),
    ),
  )

  if (declaredCategories.length !== envelope.authorizedCategories.length) {
    return null
  }

  if (stableStringify(expectedCategories) !== stableStringify(declaredCategories)) {
    return null
  }

  if (highestClassification(parsed.map((entry) => entry.classification)) !== envelope.maxAuthorizedClassification) {
    return null
  }

  if (envelope.traceability.requestId !== envelope.requestId) {
    return null
  }

  if (envelope.traceability.policyVersion !== envelope.policy.policyVersion) {
    return null
  }

  if (envelope.traceability.purpose !== envelope.purpose) {
    return null
  }

  if (envelope.traceability.processingMode !== envelope.processingMode) {
    return null
  }

  return parsed
}

function isDescriptorShape(value: unknown): value is AIContextSourceDescriptor {
  if (!isRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.descriptorType) ||
    !isNonEmptyString(value.referenceId) ||
    !isNonEmptyString(value.category) ||
    !isNonEmptyString(value.classification) ||
    !isNonEmptyString(value.selector)
  ) {
    return false
  }

  if (!(value.descriptorType in DESCRIPTOR_CATEGORY)) {
    return false
  }

  if (!isKnownCategory(value.category) || !isKnownClassification(value.classification)) {
    return false
  }

  const expectedCategory = DESCRIPTOR_CATEGORY[value.descriptorType as AIContextDescriptorType]
  if (expectedCategory !== value.category) {
    return false
  }

  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    return false
  }

  return true
}

function parseBuildRequest(request: AIContextBuildRequest | null | undefined): ParsedRequest | null {
  if (!isRecord(request)) {
    return null
  }

  if (!isEnvelopeShape(request.envelope)) {
    return null
  }

  if (!Array.isArray(request.sourceDescriptors) || request.sourceDescriptors.length === 0) {
    return null
  }

  const descriptors: AIContextSourceDescriptor[] = []
  const seenReferenceIds = new Set<string>()
  for (const sourceDescriptor of request.sourceDescriptors) {
    if (!isDescriptorShape(sourceDescriptor)) {
      return null
    }

    if (seenReferenceIds.has(sourceDescriptor.referenceId)) {
      return null
    }

    seenReferenceIds.add(sourceDescriptor.referenceId)
    descriptors.push(deepClone(sourceDescriptor))
  }

  return {
    envelope: deepClone(request.envelope),
    sourceDescriptors: descriptors,
  }
}

function summarizeEnvelope(parsed: ParsedRequest | null): BuildSummary {
  if (parsed === null) {
    return {
      traceId: null,
      relationId: null,
      requestId: null,
      policyVersion: null,
      protocolVersion: null,
      purpose: null,
      processingMode: null,
      authorizedCategories: [],
    }
  }

  return {
    traceId: parsed.envelope.traceability.traceId,
    relationId: parsed.envelope.traceability.relationId,
    requestId: parsed.envelope.requestId,
    policyVersion: parsed.envelope.policy.policyVersion,
    protocolVersion: parsed.envelope.policy.protocolVersion,
    purpose: parsed.envelope.purpose,
    processingMode: parsed.envelope.processingMode,
    authorizedCategories: canonicalCategories(parsed.envelope.authorizedCategories),
  }
}

function buildTraceability(input: {
  readonly summary: BuildSummary
  readonly resolvedReferencesCount: number
  readonly decision: 'built' | 'rejected'
  readonly failureCode?: AIContextBuilderFailureCode
  readonly requestToEnvelope: 'matched' | 'missing' | 'mismatch'
  readonly envelopeToDescriptors: 'matched' | 'missing' | 'mismatch'
}): AIContextTraceability {
  return {
    traceId: input.summary.traceId,
    relationId: input.summary.relationId,
    requestId: input.summary.requestId,
    policyVersion: input.summary.policyVersion,
    protocolVersion: input.summary.protocolVersion,
    purpose: input.summary.purpose,
    processingMode: input.summary.processingMode,
    authorizedCategories: canonicalCategories(input.summary.authorizedCategories),
    resolvedReferencesCount: input.resolvedReferencesCount,
    decision: input.decision,
    ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
    relation: {
      requestToEnvelope: input.requestToEnvelope,
      envelopeToDescriptors: input.envelopeToDescriptors,
    },
  }
}

function buildFailure(input: {
  readonly code: AIContextBuilderFailureCode
  readonly message: string
  readonly summary: BuildSummary
  readonly requestToEnvelope: 'matched' | 'missing' | 'mismatch'
  readonly envelopeToDescriptors: 'matched' | 'missing' | 'mismatch'
  readonly resolvedReferencesCount: number
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}): AIContextBuildFailure {
  return {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    code: input.code,
    message: input.message,
    traceability: buildTraceability({
      summary: input.summary,
      resolvedReferencesCount: input.resolvedReferencesCount,
      decision: 'rejected',
      failureCode: input.code,
      requestToEnvelope: input.requestToEnvelope,
      envelopeToDescriptors: input.envelopeToDescriptors,
    }),
    ...(input.details === undefined ? {} : { details: input.details }),
  }
}

function hasResolverShape(value: unknown): value is ContextSourceResolverPort {
  return isRecord(value) && typeof value.resolve === 'function'
}

function ensureResolver(
  dependencies: AIContextBuilderDependencies,
): ContextSourceResolverPort | null {
  if (!hasResolverShape(dependencies.resolver)) {
    return null
  }

  return dependencies.resolver
}

function ensureEnvelopeAlignment(input: {
  readonly envelope: AIAuthorizedRequestEnvelope
  readonly authorizedReferences: readonly ParsedAuthorizedReference[]
  readonly descriptors: readonly AIContextSourceDescriptor[]
}):
  | { readonly ok: true; readonly descriptorByReferenceId: ReadonlyMap<string, AIContextSourceDescriptor> }
  | { readonly ok: false; readonly code: AIContextBuilderFailureCode; readonly message: string } {
  const authorizedByKey = new Set<string>()
  const authorizedByReferenceId = new Map<string, ParsedAuthorizedReference>()

  for (const authorized of input.authorizedReferences) {
    const key = referenceKey(authorized)
    authorizedByKey.add(key)
    authorizedByReferenceId.set(authorized.referenceId, authorized)
  }

  const descriptorByReferenceId = new Map<string, AIContextSourceDescriptor>()
  for (const descriptor of input.descriptors) {
    const authorized = authorizedByReferenceId.get(descriptor.referenceId)
    if (authorized === undefined) {
      return {
        ok: false,
        code: 'UNKNOWN_REFERENCE',
        message: 'descriptor reference does not exist in authorized envelope',
      }
    }

    const descriptorKey = referenceKey({
      referenceId: descriptor.referenceId,
      category: descriptor.category,
      classification: descriptor.classification,
      selector: descriptor.selector,
    })

    if (!authorizedByKey.has(descriptorKey)) {
      return {
        ok: false,
        code: 'ENVELOPE_VIOLATION',
        message: 'descriptor does not match authorized envelope scope',
      }
    }

    descriptorByReferenceId.set(descriptor.referenceId, descriptor)
  }

  if (descriptorByReferenceId.size !== input.authorizedReferences.length) {
    return {
      ok: false,
      code: 'PARTIAL_RESOLUTION',
      message: 'descriptor set does not fully cover authorized references',
    }
  }

  return {
    ok: true,
    descriptorByReferenceId,
  }
}

function isResolutionSuccessShape(value: unknown): value is Extract<ContextResolutionResult, { ok: true }> {
  if (!isRecord(value)) {
    return false
  }

  if (value.ok !== true || value.status !== 'resolved') {
    return false
  }

  if (!isDescriptorShape(value.descriptor)) {
    return false
  }

  if (!isRecord(value.fragment)) {
    return false
  }

  return true
}

function isResolutionFailureShape(value: unknown): value is Extract<ContextResolutionResult, { ok: false }> {
  if (!isRecord(value)) {
    return false
  }

  if (value.ok !== false || value.status !== 'failure') {
    return false
  }

  if (!isDescriptorShape(value.descriptor)) {
    return false
  }

  if (!isNonEmptyString(value.code) || !isNonEmptyString(value.message)) {
    return false
  }

  if (value.details !== undefined && !isRecord(value.details)) {
    return false
  }

  return true
}

function isResolvedFragmentShape(value: unknown): value is ResolvedContextFragment {
  if (!isRecord(value)) {
    return false
  }

  if (
    !isNonEmptyString(value.referenceId) ||
    !isNonEmptyString(value.descriptorType) ||
    !isNonEmptyString(value.category) ||
    !isNonEmptyString(value.classification)
  ) {
    return false
  }

  if (!(value.descriptorType in DESCRIPTOR_CATEGORY)) {
    return false
  }

  if (!isKnownCategory(value.category) || !isKnownClassification(value.classification)) {
    return false
  }

  if (!isRecord(value.payload)) {
    return false
  }

  return true
}

function applyRedaction(input: {
  readonly value: unknown
  readonly referenceId: string
  readonly path: string
  readonly keyHint?: string
  readonly strategies: readonly AIContextRedactionStrategy[]
  readonly redactionRequired: boolean
  readonly appliedRedactions: AIAppliedRedaction[]
}):
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false } {
  const normalizedKey = input.keyHint === undefined ? undefined : normalizeKey(input.keyHint)
  const canRemove = input.strategies.includes('REMOVE')
  const canMask = input.strategies.includes('MASK')
  const canHash = input.strategies.includes('HASH_REFERENCE')

  if (input.value === null || typeof input.value === 'number' || typeof input.value === 'boolean') {
    return { ok: true, value: input.value }
  }

  if (typeof input.value === 'string') {
    if (normalizedKey !== undefined && TEXT_MASK_KEYS.has(normalizedKey) && canMask) {
      input.appliedRedactions.push({
        referenceId: input.referenceId,
        path: input.path,
        strategy: 'MASK',
        reasonCode: 'redaction.mask.text',
      })
      return { ok: true, value: '<masked>' }
    }

    if (normalizedKey !== undefined && REFERENCE_HASH_KEYS.has(normalizedKey) && canHash) {
      input.appliedRedactions.push({
        referenceId: input.referenceId,
        path: input.path,
        strategy: 'HASH_REFERENCE',
        reasonCode: 'redaction.hash.reference',
      })
      return { ok: true, value: toHashedReference(input.value) }
    }

    return { ok: true, value: input.value }
  }

  if (Array.isArray(input.value)) {
    const output: unknown[] = []
    for (const [index, item] of input.value.entries()) {
      const itemPath = `${input.path}[${index}]`
      const redacted = applyRedaction({
        value: item,
        referenceId: input.referenceId,
        path: itemPath,
        keyHint: input.keyHint,
        strategies: input.strategies,
        redactionRequired: input.redactionRequired,
        appliedRedactions: input.appliedRedactions,
      })

      if (!redacted.ok) {
        return { ok: false }
      }

      output.push(redacted.value)
    }

    return { ok: true, value: output }
  }

  if (!isRecord(input.value)) {
    return { ok: false }
  }

  const output: Record<string, unknown> = {}
  const sortedKeys = Object.keys(input.value).sort(compareStrings)
  for (const key of sortedKeys) {
    const normalized = normalizeKey(key)
    const nextPath = input.path.length === 0 ? key : `${input.path}.${key}`

    if (SENSITIVE_REMOVE_KEYS.has(normalized)) {
      if (canRemove) {
        input.appliedRedactions.push({
          referenceId: input.referenceId,
          path: nextPath,
          strategy: 'REMOVE',
          reasonCode: 'redaction.remove.sensitive',
        })
        continue
      }

      if (input.redactionRequired) {
        return { ok: false }
      }
    }

    const redacted = applyRedaction({
      value: input.value[key],
      referenceId: input.referenceId,
      path: nextPath,
      keyHint: key,
      strategies: input.strategies,
      redactionRequired: input.redactionRequired,
      appliedRedactions: input.appliedRedactions,
    })

    if (!redacted.ok) {
      return { ok: false }
    }

    output[key] = redacted.value
  }

  return { ok: true, value: output }
}

function applyMinimization(input: {
  readonly value: unknown
  readonly referenceId: string
  readonly path: string
  readonly appliedMinimization: AIAppliedMinimization[]
}): unknown | undefined {
  if (input.value === null || input.value === undefined) {
    input.appliedMinimization.push({
      referenceId: input.referenceId,
      path: input.path,
      reasonCode: 'minimization.remove.empty',
    })
    return undefined
  }

  if (typeof input.value === 'number') {
    if (!Number.isFinite(input.value)) {
      input.appliedMinimization.push({
        referenceId: input.referenceId,
        path: input.path,
        reasonCode: 'minimization.remove.non-finite-number',
      })
      return undefined
    }

    return input.value
  }

  if (typeof input.value === 'boolean') {
    return input.value
  }

  if (typeof input.value === 'string') {
    if (input.value.trim().length === 0) {
      input.appliedMinimization.push({
        referenceId: input.referenceId,
        path: input.path,
        reasonCode: 'minimization.remove.empty-string',
      })
      return undefined
    }

    return input.value
  }

  if (Array.isArray(input.value)) {
    const deduplication = new Set<string>()
    const output: unknown[] = []

    for (const [index, item] of input.value.entries()) {
      const itemPath = `${input.path}[${index}]`
      const minimized = applyMinimization({
        value: item,
        referenceId: input.referenceId,
        path: itemPath,
        appliedMinimization: input.appliedMinimization,
      })

      if (minimized === undefined) {
        continue
      }

      const signature = stableStringify(minimized)
      if (deduplication.has(signature)) {
        input.appliedMinimization.push({
          referenceId: input.referenceId,
          path: itemPath,
          reasonCode: 'minimization.remove.duplicate-array-item',
        })
        continue
      }

      deduplication.add(signature)
      output.push(minimized)
    }

    if (output.length === 0) {
      input.appliedMinimization.push({
        referenceId: input.referenceId,
        path: input.path,
        reasonCode: 'minimization.remove.empty-array',
      })
      return undefined
    }

    return output
  }

  if (!isRecord(input.value)) {
    input.appliedMinimization.push({
      referenceId: input.referenceId,
      path: input.path,
      reasonCode: 'minimization.remove.unsupported-value',
    })
    return undefined
  }

  const output: Record<string, unknown> = {}
  const keys = Object.keys(input.value).sort(compareStrings)
  for (const key of keys) {
    const normalized = normalizeKey(key)
    const itemPath = input.path.length === 0 ? key : `${input.path}.${key}`

    if (MINIMIZATION_DROP_KEYS.has(normalized)) {
      input.appliedMinimization.push({
        referenceId: input.referenceId,
        path: itemPath,
        reasonCode: 'minimization.remove.disallowed-key',
      })
      continue
    }

    const minimized = applyMinimization({
      value: input.value[key],
      referenceId: input.referenceId,
      path: itemPath,
      appliedMinimization: input.appliedMinimization,
    })

    if (minimized === undefined) {
      continue
    }

    output[key] = minimized
  }

  if (Object.keys(output).length === 0) {
    input.appliedMinimization.push({
      referenceId: input.referenceId,
      path: input.path,
      reasonCode: 'minimization.remove.empty-object',
    })
    return undefined
  }

  return output
}

function isContextPackageConsistent(result: AIContextBuildSuccess): boolean {
  return (
    result.contextPackage.requestId === result.traceability.requestId &&
    result.contextPackage.traceability.decision === 'built' &&
    result.contextPackage.traceability.requestId === result.contextPackage.requestId
  )
}

export function createAIContextBuilder(
  dependencies: AIContextBuilderDependencies = {},
): AIContextBuilderPort {
  const resolver = ensureResolver(dependencies)

  return {
    buildContext(
      request: AIContextBuildRequest | null | undefined,
    ): AIContextBuildResult {
      const parsedRequest = parseBuildRequest(request)
      const summary = summarizeEnvelope(parsedRequest)

      try {
        if (parsedRequest === null) {
          return buildFailure({
            code: 'INVALID_REQUEST',
            message: 'context build request is invalid',
            summary,
            requestToEnvelope: 'missing',
            envelopeToDescriptors: 'missing',
            resolvedReferencesCount: 0,
          })
        }

        const authorizedReferences = parseAuthorizedReferences(parsedRequest.envelope)
        if (authorizedReferences === null) {
          return buildFailure({
            code: 'INVALID_ENVELOPE',
            message: 'authorized envelope is structurally inconsistent',
            summary,
            requestToEnvelope: 'mismatch',
            envelopeToDescriptors: 'missing',
            resolvedReferencesCount: 0,
          })
        }

        if (resolver === null) {
          return buildFailure({
            code: 'MISSING_RESOLVER',
            message: 'context source resolver dependency is required',
            summary,
            requestToEnvelope: 'matched',
            envelopeToDescriptors: 'missing',
            resolvedReferencesCount: 0,
          })
        }

        const aligned = ensureEnvelopeAlignment({
          envelope: parsedRequest.envelope,
          authorizedReferences,
          descriptors: parsedRequest.sourceDescriptors,
        })

        if (!aligned.ok) {
          return buildFailure({
            code: aligned.code,
            message: aligned.message,
            summary,
            requestToEnvelope: 'matched',
            envelopeToDescriptors: aligned.code === 'PARTIAL_RESOLUTION' ? 'missing' : 'mismatch',
            resolvedReferencesCount: 0,
          })
        }

        const redactionStrategies = parseRedactionStrategies(
          parsedRequest.envelope.requirements.redactionStrategyCodes,
        )

        if (
          parsedRequest.envelope.requirements.redactionRequired &&
          !redactionStrategies.some((strategy) => strategy !== 'KEEP')
        ) {
          return buildFailure({
            code: 'REDACTION_CONFLICT',
            message: 'redaction is required but no effective strategy was declared',
            summary,
            requestToEnvelope: 'matched',
            envelopeToDescriptors: 'matched',
            resolvedReferencesCount: 0,
          })
        }

        const resolvedFragments: AIContextFragment[] = []
        const appliedRedactions: AIAppliedRedaction[] = []
        const appliedMinimization: AIAppliedMinimization[] = []

        const orderedDescriptors = [...parsedRequest.sourceDescriptors].sort(descriptorOrder)
        const authorizedByReferenceId = new Map<string, ParsedAuthorizedReference>()
        for (const reference of authorizedReferences) {
          authorizedByReferenceId.set(reference.referenceId, reference)
        }

        for (const descriptor of orderedDescriptors) {
          let resolution: ContextResolutionResult

          try {
            resolution = resolver.resolve(deepClone(descriptor))
          } catch {
            return buildFailure({
              code: 'RESOLUTION_FAILED',
              message: 'context source resolver threw an exception',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          if (!isResolutionSuccessShape(resolution) && !isResolutionFailureShape(resolution)) {
            return buildFailure({
              code: 'RESOLUTION_FAILED',
              message: 'context source resolver returned an invalid shape',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          if (!resolution.ok) {
            return buildFailure({
              code: 'RESOLUTION_FAILED',
              message: 'context source resolver rejected descriptor resolution',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
              details: {
                resolverCode: resolution.code,
              },
            })
          }

          if (!isResolvedFragmentShape(resolution.fragment)) {
            return buildFailure({
              code: 'INVALID_FRAGMENT',
              message: 'resolved context fragment is invalid',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          const fragment = resolution.fragment
          const authorized = authorizedByReferenceId.get(descriptor.referenceId)

          if (authorized === undefined) {
            return buildFailure({
              code: 'UNKNOWN_REFERENCE',
              message: 'resolved fragment does not belong to authorized envelope',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'mismatch',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          if (
            fragment.referenceId !== descriptor.referenceId ||
            fragment.descriptorType !== descriptor.descriptorType ||
            fragment.category !== descriptor.category
          ) {
            return buildFailure({
              code: 'ENVELOPE_VIOLATION',
              message: 'resolved fragment identity does not match descriptor',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'mismatch',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          if (!isKnownClassification(fragment.classification)) {
            return buildFailure({
              code: 'INVALID_FRAGMENT',
              message: 'resolved fragment classification is unknown',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          if (
            CLASSIFICATION_RANK[fragment.classification] >
              CLASSIFICATION_RANK[authorized.classification] ||
            CLASSIFICATION_RANK[fragment.classification] >
              CLASSIFICATION_RANK[parsedRequest.envelope.maxAuthorizedClassification]
          ) {
            return buildFailure({
              code: 'CLASSIFICATION_EXCEEDED',
              message: 'resolved fragment exceeds authorized classification limits',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          const redacted = applyRedaction({
            value: deepClone(fragment.payload),
            referenceId: fragment.referenceId,
            path: '',
            strategies: redactionStrategies,
            redactionRequired: parsedRequest.envelope.requirements.redactionRequired,
            appliedRedactions,
          })

          if (!redacted.ok) {
            return buildFailure({
              code: 'REDACTION_CONFLICT',
              message: 'redaction strategy conflict while processing fragment',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          const minimized = applyMinimization({
            value: redacted.value,
            referenceId: fragment.referenceId,
            path: '',
            appliedMinimization,
          })

          if (!isRecord(minimized)) {
            return buildFailure({
              code: 'INVALID_FRAGMENT',
              message: 'fragment becomes invalid after minimization',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          if (!isJsonSafe(minimized)) {
            return buildFailure({
              code: 'INVALID_FRAGMENT',
              message: 'fragment payload must remain JSON-safe',
              summary,
              requestToEnvelope: 'matched',
              envelopeToDescriptors: 'matched',
              resolvedReferencesCount: resolvedFragments.length,
            })
          }

          resolvedFragments.push({
            referenceId: fragment.referenceId,
            descriptorType: fragment.descriptorType,
            category: fragment.category,
            classification: fragment.classification,
            data: minimized as SnapshotJsonObject,
          })
        }

        if (resolvedFragments.length !== authorizedReferences.length) {
          return buildFailure({
            code: 'PARTIAL_RESOLUTION',
            message: 'context resolution did not produce all authorized fragments',
            summary,
            requestToEnvelope: 'matched',
            envelopeToDescriptors: 'missing',
            resolvedReferencesCount: resolvedFragments.length,
          })
        }

        const orderedContextFragments = [...resolvedFragments].sort(fragmentOrder)

        const traceability = buildTraceability({
          summary,
          resolvedReferencesCount: orderedContextFragments.length,
          decision: 'built',
          requestToEnvelope: 'matched',
          envelopeToDescriptors: 'matched',
        })

        const contextPackage: AIContextPackage = {
          requestId: parsedRequest.envelope.requestId,
          purpose: parsedRequest.envelope.purpose,
          processingMode: parsedRequest.envelope.processingMode,
          policyVersion: parsedRequest.envelope.policy.policyVersion,
          protocolVersion: parsedRequest.envelope.policy.protocolVersion,
          orderedContextFragments,
          appliedRedactions: [...appliedRedactions].sort((left, right) => {
            const byReferenceId = compareStrings(left.referenceId, right.referenceId)
            if (byReferenceId !== 0) {
              return byReferenceId
            }

            const byPath = compareStrings(left.path, right.path)
            if (byPath !== 0) {
              return byPath
            }

            return REDACTION_PRIORITY[left.strategy] - REDACTION_PRIORITY[right.strategy]
          }),
          appliedMinimization: [...appliedMinimization].sort((left, right) => {
            const byReferenceId = compareStrings(left.referenceId, right.referenceId)
            if (byReferenceId !== 0) {
              return byReferenceId
            }

            const byPath = compareStrings(left.path, right.path)
            if (byPath !== 0) {
              return byPath
            }

            return compareStrings(left.reasonCode, right.reasonCode)
          }),
          traceability,
        }

        const success: AIContextBuildSuccess = {
          ok: true,
          status: 'success',
          deterministic: true,
          failClosed: true,
          contextPackage,
          traceability,
        }

        if (!isJsonSafe(success) || !isContextPackageConsistent(success)) {
          return buildFailure({
            code: 'INCONSISTENT_CONTEXT_RESULT',
            message: 'context package consistency validation failed',
            summary,
            requestToEnvelope: 'matched',
            envelopeToDescriptors: 'matched',
            resolvedReferencesCount: orderedContextFragments.length,
          })
        }

        return deepClone(success)
      } catch {
        return buildFailure({
          code: 'INCONSISTENT_CONTEXT_RESULT',
          message: 'unexpected context builder exception converted to fail-closed result',
          summary,
          requestToEnvelope: parsedRequest === null ? 'missing' : 'mismatch',
          envelopeToDescriptors: 'mismatch',
          resolvedReferencesCount: 0,
        })
      }
    },
  }
}

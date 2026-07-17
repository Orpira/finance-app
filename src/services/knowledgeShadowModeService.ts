import {
  buildKnowledgeCollectionFromSnapshot,
  type KnowledgeBuilderError,
} from '../intelligence/knowledge-layer/knowledgeFactsBuilder'
import {
  canonicalizeValidatedKnowledgeCollection,
  KNOWLEDGE_CANONICALIZATION_VERSION_V1,
} from '../intelligence/knowledge-layer/knowledgeCanonicalizer'
import {
  fingerprintCanonicalKnowledgeDocument,
} from '../intelligence/knowledge-layer/knowledgeFingerprint'
import {
  KnowledgePersistenceError,
  KnowledgeSnapshotRepository,
} from '../intelligence/knowledge-layer/knowledgeSnapshotRepository'
import {
  deriveKnowledgeSnapshotKey,
  sealCanonicalKnowledgeDocument,
} from '../intelligence/knowledge-layer/knowledgeSealer'
import {
  validateKnowledgeCollection,
} from '../intelligence/knowledge-layer/knowledgeCollectionValidator'
import {
  isSupportedCanonicalizationVersion,
  isSupportedSnapshotVersion,
} from '../intelligence/financial-snapshot/snapshotProtocol'
import type {
  PersistedKnowledgeSnapshot,
} from '../types/persistedKnowledgeSnapshot'
import type {
  SealedSnapshotId,
  UtcInstant,
} from '../types/financialSnapshot'
import type {
  CanonicalKnowledgeDocument,
  KnowledgeBuilderVersion,
  KnowledgeCanonicalizationVersion,
  KnowledgeFactType,
  KnowledgeBuilderInput,
  KnowledgeProjectionVersion,
  KnowledgeRevisionReasonCode,
  KnowledgeRulesVersion,
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
} from '../types/knowledgeLayer'

const KNOWLEDGE_VERSION = 'knowledge/1.0.0' as KnowledgeVersion
const KNOWLEDGE_BUILDER_VERSION =
  'knowledge-builder/1.0.0' as KnowledgeBuilderVersion
const KNOWLEDGE_RULES_VERSION = 'knowledge-rules/1.0.0' as KnowledgeRulesVersion
const KNOWLEDGE_PROJECTION_VERSION =
  'knowledge-projection/1.0.0' as KnowledgeProjectionVersion
const KNOWLEDGE_CANONICALIZATION_VERSION =
  KNOWLEDGE_CANONICALIZATION_VERSION_V1 as KnowledgeCanonicalizationVersion

type BuilderEngineResult = {
  readonly balanceReport: {
    readonly hasData: boolean
    readonly generalBalance: number
    readonly netProfit: number
  }
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
}

type KnowledgeSourceSnapshot = KnowledgeBuilderInput<BuilderEngineResult>['snapshot']

const inFlight = new Map<string, Promise<KnowledgeShadowModeResult>>()

export interface KnowledgeShadowModeVersions {
  readonly knowledgeVersion: KnowledgeVersion
  readonly builderVersion: KnowledgeBuilderVersion
  readonly rulesVersion: KnowledgeRulesVersion
  readonly projectionVersion: KnowledgeProjectionVersion
  readonly canonicalizationVersion: KnowledgeCanonicalizationVersion
}

export const DEFAULT_KNOWLEDGE_SHADOW_VERSIONS: KnowledgeShadowModeVersions = {
  knowledgeVersion: KNOWLEDGE_VERSION,
  builderVersion: KNOWLEDGE_BUILDER_VERSION,
  rulesVersion: KNOWLEDGE_RULES_VERSION,
  projectionVersion: KNOWLEDGE_PROJECTION_VERSION,
  canonicalizationVersion: KNOWLEDGE_CANONICALIZATION_VERSION,
}

export interface KnowledgeShadowModeResult {
  readonly status: 'skipped' | 'observed' | 'failed'
  readonly sourceSnapshotId?: SealedSnapshotId
  readonly sourceSnapshotRevision?: number
  readonly knowledgeSnapshotId?: KnowledgeSnapshotId
  readonly knowledgeSnapshotKey?: KnowledgeSnapshotKey
  readonly revision?: number
  readonly idempotent?: boolean
  readonly fingerprintChanged?: boolean
  readonly factCount?: number
  readonly factTypes?: readonly KnowledgeFactType[]
  readonly addedFactTypes?: readonly KnowledgeFactType[]
  readonly removedFactTypes?: readonly KnowledgeFactType[]
  readonly reasonCode?: string
}

interface KnowledgeSnapshotRepositoryPort {
  persist(
    snapshot: Parameters<KnowledgeSnapshotRepository['persist']>[0],
    persistedAt: UtcInstant,
  ): ReturnType<KnowledgeSnapshotRepository['persist']>
  getLatestByKnowledgeSnapshotKey(
    knowledgeSnapshotKey: KnowledgeSnapshotKey,
  ): Promise<PersistedKnowledgeSnapshot>
}

export interface KnowledgeShadowModeInput {
  readonly sealedFinancialSnapshot: KnowledgeSourceSnapshot
  readonly versions: KnowledgeShadowModeVersions
  readonly sealedAt: UtcInstant
  readonly persistedAt: UtcInstant
  readonly revisionReasonCode: KnowledgeRevisionReasonCode
  readonly repository: KnowledgeSnapshotRepositoryPort
  readonly consumer: string
  readonly diagnosticScope: string
  readonly featureEnabled: boolean
}

export interface KnowledgeShadowModeOptions {
  readonly dev?: boolean
  readonly logger?: (message: string, details: Record<string, unknown>) => void
  readonly pipeline?: Partial<{
    build: typeof buildKnowledgeCollectionFromSnapshot
    validate: typeof validateKnowledgeCollection
    canonicalize: typeof canonicalizeValidatedKnowledgeCollection
    fingerprint: typeof fingerprintCanonicalKnowledgeDocument
    deriveKey: typeof deriveKnowledgeSnapshotKey
    seal: typeof sealCanonicalKnowledgeDocument
  }>
}

function truncate(value: string): string {
  if (value.length <= 24) return value
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function safeLatest(
  repository: KnowledgeSnapshotRepositoryPort,
  knowledgeSnapshotKey: KnowledgeSnapshotKey,
): Promise<PersistedKnowledgeSnapshot | undefined> {
  return repository.getLatestByKnowledgeSnapshotKey(knowledgeSnapshotKey).catch(() => undefined)
}

function factTypesOf(
  snapshot: Pick<PersistedKnowledgeSnapshot, 'canonicalDocument'>,
): readonly KnowledgeFactType[] {
  const facts = snapshot.canonicalDocument.payload.facts
  return [...new Set(facts.map((fact) => fact.factType))].sort() as readonly KnowledgeFactType[]
}

function diffFactTypes(
  previous: readonly KnowledgeFactType[],
  current: readonly KnowledgeFactType[],
): {
  readonly addedFactTypes: readonly KnowledgeFactType[]
  readonly removedFactTypes: readonly KnowledgeFactType[]
} {
  const previousSet = new Set(previous)
  const currentSet = new Set(current)

  return {
    addedFactTypes: current.filter((factType) => !previousSet.has(factType)),
    removedFactTypes: previous.filter((factType) => !currentSet.has(factType)),
  }
}

function assertSupportedVersions(versions: KnowledgeShadowModeVersions): void {
  if (
    versions.knowledgeVersion !== KNOWLEDGE_VERSION ||
    versions.builderVersion !== KNOWLEDGE_BUILDER_VERSION ||
    versions.rulesVersion !== KNOWLEDGE_RULES_VERSION ||
    versions.projectionVersion !== KNOWLEDGE_PROJECTION_VERSION ||
    versions.canonicalizationVersion !== KNOWLEDGE_CANONICALIZATION_VERSION
  ) {
    throw new Error('KNOWLEDGE_SHADOW_UNSUPPORTED_VERSION')
  }
}

function assertCompatibleSourceSnapshot(
  snapshot: KnowledgeSourceSnapshot,
): void {
  if (snapshot.status !== 'sealed') {
    throw new Error('KNOWLEDGE_SHADOW_INVALID_SOURCE_STATE')
  }
  if (!isSupportedSnapshotVersion(snapshot.snapshotVersion)) {
    throw new Error('KNOWLEDGE_SHADOW_UNSUPPORTED_SOURCE_VERSION')
  }
  if (!isSupportedCanonicalizationVersion(snapshot.canonicalizationVersion)) {
    throw new Error('KNOWLEDGE_SHADOW_UNSUPPORTED_SOURCE_CANONICALIZATION')
  }
  if (snapshot.scope.kind !== 'monthly') {
    throw new Error('KNOWLEDGE_SHADOW_UNSUPPORTED_SOURCE_SCOPE')
  }
}

function normalizeErrorCode(error: unknown): string {
  if (error instanceof KnowledgePersistenceError) {
    return error.code
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { readonly code?: unknown }).code === 'string'
  ) {
    return (error as { readonly code: string }).code
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }
  return 'KNOWLEDGE_SHADOW_UNKNOWN_FAILURE'
}

function buildSkippedResult(
  input: KnowledgeShadowModeInput,
  reasonCode: string,
): KnowledgeShadowModeResult {
  return {
    status: 'skipped',
    sourceSnapshotId: input.sealedFinancialSnapshot.identity.snapshotId,
    sourceSnapshotRevision: input.sealedFinancialSnapshot.revision.revision,
    reasonCode,
  }
}

function buildFailedResult(
  input: KnowledgeShadowModeInput,
  reasonCode: string,
): KnowledgeShadowModeResult {
  return {
    status: 'failed',
    sourceSnapshotId: input.sealedFinancialSnapshot.identity.snapshotId,
    sourceSnapshotRevision: input.sealedFinancialSnapshot.revision.revision,
    reasonCode,
  }
}

function observeResult(
  input: KnowledgeShadowModeInput,
  current: PersistedKnowledgeSnapshot,
  previous: PersistedKnowledgeSnapshot | undefined,
  idempotent: boolean,
): KnowledgeShadowModeResult {
  const currentFactTypes = factTypesOf(current)
  const previousFactTypes = previous === undefined ? [] : factTypesOf(previous)
  const { addedFactTypes, removedFactTypes } = diffFactTypes(
    previousFactTypes,
    currentFactTypes,
  )

  return {
    status: 'observed',
    sourceSnapshotId: input.sealedFinancialSnapshot.identity.snapshotId,
    sourceSnapshotRevision: input.sealedFinancialSnapshot.revision.revision,
    knowledgeSnapshotId: current.knowledgeSnapshotId,
    knowledgeSnapshotKey: current.knowledgeSnapshotKey,
    revision: current.revision,
    idempotent,
    fingerprintChanged: previous !== undefined && previous.fingerprintValue !== current.fingerprintValue,
    factCount: current.canonicalDocument.payload.factCount,
    factTypes: currentFactTypes,
    addedFactTypes,
    removedFactTypes,
  }
}

function logObservation(
  input: KnowledgeShadowModeInput,
  result: KnowledgeShadowModeResult,
  options: KnowledgeShadowModeOptions,
): void {
  if (!(options.dev ?? import.meta.env.DEV)) {
    return
  }

  const logger = options.logger ?? console.info
  logger('[knowledge-shadow] Observation', {
    consumer: input.consumer,
    diagnosticScope: input.diagnosticScope,
    sourceSnapshotId: truncate(input.sealedFinancialSnapshot.identity.snapshotId),
    knowledgeSnapshotKey:
      result.knowledgeSnapshotKey === undefined
        ? undefined
        : truncate(result.knowledgeSnapshotKey),
    revision: result.revision,
    idempotent: result.idempotent,
    fingerprintChanged: result.fingerprintChanged,
    factCount: result.factCount,
    factTypes: result.factTypes,
    versions: input.versions,
    reasonCode: result.reasonCode,
  })
}

function logFailure(
  input: KnowledgeShadowModeInput,
  reasonCode: string,
  options: KnowledgeShadowModeOptions,
): void {
  if (!(options.dev ?? import.meta.env.DEV)) {
    return
  }

  const logger = options.logger ?? console.warn
  logger('[knowledge-shadow] Execution failed', {
    consumer: input.consumer,
    diagnosticScope: input.diagnosticScope,
    sourceSnapshotId: truncate(input.sealedFinancialSnapshot.identity.snapshotId),
    sourceSnapshotRevision: input.sealedFinancialSnapshot.revision.revision,
    reasonCode,
  })
}

async function execute(
  input: KnowledgeShadowModeInput,
  options: KnowledgeShadowModeOptions,
): Promise<KnowledgeShadowModeResult> {
  if (!input.featureEnabled) {
    const result = buildSkippedResult(input, 'knowledge.shadow.disabled')
    logObservation(input, result, options)
    return result
  }

  assertSupportedVersions(input.versions)
  assertCompatibleSourceSnapshot(input.sealedFinancialSnapshot)

  const pipeline = {
    build: buildKnowledgeCollectionFromSnapshot,
    validate: validateKnowledgeCollection,
    canonicalize: canonicalizeValidatedKnowledgeCollection,
    fingerprint: fingerprintCanonicalKnowledgeDocument,
    deriveKey: deriveKnowledgeSnapshotKey,
    seal: sealCanonicalKnowledgeDocument,
    ...options.pipeline,
  }

  const draft = pipeline.build({
    snapshot: input.sealedFinancialSnapshot,
    knowledgeVersion: input.versions.knowledgeVersion,
    builderVersion: input.versions.builderVersion,
    rulesVersion: input.versions.rulesVersion,
    projectionVersion: input.versions.projectionVersion,
  })
  const validated = pipeline.validate(draft)
  const canonicalDocument = pipeline.canonicalize({
    ...validated,
    canonicalizationVersion: input.versions.canonicalizationVersion,
  } as typeof validated & {
    readonly canonicalizationVersion: KnowledgeCanonicalizationVersion
  }) as CanonicalKnowledgeDocument
  const fingerprint = await pipeline.fingerprint(canonicalDocument)
  const knowledgeSnapshotKey = pipeline.deriveKey(canonicalDocument)
  const previous = await safeLatest(input.repository, knowledgeSnapshotKey)

  if (previous?.fingerprintValue === fingerprint.value) {
    const result = observeResult(input, previous, previous, true)
    logObservation(input, result, options)
    return result
  }

  const sealed = await pipeline.seal({
    canonicalDocument,
    fingerprint,
    knowledgeSnapshotKey,
    revision: (previous?.revision ?? 0) + 1,
    revisionReasonCode: input.revisionReasonCode,
    sealedAt: input.sealedAt,
    ...(previous === undefined
      ? {}
      : { supersedesKnowledgeSnapshotId: previous.knowledgeSnapshotId }),
  })
  const persisted = await input.repository.persist(sealed, input.persistedAt)
  const result = observeResult(input, persisted.record, previous, persisted.idempotent)
  logObservation(input, result, options)
  return result
}

export function isKnowledgeShadowEnabled(): boolean {
  return import.meta.env.VITE_KNOWLEDGE_SHADOW_ENABLED === 'true'
}

export function runKnowledgeShadowMode(
  input: KnowledgeShadowModeInput,
  options: KnowledgeShadowModeOptions = {},
): Promise<KnowledgeShadowModeResult> {
  const dedupeKey = [
    input.sealedFinancialSnapshot.identity.snapshotId,
    input.versions.knowledgeVersion,
    input.versions.builderVersion,
    input.versions.rulesVersion,
    input.versions.projectionVersion,
    input.versions.canonicalizationVersion,
  ].join('|')
  const running = inFlight.get(dedupeKey)
  if (running !== undefined) {
    return running
  }

  const promise = execute(input, options)
    .catch((error) => {
      const reasonCode = normalizeErrorCode(error)
      logFailure(input, reasonCode, options)
      return buildFailedResult(input, reasonCode)
    })
    .finally(() => {
      inFlight.delete(dedupeKey)
    })

  inFlight.set(dedupeKey, promise)
  return promise
}

export type { KnowledgeBuilderError }
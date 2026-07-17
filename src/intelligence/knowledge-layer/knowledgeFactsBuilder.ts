import type { SealedFinancialSnapshot } from '../../types/financialSnapshot'
import type {
  DraftKnowledgeCollection,
  KnowledgeBuilderInput,
  KnowledgeBuilderVersion,
  KnowledgeCollectionId,
  KnowledgeFact,
  KnowledgeFactCategory,
  KnowledgeFactConfidence,
  KnowledgeFactId,
  KnowledgeFactSeverity,
  KnowledgeFactType,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeVersion,
} from '../../types/knowledgeLayer'

export type KnowledgeBuilderErrorCode =
  | 'KNOWLEDGE_BUILDER_INVALID_SNAPSHOT'
  | 'KNOWLEDGE_BUILDER_UNSUPPORTED_VERSION'
  | 'KNOWLEDGE_BUILDER_INVALID_ENGINE_RESULT'
  | 'KNOWLEDGE_BUILDER_DUPLICATE_FACT_ID'
  | 'KNOWLEDGE_BUILDER_INVALID_EVIDENCE'
  | 'KNOWLEDGE_BUILDER_INVALID_VALUE'

export class KnowledgeBuilderError extends Error {
  readonly code: KnowledgeBuilderErrorCode

  constructor(code: KnowledgeBuilderErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'KnowledgeBuilderError'
    this.code = code
  }
}

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

type InternalInput = KnowledgeBuilderInput<BuilderEngineResult>

const FACT_TYPE_CATEGORY: Record<KnowledgeFactType, KnowledgeFactCategory> = {
  'income.present': 'income',
  'income.absent': 'income',
  'income.increased': 'income',
  'income.decreased': 'income',
  'expense.present': 'expense',
  'expense.absent': 'expense',
  'expense.increased': 'expense',
  'expense.decreased': 'expense',
  'adjustment.present': 'adjustment',
  'adjustment.absent': 'adjustment',
  'balance.positive': 'balance',
  'balance.negative': 'balance',
  'balance.neutral': 'balance',
  'cashflow.positive': 'cashflow',
  'cashflow.negative': 'cashflow',
  'cashflow.neutral': 'cashflow',
  'period.empty': 'period',
  'period.non_empty': 'period',
  'season.started': 'season',
  'season.completed': 'season',
  'saving.high': 'saving',
  'saving.low': 'saving',
  'recurring.expense.detected': 'recurrence',
  'income.volatile': 'volatility',
  'expense.volatile': 'volatility',
  'cashflow.stable': 'cashflow',
  'cashflow.unstable': 'cashflow',
}

const INITIAL_FACT_ORDER: readonly KnowledgeFactType[] = [
  'adjustment.absent',
  'adjustment.present',
  'balance.negative',
  'balance.neutral',
  'balance.positive',
  'cashflow.negative',
  'cashflow.neutral',
  'cashflow.positive',
  'expense.absent',
  'expense.present',
  'income.absent',
  'income.present',
  'period.empty',
  'period.non_empty',
]

function assertNonEmptyVersion(value: string, code: KnowledgeBuilderErrorCode): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new KnowledgeBuilderError(code)
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function assertNoUnsupportedValue(value: unknown): void {
  if (value === null) {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_VALUE')
  }
  if (value instanceof Date) {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_VALUE')
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_VALUE')
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoUnsupportedValue(item)
    }
    return
  }
  if (value !== undefined && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      assertNoUnsupportedValue(child)
    }
  }
}

function assertSnapshot(input: InternalInput): void {
  const snapshot = input.snapshot
  if (snapshot.status !== 'sealed') {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_SNAPSHOT')
  }
  if (typeof snapshot.identity.snapshotId !== 'string' || snapshot.identity.snapshotId.trim() === '') {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_SNAPSHOT')
  }
  if (typeof snapshot.identity.snapshotKey !== 'string' || snapshot.identity.snapshotKey.trim() === '') {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_SNAPSHOT')
  }
  if (
    !snapshot.fingerprint ||
    typeof snapshot.fingerprint.value !== 'string' ||
    snapshot.fingerprint.value.trim() === ''
  ) {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_SNAPSHOT')
  }

  assertNoUnsupportedValue(snapshot.canonicalDocument.payload.engineResult)

  const engineResult = snapshot.canonicalDocument.payload.engineResult
  const report = engineResult?.balanceReport
  if (
    !report ||
    typeof report !== 'object' ||
    typeof report.hasData !== 'boolean' ||
    !isFiniteNumber(report.generalBalance) ||
    !isFiniteNumber(report.netProfit) ||
    !Number.isSafeInteger(engineResult.incomeCount) ||
    !Number.isSafeInteger(engineResult.expenseCount) ||
    !Number.isSafeInteger(engineResult.adjustmentCount)
  ) {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_ENGINE_RESULT')
  }

  if (!Array.isArray(snapshot.evidence.records) || !Array.isArray(snapshot.evidence.context)) {
    throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_INVALID_EVIDENCE')
  }
}

function buildFactId(
  knowledgeVersion: KnowledgeVersion,
  snapshotId: string,
  factType: KnowledgeFactType,
  ordinal: number,
): KnowledgeFactId {
  return (
    `knowledge-fact:${knowledgeVersion}:${snapshotId}:${factType}:${String(ordinal).padStart(4, '0')}`
  ) as KnowledgeFactId
}

function severityForFactType(factType: KnowledgeFactType): KnowledgeFactSeverity {
  if (factType === 'balance.negative' || factType === 'cashflow.negative') {
    return 'warning'
  }
  return 'info'
}

function confidenceForFactType(): KnowledgeFactConfidence {
  return 'certain'
}

function factsFromSnapshot(snapshot: InternalInput['snapshot']): readonly KnowledgeFactType[] {
  const engineResult = snapshot.canonicalDocument.payload.engineResult
  const balance = engineResult.balanceReport.generalBalance
  const cashflow = engineResult.balanceReport.netProfit
  const hasData = engineResult.balanceReport.hasData

  const facts: KnowledgeFactType[] = []

  facts.push(engineResult.incomeCount > 0 ? 'income.present' : 'income.absent')
  facts.push(engineResult.expenseCount > 0 ? 'expense.present' : 'expense.absent')
  facts.push(engineResult.adjustmentCount > 0 ? 'adjustment.present' : 'adjustment.absent')

  facts.push(
    balance > 0
      ? 'balance.positive'
      : balance < 0
        ? 'balance.negative'
        : 'balance.neutral',
  )

  facts.push(
    cashflow > 0
      ? 'cashflow.positive'
      : cashflow < 0
        ? 'cashflow.negative'
        : 'cashflow.neutral',
  )

  const nonEmpty = hasData ||
    engineResult.incomeCount > 0 ||
    engineResult.expenseCount > 0 ||
    engineResult.adjustmentCount > 0 ||
    snapshot.evidence.records.length > 0
  facts.push(nonEmpty ? 'period.non_empty' : 'period.empty')

  return facts
}

function stableSortFactTypes(factTypes: readonly KnowledgeFactType[]): readonly KnowledgeFactType[] {
  const orderByType = new Map<KnowledgeFactType, number>()
  INITIAL_FACT_ORDER.forEach((factType, index) => {
    orderByType.set(factType, index)
  })

  return [...factTypes].sort((a, b) => {
    const categoryDiff = FACT_TYPE_CATEGORY[a].localeCompare(FACT_TYPE_CATEGORY[b])
    if (categoryDiff !== 0) return categoryDiff

    const orderA = orderByType.get(a) ?? Number.MAX_SAFE_INTEGER
    const orderB = orderByType.get(b) ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB

    return a.localeCompare(b)
  })
}

function buildFact(
  input: InternalInput,
  factType: KnowledgeFactType,
  ordinal: number,
): KnowledgeFact {
  const { snapshot, knowledgeVersion } = input
  const sourceRecordIds = snapshot.evidence.records
    .map((record) => record.sourceId)
    .filter((sourceId): sourceId is string | number => sourceId !== undefined)

  return {
    factId: buildFactId(
      knowledgeVersion,
      snapshot.identity.snapshotId,
      factType,
      ordinal,
    ),
    factType,
    category: FACT_TYPE_CATEGORY[factType],
    severity: severityForFactType(factType),
    confidence: confidenceForFactType(),
    source: 'financial-snapshot',
    status: 'projected',
    scope: {
      kind: snapshot.scope.kind,
      periodStart: snapshot.scope.periodStart,
      periodEndExclusive: snapshot.scope.periodEndExclusive,
      periodBoundary: snapshot.scope.periodBoundary,
      timezone: snapshot.scope.timezone,
      usageMode: snapshot.scope.usageMode,
      currency: snapshot.scope.currency,
      ...(snapshot.scope.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: snapshot.scope.earningPeriodId }),
    },
    context: {
      usageMode: snapshot.scope.usageMode,
      currency: snapshot.scope.currency,
      timezone: snapshot.scope.timezone,
      periodStart: snapshot.scope.periodStart,
      periodEndExclusive: snapshot.scope.periodEndExclusive,
      ...(snapshot.scope.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: snapshot.scope.earningPeriodId }),
    },
    origin: {
      source: 'financial-snapshot',
      sourceSnapshotId: snapshot.identity.snapshotId,
      sourceSnapshotKey: snapshot.identity.snapshotKey,
      sourceSnapshotRevision: snapshot.revision.revision,
      sourceSnapshotVersion: snapshot.snapshotVersion,
      sourceCanonicalizationVersion: snapshot.canonicalizationVersion,
      sourceEngineVersion: snapshot.engineVersion,
      sourceRulesetVersion: snapshot.rulesetVersion,
    },
    evidence: {
      sourceSnapshotId: snapshot.identity.snapshotId,
      sourceSnapshotKey: snapshot.identity.snapshotKey,
      sourceSnapshotRevision: snapshot.revision.revision,
      sourceFingerprintValue: snapshot.fingerprint.value,
      sourceAppliedRuleIds: snapshot.appliedRules.map((rule) => rule.ruleId),
      sourceRecordIds,
      sourceContextKinds: snapshot.evidence.context.map((context) => context.kind),
      coverageCodes: [...snapshot.evidence.coverageCodes],
      warningCodes: [...snapshot.evidence.warningCodes],
      sourcePaths: [
        'canonicalDocument.payload.engineResult',
        'evidence',
        'scope',
        'appliedRules',
        'metadata',
      ],
    },
    relationships: [],
  }
}

function assertUniqueFactIds(facts: readonly KnowledgeFact[]): void {
  const seen = new Set<string>()
  for (const fact of facts) {
    if (seen.has(fact.factId)) {
      throw new KnowledgeBuilderError('KNOWLEDGE_BUILDER_DUPLICATE_FACT_ID')
    }
    seen.add(fact.factId)
  }
}

export function buildKnowledgeCollectionFromSnapshot(
  input: KnowledgeBuilderInput<BuilderEngineResult>,
): DraftKnowledgeCollection {
  assertNonEmptyVersion(input.knowledgeVersion, 'KNOWLEDGE_BUILDER_UNSUPPORTED_VERSION')
  assertNonEmptyVersion(input.builderVersion, 'KNOWLEDGE_BUILDER_UNSUPPORTED_VERSION')
  assertNonEmptyVersion(input.rulesVersion, 'KNOWLEDGE_BUILDER_UNSUPPORTED_VERSION')
  assertNonEmptyVersion(input.projectionVersion, 'KNOWLEDGE_BUILDER_UNSUPPORTED_VERSION')
  assertSnapshot(input)

  const factTypes = stableSortFactTypes(factsFromSnapshot(input.snapshot))
  const facts = factTypes.map((factType, ordinal) => buildFact(input, factType, ordinal))

  assertUniqueFactIds(facts)

  return {
    state: 'draft',
    identity: {
      knowledgeCollectionId: (
        `knowledge-collection:${input.knowledgeVersion}:${input.snapshot.identity.snapshotId}`
      ) as KnowledgeCollectionId,
      sourceSnapshotId: input.snapshot.identity.snapshotId,
      sourceSnapshotKey: input.snapshot.identity.snapshotKey,
      sourceSnapshotRevision: input.snapshot.revision.revision,
      sourceFingerprintValue: input.snapshot.fingerprint.value,
    },
    versions: {
      knowledgeVersion: input.knowledgeVersion,
      builderVersion: input.builderVersion,
      rulesVersion: input.rulesVersion,
      projectionVersion: input.projectionVersion,
    },
    facts,
    relationships: [],
    factCount: facts.length,
  }
}

export type {
  KnowledgeBuilderVersion,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeVersion,
  SealedFinancialSnapshot,
}

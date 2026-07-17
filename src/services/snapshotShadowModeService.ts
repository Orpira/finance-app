import { FinancialSnapshotRepository } from '../intelligence/financial-snapshot/financialSnapshotRepository'
import {
  materializeScopeFromCanonicalDocument,
} from '../intelligence/financial-snapshot/snapshotProtocol'
import { buildSnapshotCandidate } from '../intelligence/financial-snapshot/snapshotBuilder'
import { validateSnapshotCandidate } from '../intelligence/financial-snapshot/snapshotCandidateValidator'
import { canonicalizeValidatedSnapshotCandidate } from '../intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../intelligence/financial-snapshot/snapshotSealer'
import {
  auditCanonicalSnapshotMaterialDiff,
  type SnapshotMaterialDiffAudit,
} from '../intelligence/financial-snapshot/snapshotMaterialDiffAuditor'
import {
  DEFAULT_SNAPSHOT_CANONICALIZATION_VERSION,
  isCanonicalizationVersionV2,
  SUPPORTED_SNAPSHOT_VERSION,
} from '../intelligence/financial-snapshot/snapshotProtocol'
import { KnowledgeSnapshotRepository } from '../intelligence/knowledge-layer/knowledgeSnapshotRepository'
import {
  DEFAULT_KNOWLEDGE_SHADOW_VERSIONS,
  isKnowledgeShadowEnabled,
  runKnowledgeShadowMode,
  type KnowledgeShadowModeInput,
  type KnowledgeShadowModeOptions,
  type KnowledgeShadowModeResult,
  type KnowledgeShadowModeVersions,
} from './knowledgeShadowModeService'
import type { FinancialEngineResult } from './financialEngineAdapter'
import type { Expense } from '../types/expense'
import type { PersistedFinancialSnapshot } from '../types/persistedFinancialSnapshot'
import type { ServiceIncome } from '../types/service'
import type {
  AppliedRule,
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  FinancialEvidence,
  FinancialEvidenceRecord,
  IanaTimeZone,
  RulesetVersion,
  SnapshotCandidateId,
  SnapshotKey,
  SnapshotNormativeCode,
  SnapshotScope,
  SnapshotVersion,
  UtcInstant,
} from '../types/financialSnapshot'
import type { CurrencyCode, UsageMode } from '../types/settings'
import { getIncomeType, isAdjustmentIncome } from '../utils/incomeTypes'

const SNAPSHOT_VERSION = SUPPORTED_SNAPSHOT_VERSION as SnapshotVersion
const CANONICALIZATION_VERSION =
  DEFAULT_SNAPSHOT_CANONICALIZATION_VERSION as CanonicalizationVersion

export interface SnapshotShadowModeInput {
  readonly consumer: 'home.balance.current-month'
  readonly scope: {
    readonly periodStart: CivilDate
    readonly periodEndExclusive: CivilDate
    readonly asOf: UtcInstant
    readonly timezone: IanaTimeZone
    readonly usageMode: UsageMode
    readonly currency: CurrencyCode
    readonly earningPeriodId?: number
  }
  readonly financialEngineResult: FinancialEngineResult
  readonly incomes: readonly ServiceIncome[]
  readonly expenses: readonly Expense[]
  readonly candidateId: SnapshotCandidateId
  readonly generatedAt: UtcInstant
  readonly sealedAt: UtcInstant
  readonly persistedAt: UtcInstant
  readonly revisionReasonCode: SnapshotNormativeCode
}

export interface SnapshotShadowModeObservation {
  readonly consumer: SnapshotShadowModeInput['consumer']
  readonly snapshotKey: SnapshotKey
  readonly revision: number
  readonly idempotent: boolean
  readonly fingerprintChanged: boolean
  readonly divergentFields: readonly string[]
  readonly engineVersion: string
  readonly rulesetVersion: string
  readonly counts: {
    readonly incomes: number
    readonly expenses: number
    readonly adjustments: number
  }
  readonly warningCodes: readonly string[]
  readonly qualityCodes: readonly string[]
  readonly materialDiffAudit?: SnapshotMaterialDiffAudit
}

interface SnapshotRepositoryPort {
  persist(
    snapshot: Parameters<FinancialSnapshotRepository['persist']>[0],
    persistedAt: UtcInstant,
  ): Promise<PersistedFinancialSnapshot>
  getLatestBySnapshotKey(snapshotKey: SnapshotKey): Promise<PersistedFinancialSnapshot>
}

export interface SnapshotShadowModeOptions {
  readonly enabled?: boolean
  readonly dev?: boolean
  readonly logger?: (message: string, details: Record<string, unknown>) => void
  readonly repository?: SnapshotRepositoryPort
  readonly knowledgeShadow?: Partial<{
    enabled: boolean
    repository: ConstructorParameters<typeof KnowledgeSnapshotRepository>[0]
    versions: KnowledgeShadowModeVersions
    runner: typeof runKnowledgeShadowMode
    options: KnowledgeShadowModeOptions
  }>
  readonly pipeline?: Partial<{
    build: typeof buildSnapshotCandidate
    validate: typeof validateSnapshotCandidate
    canonicalize: typeof canonicalizeValidatedSnapshotCandidate
    fingerprint: typeof fingerprintCanonicalSnapshotDocument
    seal: typeof sealCanonicalSnapshot
    compare: typeof comparisonFields
    audit: typeof auditCanonicalSnapshotMaterialDiff
  }>
}

const inFlight = new Map<string, Promise<SnapshotShadowModeObservation | undefined>>()

function code(value: string): SnapshotNormativeCode {
  return value as SnapshotNormativeCode
}

function recordIdentity(record: ServiceIncome | Expense) {
  return record.id === undefined
    ? { identityKind: 'legacy-material' as const }
    : { identityKind: 'persisted-id' as const, sourceId: record.id }
}

function incomeEvidence(income: ServiceIncome): FinancialEvidenceRecord {
  const common = {
    ...recordIdentity(income),
    disposition: 'included' as const,
    logicalDate: income.date as CivilDate,
  }
  const fields = {
    resolvedType: getIncomeType(income),
    ...(income.usageMode === undefined ? {} : { usageMode: income.usageMode }),
    ...(income.earningPeriodId === undefined ? {} : { earningPeriodId: income.earningPeriodId }),
    ...(income.seasonPeriodId === undefined ? {} : { seasonPeriodId: income.seasonPeriodId }),
    duration: income.duration,
    ...(income.actualDuration === undefined ? {} : { actualDuration: income.actualDuration }),
    currency: income.currency,
    ...(income.baseCurrency === undefined ? {} : { baseCurrency: income.baseCurrency }),
    ...(income.baseCurrencyValue === undefined ? {} : { baseCurrencyValue: income.baseCurrencyValue }),
    ...(income.secondaryCurrency === undefined ? {} : { secondaryCurrency: income.secondaryCurrency }),
    ...(income.secondaryCurrencyValue === undefined ? {} : { secondaryCurrencyValue: income.secondaryCurrencyValue }),
    eurValue: income.eurValue,
    copValue: income.copValue,
  }
  return isAdjustmentIncome(income)
    ? { ...common, kind: 'income-adjustment', fields: { ...fields, resolvedType: 'ajuste' } }
    : { ...common, kind: 'income', fields: { ...fields, resolvedType: fields.resolvedType === 'ajuste' ? 'otro' : fields.resolvedType } }
}

function expenseEvidence(expense: Expense): FinancialEvidenceRecord {
  const common = {
    ...recordIdentity(expense),
    disposition: 'included' as const,
    logicalDate: expense.date as CivilDate,
  }
  const fields = {
    type: expense.type,
    ...(expense.usageMode === undefined ? {} : { usageMode: expense.usageMode }),
    ...(expense.earningPeriodId === undefined ? {} : { earningPeriodId: expense.earningPeriodId }),
    ...(expense.seasonPeriodId === undefined ? {} : { seasonPeriodId: expense.seasonPeriodId }),
    currency: expense.currency,
    ...(expense.baseCurrency === undefined ? {} : { baseCurrency: expense.baseCurrency }),
    ...(expense.baseCurrencyValue === undefined ? {} : { baseCurrencyValue: expense.baseCurrencyValue }),
    ...(expense.secondaryCurrency === undefined ? {} : { secondaryCurrency: expense.secondaryCurrency }),
    ...(expense.secondaryCurrencyValue === undefined ? {} : { secondaryCurrencyValue: expense.secondaryCurrencyValue }),
    eurValue: expense.eurValue,
    copValue: expense.copValue,
  }
  return expense.type === 'ajuste'
    ? { ...common, kind: 'expense-adjustment', fields: { ...fields, type: 'ajuste' } }
    : { ...common, kind: 'expense', fields: { ...fields, type: 'gasto' } }
}

function buildEvidence(input: SnapshotShadowModeInput): FinancialEvidence {
  const records = [
    ...input.incomes.map(incomeEvidence),
    ...input.expenses.map(expenseEvidence),
  ]
  const warningCodes = [
    ...(records.some((record) => record.identityKind === 'legacy-material')
      ? [code('legacy.id.unavailable')]
      : []),
    ...(input.incomes.some((record) => record.usageMode === undefined) ||
    input.expenses.some((record) => record.usageMode === undefined)
      ? [code('legacy.usage_mode.inferred')]
      : []),
  ]
  return {
    strategy: 'embedded-v1',
    records,
    context: [
      {
        kind: 'settings-context',
        usageMode: input.scope.usageMode,
        currency: input.scope.currency,
        timezone: input.scope.timezone,
      },
      ...(input.scope.earningPeriodId === undefined
        ? []
        : [{ kind: 'earning-period-context' as const, earningPeriodId: input.scope.earningPeriodId }]),
    ],
    candidateRecordCount: records.length,
    includedRecordCount: records.length,
    excludedRecordCount: 0,
    coverageCodes: [code(records.length === 0 ? 'coverage.empty_dataset' : 'coverage.complete')],
    warningCodes,
  }
}

function appliedRules(result: FinancialEngineResult): readonly AppliedRule[] {
  const engineVersion = result.engineVersion as EngineVersion
  const rulesetVersion = `engine-bundled/${result.engineVersion}` as RulesetVersion
  return result.appliedRules.map((ruleId, order) => ({
    ruleId,
    order,
    engineVersion,
    rulesetVersion,
    explanationCode: code(`rule.${ruleId}`),
    affectedFields: [],
    limitationCodes: [code('rule.version.unavailable')],
    warningCodes: [],
  }))
}

function safeLatest(
  repository: SnapshotRepositoryPort,
  snapshotKey: SnapshotKey,
): Promise<PersistedFinancialSnapshot | undefined> {
  return repository.getLatestBySnapshotKey(snapshotKey).catch(() => undefined)
}

function comparisonFields(
  previous: PersistedFinancialSnapshot | undefined,
  current: PersistedFinancialSnapshot,
): string[] {
  if (previous === undefined) return []
  const before = previous.canonicalDocument.payload.engineResult as FinancialEngineResult | undefined
  const after = current.canonicalDocument.payload.engineResult as FinancialEngineResult | undefined
  const fields: Array<[string, unknown, unknown]> = [
    ['snapshotId', previous.snapshotId, current.snapshotId],
    ['fingerprint', previous.fingerprintValue, current.fingerprintValue],
    ['revision', previous.revision, current.revision],
    ['engineVersion', previous.engineVersion, current.engineVersion],
    ['rulesetVersion', previous.rulesetVersion, current.rulesetVersion],
    ['snapshotVersion', previous.snapshotVersion, current.snapshotVersion],
    ['canonicalizationVersion', previous.canonicalizationVersion, current.canonicalizationVersion],
    ['incomeCount', before?.incomeCount, after?.incomeCount],
    ['expenseCount', before?.expenseCount, after?.expenseCount],
    ['adjustmentCount', before?.adjustmentCount, after?.adjustmentCount],
    ['generalBalance', before?.balanceReport.generalBalance, after?.balanceReport.generalBalance],
    ['incomeGrossTotal', before?.balanceReport.incomeGrossTotal, after?.balanceReport.incomeGrossTotal],
    ['expenseTotal', before?.balanceReport.expenseTotal, after?.balanceReport.expenseTotal],
    ['scheduledMinutes', before?.scheduledMinutes, after?.scheduledMinutes],
    ['actualMinutes', before?.actualMinutes, after?.actualMinutes],
    ['warningCodes', JSON.stringify(previous.canonicalDocument.payload.metadata.warningCodes), JSON.stringify(current.canonicalDocument.payload.metadata.warningCodes)],
    ['qualityCodes', JSON.stringify(previous.canonicalDocument.payload.metadata.qualityCodes), JSON.stringify(current.canonicalDocument.payload.metadata.qualityCodes)],
  ]
  return fields.filter(([, first, second]) => first !== second).map(([name]) => name)
}

function safeSnapshotKey(snapshotKey: SnapshotKey): string {
  const value = String(snapshotKey)
  if (value.length <= 48) return value
  return `${value.slice(0, 24)}...${value.slice(-12)}`
}

function toSealedSnapshot(
  persisted: PersistedFinancialSnapshot<unknown>,
): KnowledgeShadowModeInput['sealedFinancialSnapshot'] {
  return {
    identity: {
      snapshotId: persisted.snapshotId,
      snapshotKey: persisted.snapshotKey,
    },
    revision: {
      revision: persisted.revision,
    },
    status: 'sealed',
    canonicalDocument: structuredClone(persisted.canonicalDocument) as KnowledgeShadowModeInput['sealedFinancialSnapshot']['canonicalDocument'],
    fingerprint: { ...persisted.fingerprint },
    snapshotVersion: persisted.snapshotVersion,
    canonicalizationVersion: persisted.canonicalizationVersion,
    engineVersion: persisted.engineVersion,
    rulesetVersion: persisted.rulesetVersion,
    scope: materializeScopeFromCanonicalDocument(
      persisted.canonicalDocument,
    ) as KnowledgeShadowModeInput['sealedFinancialSnapshot']['scope'],
    evidence: structuredClone(persisted.canonicalDocument.payload.evidence),
    appliedRules: structuredClone(persisted.canonicalDocument.payload.appliedRules),
  }
}

async function observeKnowledgeShadow(
  input: SnapshotShadowModeInput,
  snapshot: KnowledgeShadowModeInput['sealedFinancialSnapshot'],
  options: SnapshotShadowModeOptions,
): Promise<KnowledgeShadowModeResult | undefined> {
  const runner = options.knowledgeShadow?.runner ?? runKnowledgeShadowMode
  try {
    return await runner(
      {
        sealedFinancialSnapshot: snapshot,
        versions: options.knowledgeShadow?.versions ?? DEFAULT_KNOWLEDGE_SHADOW_VERSIONS,
        sealedAt: input.sealedAt,
        persistedAt: input.persistedAt,
        revisionReasonCode: input.revisionReasonCode as unknown as KnowledgeShadowModeInput['revisionReasonCode'],
        repository:
          options.knowledgeShadow?.repository === undefined
            ? new KnowledgeSnapshotRepository()
            : new KnowledgeSnapshotRepository(options.knowledgeShadow.repository),
        consumer: input.consumer,
        diagnosticScope: `${input.scope.periodStart}:${input.scope.periodEndExclusive}:${input.scope.usageMode}:${input.scope.currency}`,
        featureEnabled: options.knowledgeShadow?.enabled ?? isKnowledgeShadowEnabled(),
      },
      {
        dev: options.knowledgeShadow?.options?.dev ?? options.dev,
        logger: options.knowledgeShadow?.options?.logger ?? options.logger,
        pipeline: options.knowledgeShadow?.options?.pipeline,
      },
    )
  } catch {
    return undefined
  }
}

async function execute(
  input: SnapshotShadowModeInput,
  options: SnapshotShadowModeOptions,
): Promise<SnapshotShadowModeObservation> {
  const repository = options.repository ?? new FinancialSnapshotRepository()
  const pipeline = {
    build: buildSnapshotCandidate,
    validate: validateSnapshotCandidate,
    canonicalize: canonicalizeValidatedSnapshotCandidate,
    fingerprint: fingerprintCanonicalSnapshotDocument,
    seal: sealCanonicalSnapshot,
    compare: comparisonFields,
    audit: auditCanonicalSnapshotMaterialDiff,
    ...options.pipeline,
  }
  const developmentMode = options.dev ?? import.meta.env.DEV
  const evidence = buildEvidence(input)
  const engineVersion = input.financialEngineResult.engineVersion as EngineVersion
  const rulesetVersion = `engine-bundled/${engineVersion}` as RulesetVersion
  const scope: SnapshotScope = {
    kind: 'monthly',
    periodStart: input.scope.periodStart,
    periodEndExclusive: input.scope.periodEndExclusive,
    periodBoundary: '[start,end)',
    asOf: input.scope.asOf,
    timezone: input.scope.timezone,
    usageMode: input.scope.usageMode,
    currency: input.scope.currency,
    ...(input.scope.earningPeriodId === undefined ? {} : { earningPeriodId: input.scope.earningPeriodId }),
    filters: {},
  }
  const draft = pipeline.build({
    candidateIdentity: { candidateId: input.candidateId },
    scope,
    financialEngineResult: input.financialEngineResult,
    evidence,
    appliedRules: appliedRules(input.financialEngineResult),
    snapshotVersion: SNAPSHOT_VERSION,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    engineVersion,
    rulesetVersion,
    metadata: {
      generatedAt: input.generatedAt,
      generationReasonCode: code('generation.shadow_evaluation'),
      provenance: 'local',
      qualityCodes: [
        code('quality.validated_structure'),
        code('quality.readonly_input'),
        code('quality.engine_result_preserved'),
        code('quality.embedded_evidence_complete'),
      ],
      warningCodes: evidence.warningCodes,
      limitationCodes: [code('rule.version.unavailable')],
    },
  })
  const canonicalDocument = pipeline.canonicalize(
    pipeline.validate(draft),
  )
  const fingerprint = await pipeline.fingerprint(canonicalDocument)
  const snapshotKey = deriveSnapshotKey(canonicalDocument)
  const previous = await safeLatest(repository, snapshotKey)
  let materialDiffAudit: SnapshotMaterialDiffAudit | undefined

  if (
    developmentMode &&
    previous !== undefined &&
    isCanonicalizationVersionV2(previous.canonicalizationVersion) &&
    isCanonicalizationVersionV2(canonicalDocument.canonicalizationVersion)
  ) {
    materialDiffAudit = pipeline.audit(previous.canonicalDocument, canonicalDocument)
    const logger = options.logger ?? console.info
    logger('[financial-snapshot] Material diff audit', {
      consumer: input.consumer,
      snapshotKey: safeSnapshotKey(snapshotKey),
      previousRevision: previous.revision,
      equivalent: materialDiffAudit.equivalent,
      diffCount: materialDiffAudit.changedPaths.length,
      summaryCodes: materialDiffAudit.summaryCodes,
      changedPaths: materialDiffAudit.changedPaths,
    })
  }

  if (previous?.fingerprintValue === fingerprint.value) {
    await observeKnowledgeShadow(input, toSealedSnapshot(previous), options)
    return {
      consumer: input.consumer,
      snapshotKey,
      revision: previous.revision,
      idempotent: true,
      fingerprintChanged: false,
      divergentFields: [],
      engineVersion,
      rulesetVersion,
      counts: {
        incomes: input.financialEngineResult.incomeCount,
        expenses: input.financialEngineResult.expenseCount,
        adjustments: input.financialEngineResult.adjustmentCount,
      },
      warningCodes: evidence.warningCodes,
      qualityCodes: canonicalDocument.payload.metadata.qualityCodes,
      ...(materialDiffAudit === undefined ? {} : { materialDiffAudit }),
    }
  }

  const sealed = await pipeline.seal({
    canonicalDocument,
    fingerprint,
    snapshotKey,
    revision: (previous?.revision ?? 0) + 1,
    revisionReasonCode: input.revisionReasonCode,
    sealedAt: input.sealedAt,
    ...(previous === undefined ? {} : { supersedesSnapshotId: previous.snapshotId }),
  })
  const persisted = await repository.persist(sealed, input.persistedAt)
  await observeKnowledgeShadow(input, toSealedSnapshot(persisted), options)
  return {
    consumer: input.consumer,
    snapshotKey,
    revision: persisted.revision,
    idempotent: false,
    fingerprintChanged: previous !== undefined,
    divergentFields: pipeline.compare(previous, persisted),
    engineVersion,
    rulesetVersion,
    counts: {
      incomes: input.financialEngineResult.incomeCount,
      expenses: input.financialEngineResult.expenseCount,
      adjustments: input.financialEngineResult.adjustmentCount,
    },
    warningCodes: evidence.warningCodes,
    qualityCodes: canonicalDocument.payload.metadata.qualityCodes,
    ...(materialDiffAudit === undefined ? {} : { materialDiffAudit }),
  }
}

/** Runs the complete local pipeline without making Snapshot an official result. */
export function runSnapshotShadowMode(
  input: SnapshotShadowModeInput,
  options: SnapshotShadowModeOptions = {},
): Promise<SnapshotShadowModeObservation | undefined> {
  const enabled = options.enabled ??
    import.meta.env.VITE_FINANCIAL_SNAPSHOT_SHADOW_ENABLED === 'true'
  if (!enabled) return Promise.resolve(undefined)

  const dedupeKey = [
    input.consumer,
    input.scope.periodStart,
    input.scope.periodEndExclusive,
    input.scope.usageMode,
    input.scope.currency,
    input.scope.earningPeriodId ?? '',
    JSON.stringify(input.financialEngineResult),
  ].join('|')
  const running = inFlight.get(dedupeKey)
  if (running !== undefined) return running

  const promise = execute(input, options)
    .then((observation) => {
      if (options.dev ?? import.meta.env.DEV) {
        const logger = options.logger ?? console.info
        logger('[financial-snapshot] Shadow observation', { ...observation })
      }
      return observation
    })
    .catch(() => {
      if (options.dev ?? import.meta.env.DEV) {
        const logger = options.logger ?? console.warn
        logger('[financial-snapshot] Shadow execution failed', {
          consumer: input.consumer,
          scopeKind: 'monthly',
          usageMode: input.scope.usageMode,
          currency: input.scope.currency,
          incomeCount: input.incomes.length,
          expenseCount: input.expenses.length,
        })
      }
      return undefined
    })
    .finally(() => inFlight.delete(dedupeKey))
  inFlight.set(dedupeKey, promise)
  return promise
}

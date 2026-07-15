import type { CurrencyCode, UsageMode } from './settings'

declare const civilDateBrand: unique symbol
declare const utcInstantBrand: unique symbol
declare const ianaTimeZoneBrand: unique symbol
declare const snapshotVersionBrand: unique symbol
declare const canonicalizationVersionBrand: unique symbol
declare const engineVersionBrand: unique symbol
declare const rulesetVersionBrand: unique symbol
declare const executionIdBrand: unique symbol
declare const candidateIdBrand: unique symbol
declare const snapshotIdBrand: unique symbol
declare const snapshotKeyBrand: unique symbol
declare const normativeCodeBrand: unique symbol

/** Calendar date serialized as YYYY-MM-DD. */
export type CivilDate = string & { readonly [civilDateBrand]: 'CivilDate' }

/** UTC instant serialized as RFC 3339 with milliseconds. */
export type UtcInstant = string & { readonly [utcInstantBrand]: 'UtcInstant' }

/** Case-sensitive IANA timezone identifier. */
export type IanaTimeZone = string & { readonly [ianaTimeZoneBrand]: 'IanaTimeZone' }

export type SnapshotVersion = string & {
  readonly [snapshotVersionBrand]: 'SnapshotVersion'
}

export type CanonicalizationVersion = string & {
  readonly [canonicalizationVersionBrand]: 'CanonicalizationVersion'
}

export type EngineVersion = string & {
  readonly [engineVersionBrand]: 'EngineVersion'
}

export type RulesetVersion = string & {
  readonly [rulesetVersionBrand]: 'RulesetVersion'
}

export type SnapshotBuildExecutionId = string & {
  readonly [executionIdBrand]: 'SnapshotBuildExecutionId'
}

export type SnapshotCandidateId = string & {
  readonly [candidateIdBrand]: 'SnapshotCandidateId'
}

export type SealedSnapshotId = string & {
  readonly [snapshotIdBrand]: 'SealedSnapshotId'
}

export type SnapshotKey = string & {
  readonly [snapshotKeyBrand]: 'SnapshotKey'
}

export type SnapshotNormativeCode = string & {
  readonly [normativeCodeBrand]: 'SnapshotNormativeCode'
}

export type SnapshotJsonPrimitive = string | number | boolean

export type SnapshotJsonValue =
  | SnapshotJsonPrimitive
  | SnapshotJsonObject
  | readonly SnapshotJsonValue[]

export interface SnapshotJsonObject {
  readonly [key: string]: SnapshotJsonValue
}

export type SnapshotScopeKind =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'season'
  | 'year'
  | 'custom'

/** Financial interval with an inclusive start and exclusive end. */
export interface SnapshotScope {
  readonly kind: SnapshotScopeKind
  readonly periodStart: CivilDate
  readonly periodEndExclusive: CivilDate
  readonly periodBoundary: '[start,end)'
  readonly asOf: UtcInstant
  readonly timezone: IanaTimeZone
  readonly usageMode: UsageMode
  readonly currency: CurrencyCode
  readonly earningPeriodId?: number
  readonly filters: SnapshotJsonObject
}

export interface SnapshotCandidateIdentity {
  readonly candidateId: SnapshotCandidateId
}

export interface SealedSnapshotIdentity {
  readonly snapshotId: SealedSnapshotId
  readonly snapshotKey: SnapshotKey
}

export interface SnapshotRevision {
  readonly revision: number
  readonly supersedesSnapshotId?: SealedSnapshotId
  readonly reasonCode: SnapshotNormativeCode
}

export interface SnapshotFingerprint {
  readonly value: string
  readonly algorithm: 'SHA-256'
  readonly encoding: 'hex-lower'
  readonly domain: string
  readonly fingerprintVersion: string
  readonly canonicalizationVersion: CanonicalizationVersion
  readonly hashedComponent?: 'material-payload'
}

export interface AppliedRule {
  readonly ruleId: string
  /** Zero-based contiguous position emitted by Financial Engine. */
  readonly order: number
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
  readonly explanationCode: SnapshotNormativeCode
  readonly affectedFields: readonly string[]
  readonly limitationCodes: readonly SnapshotNormativeCode[]
  readonly warningCodes: readonly SnapshotNormativeCode[]
}

export type FinancialEvidenceDisposition =
  | {
      readonly disposition: 'included'
    }
  | {
      readonly disposition: 'excluded'
      readonly exclusionCode: SnapshotNormativeCode
    }

export interface FinancialEvidenceIdentity {
  readonly sourceId?: string | number
  readonly identityKind: 'persisted-id' | 'legacy-material'
  readonly logicalDate: CivilDate
}

export interface IncomeFinancialEvidenceFields {
  readonly resolvedType: 'ingreso' | 'otro'
  readonly usageMode?: UsageMode
  readonly earningPeriodId?: number
  readonly seasonPeriodId?: number
  readonly duration: number
  readonly actualDuration?: number
  readonly currency: string
  readonly baseCurrency?: string
  readonly baseCurrencyValue?: number
  readonly secondaryCurrency?: string
  readonly secondaryCurrencyValue?: number
  readonly eurValue: number
  readonly copValue: number
}

/** Minimal embedded material evidence for a non-adjustment income. */
export type IncomeFinancialEvidenceRecord = FinancialEvidenceIdentity &
  FinancialEvidenceDisposition & {
    readonly kind: 'income'
    readonly fields: IncomeFinancialEvidenceFields
  }

export interface IncomeAdjustmentEvidenceFields {
  readonly resolvedType: 'ajuste'
  readonly usageMode?: UsageMode
  readonly earningPeriodId?: number
  readonly seasonPeriodId?: number
  readonly duration: number
  readonly actualDuration?: number
  readonly currency: string
  readonly baseCurrency?: string
  readonly baseCurrencyValue?: number
  readonly secondaryCurrency?: string
  readonly secondaryCurrencyValue?: number
  readonly eurValue: number
  readonly copValue: number
  readonly effectiveFinancialLabel?: string
}

/** Income-origin adjustment; it remains distinct from ordinary income. */
export type IncomeAdjustmentEvidenceRecord = FinancialEvidenceIdentity &
  FinancialEvidenceDisposition & {
    readonly kind: 'income-adjustment'
    readonly fields: IncomeAdjustmentEvidenceFields
  }

export interface ExpenseFinancialEvidenceFields {
  readonly type: 'gasto'
  readonly usageMode?: UsageMode
  readonly earningPeriodId?: number
  readonly seasonPeriodId?: number
  readonly currency: string
  readonly baseCurrency?: string
  readonly baseCurrencyValue?: number
  readonly secondaryCurrency?: string
  readonly secondaryCurrencyValue?: number
  readonly eurValue: number
  readonly copValue: number
}

/** Minimal embedded material evidence for an ordinary expense. */
export type ExpenseFinancialEvidenceRecord = FinancialEvidenceIdentity &
  FinancialEvidenceDisposition & {
    readonly kind: 'expense'
    readonly fields: ExpenseFinancialEvidenceFields
  }

export interface ExpenseAdjustmentEvidenceFields {
  readonly type: 'ajuste'
  readonly usageMode?: UsageMode
  readonly earningPeriodId?: number
  readonly seasonPeriodId?: number
  readonly currency: string
  readonly baseCurrency?: string
  readonly baseCurrencyValue?: number
  readonly secondaryCurrency?: string
  readonly secondaryCurrencyValue?: number
  readonly eurValue: number
  readonly copValue: number
  readonly effectiveFinancialLabel?: string
}

/** Expense-origin adjustment; it remains distinct from ordinary expense. */
export type ExpenseAdjustmentEvidenceRecord = FinancialEvidenceIdentity &
  FinancialEvidenceDisposition & {
    readonly kind: 'expense-adjustment'
    readonly fields: ExpenseAdjustmentEvidenceFields
  }

export type FinancialEvidenceRecord =
  | IncomeFinancialEvidenceRecord
  | IncomeAdjustmentEvidenceRecord
  | ExpenseFinancialEvidenceRecord
  | ExpenseAdjustmentEvidenceRecord

export interface EarningPeriodContextEvidence {
  readonly kind: 'earning-period-context'
  readonly earningPeriodId: number
}

export interface SettingsContextEvidence {
  readonly kind: 'settings-context'
  readonly usageMode: UsageMode
  readonly currency: CurrencyCode
  readonly timezone: IanaTimeZone
}

export type FinancialContextEvidence =
  | EarningPeriodContextEvidence
  | SettingsContextEvidence

/** Complete embedded evidence for v1; appointments are intentionally excluded. */
export interface FinancialEvidence {
  readonly strategy: 'embedded-v1'
  readonly records: readonly FinancialEvidenceRecord[]
  readonly context: readonly FinancialContextEvidence[]
  readonly candidateRecordCount: number
  readonly includedRecordCount: number
  readonly excludedRecordCount: number
  readonly coverageCodes: readonly SnapshotNormativeCode[]
  readonly warningCodes: readonly SnapshotNormativeCode[]
}

export interface FinancialSnapshotInput {
  readonly requestedSnapshotVersion: SnapshotVersion
  readonly requestedCanonicalizationVersion: CanonicalizationVersion
  readonly scope: SnapshotScope
  readonly evidence: FinancialEvidence
  readonly purposeCode: SnapshotNormativeCode
}

export interface SnapshotCandidateMetadata {
  readonly generatedAt: UtcInstant
  readonly generationReasonCode: SnapshotNormativeCode
  readonly provenance: 'local'
  readonly qualityCodes: readonly SnapshotNormativeCode[]
  readonly warningCodes: readonly SnapshotNormativeCode[]
  readonly limitationCodes: readonly SnapshotNormativeCode[]
}

export interface SealedFinancialSnapshotMetadata {
  readonly generatedAt: UtcInstant
  readonly generationReasonCode: SnapshotNormativeCode
  readonly provenance: 'local'
  readonly qualityCodes: readonly SnapshotNormativeCode[]
  readonly warningCodes: readonly SnapshotNormativeCode[]
  readonly limitationCodes: readonly SnapshotNormativeCode[]
}

export type SnapshotBuildExecutionStatus =
  | 'requested'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type SnapshotCandidateStatus = 'draft' | 'validated' | 'rejected'

export type SealedFinancialSnapshotStatus =
  | 'sealed'
  | 'persisted'
  | 'published'
  | 'superseded'
  | 'invalidated'

interface SnapshotCandidateBase<TEngineResult = SnapshotJsonObject> {
  readonly identity: SnapshotCandidateIdentity
  readonly scope: SnapshotScope
  readonly engineResult: TEngineResult
  readonly evidence: FinancialEvidence
  readonly appliedRules: readonly AppliedRule[]
  readonly metadata: SnapshotCandidateMetadata
  readonly snapshotVersion: SnapshotVersion
  readonly canonicalizationVersion: CanonicalizationVersion
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
}

export interface DraftSnapshotCandidate<TEngineResult = SnapshotJsonObject>
  extends SnapshotCandidateBase<TEngineResult> {
  readonly status: 'draft'
}

export interface ValidatedSnapshotCandidate<TEngineResult = SnapshotJsonObject>
  extends SnapshotCandidateBase<TEngineResult> {
  readonly status: 'validated'
}

export interface RejectedSnapshotCandidate<TEngineResult = SnapshotJsonObject>
  extends SnapshotCandidateBase<TEngineResult> {
  readonly status: 'rejected'
  readonly rejectionCodes: readonly [SnapshotNormativeCode, ...SnapshotNormativeCode[]]
}

/** Pre-canonicalization, pre-fingerprint result of a future in-memory builder. */
export type SnapshotCandidate<TEngineResult = SnapshotJsonObject> =
  | DraftSnapshotCandidate<TEngineResult>
  | ValidatedSnapshotCandidate<TEngineResult>
  | RejectedSnapshotCandidate<TEngineResult>

interface SnapshotBuildExecutionBase {
  readonly executionId: SnapshotBuildExecutionId
  readonly input: FinancialSnapshotInput
  readonly requestedAt: UtcInstant
}

export interface RequestedSnapshotBuildExecution extends SnapshotBuildExecutionBase {
  readonly status: 'requested'
}

export interface RunningSnapshotBuildExecution extends SnapshotBuildExecutionBase {
  readonly status: 'running'
  readonly startedAt: UtcInstant
}

export interface SucceededSnapshotBuildExecution<TEngineResult = SnapshotJsonObject>
  extends SnapshotBuildExecutionBase {
  readonly status: 'succeeded'
  readonly startedAt: UtcInstant
  readonly completedAt: UtcInstant
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
  readonly warningCodes: readonly SnapshotNormativeCode[]
  readonly result: SnapshotCandidate<TEngineResult>
}

export interface FailedSnapshotBuildExecution extends SnapshotBuildExecutionBase {
  readonly status: 'failed'
  readonly startedAt: UtcInstant
  readonly completedAt: UtcInstant
  readonly warningCodes: readonly SnapshotNormativeCode[]
  readonly errorCodes: readonly [SnapshotNormativeCode, ...SnapshotNormativeCode[]]
  readonly engineVersion?: EngineVersion
  readonly rulesetVersion?: RulesetVersion
}

export interface CancelledSnapshotBuildExecution extends SnapshotBuildExecutionBase {
  readonly status: 'cancelled'
  readonly startedAt?: UtcInstant
  readonly completedAt: UtcInstant
  readonly warningCodes: readonly SnapshotNormativeCode[]
}

/** Transient build execution; never a financial artifact or revision. */
export type SnapshotBuildExecution<TEngineResult = SnapshotJsonObject> =
  | RequestedSnapshotBuildExecution
  | RunningSnapshotBuildExecution
  | SucceededSnapshotBuildExecution<TEngineResult>
  | FailedSnapshotBuildExecution
  | CancelledSnapshotBuildExecution

/** Data shape reserved for a future canonicalization milestone. */
export interface CanonicalFinancialSnapshotPayloadV1<TEngineResult = SnapshotJsonObject> {
  readonly snapshotVersion: SnapshotVersion
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
  readonly scope: SnapshotScope
  readonly engineResult: TEngineResult
  readonly evidence: FinancialEvidence
  readonly appliedRules: readonly AppliedRule[]
  readonly metadata: SnapshotCandidateMetadata
}

export interface CanonicalMaterialScopeV2 {
  readonly kind: SnapshotScopeKind
  readonly periodStart: CivilDate
  readonly periodEndExclusive: CivilDate
  readonly periodBoundary: '[start,end)'
  readonly timezone: IanaTimeZone
  readonly usageMode: UsageMode
  readonly currency: CurrencyCode
  readonly earningPeriodId?: number
  readonly filters: SnapshotJsonObject
}

export interface CanonicalMaterialMetadataV2 {
  readonly generationReasonCode: SnapshotNormativeCode
  readonly provenance: 'local'
  readonly qualityCodes: readonly SnapshotNormativeCode[]
  readonly warningCodes: readonly SnapshotNormativeCode[]
  readonly limitationCodes: readonly SnapshotNormativeCode[]
}

export interface CanonicalFinancialSnapshotPayloadV2<TEngineResult = SnapshotJsonObject> {
  readonly snapshotVersion: SnapshotVersion
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
  readonly scope: CanonicalMaterialScopeV2
  readonly engineResult: TEngineResult
  readonly evidence: FinancialEvidence
  readonly appliedRules: readonly AppliedRule[]
  readonly metadata: CanonicalMaterialMetadataV2
  readonly asOfPolicy: 'monthly-render-as-of-operational'
}

export type CanonicalFinancialSnapshotPayload<TEngineResult = SnapshotJsonObject> =
  | CanonicalFinancialSnapshotPayloadV1<TEngineResult>
  | CanonicalFinancialSnapshotPayloadV2<TEngineResult>

export interface CanonicalOperationalMetadataV2 {
  readonly generatedAt: UtcInstant
  readonly sourceScopeAsOf: UtcInstant
}

/** Versioned canonicalization output before fingerprinting or sealing. */
export type CanonicalSnapshotDocument<TEngineResult = SnapshotJsonObject> =
  | {
      readonly canonicalizationVersion: CanonicalizationVersion
      readonly payload: CanonicalFinancialSnapshotPayloadV1<TEngineResult>
    }
  | {
      readonly canonicalizationVersion: CanonicalizationVersion
      readonly payload: CanonicalFinancialSnapshotPayloadV2<TEngineResult>
      readonly operationalMetadata: CanonicalOperationalMetadataV2
    }

/** Final immutable artifact; no transient execution or candidate state is accepted. */
export interface SealedFinancialSnapshot<TEngineResult = SnapshotJsonObject> {
  readonly identity: SealedSnapshotIdentity
  readonly revision: SnapshotRevision
  readonly status: 'sealed'
  readonly canonicalDocument: CanonicalSnapshotDocument<TEngineResult>
  readonly fingerprint: SnapshotFingerprint
  readonly sealedAt: UtcInstant
  readonly snapshotVersion: SnapshotVersion
  readonly canonicalizationVersion: CanonicalizationVersion
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
  readonly scope: SnapshotScope
  readonly evidence: FinancialEvidence
  readonly appliedRules: readonly AppliedRule[]
  readonly metadata: SealedFinancialSnapshotMetadata
}

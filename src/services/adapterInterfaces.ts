import type {
  InsightRuleDescriptor,
  InsightRuleProtocolVersion,
} from '../types/insightRule'
import type {
  DraftKnowledgeCollection,
  KnowledgeBuilderInput,
  KnowledgeBuilderVersion,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeVersion,
  ValidatedKnowledgeCollection,
} from '../types/knowledgeLayer'
import type { InsightRuntimeRequest } from '../insight/runtimeRequest'
import type {
  InsightRuntimeFailure,
  InsightRuntimeResponse,
  InsightRuntimeSuccess,
} from '../insight/runtimeResponse'

export interface RuntimeAdapterEngineResult {
  readonly balanceReport: {
    readonly hasData: boolean
    readonly generalBalance: number
    readonly netProfit: number
  }
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
}

export type RuntimeAdapterSourceSnapshot =
  KnowledgeBuilderInput<RuntimeAdapterEngineResult>['snapshot']

export interface RuntimeAdapterVersions {
  readonly knowledgeVersion: KnowledgeVersion
  readonly builderVersion: KnowledgeBuilderVersion
  readonly rulesVersion: KnowledgeRulesVersion
  readonly projectionVersion: KnowledgeProjectionVersion
}

export interface RuntimeAdapterInput {
  readonly executionId: string
  readonly snapshot: RuntimeAdapterSourceSnapshot
  readonly rules: readonly InsightRuleDescriptor[]
  readonly protocolVersion?: InsightRuleProtocolVersion
  readonly versions?: RuntimeAdapterVersions
}

export interface RuntimeAdapterRuntimePort {
  execute(request: InsightRuntimeRequest | null | undefined): InsightRuntimeResponse
}

export interface RuntimeAdapterKnowledgeBuilderPort {
  build(
    input: KnowledgeBuilderInput<RuntimeAdapterEngineResult>,
  ): DraftKnowledgeCollection
}

export interface RuntimeAdapterKnowledgeValidatorPort {
  validate(collection: DraftKnowledgeCollection): ValidatedKnowledgeCollection
}

export interface RuntimeAdapterDependencies {
  readonly runtime?: RuntimeAdapterRuntimePort
  readonly builder?: RuntimeAdapterKnowledgeBuilderPort
  readonly validator?: RuntimeAdapterKnowledgeValidatorPort
}

export type RuntimeAdapterFailureCode =
  | 'ADAPTER_INVALID_INPUT'
  | 'ADAPTER_MISSING_DEPENDENCY'
  | 'ADAPTER_INCOMPATIBLE_SOURCE_DATA'
  | 'ADAPTER_KNOWLEDGE_BUILD_FAILED'
  | 'ADAPTER_KNOWLEDGE_VALIDATION_FAILED'
  | 'ADAPTER_RUNTIME_INVOCATION_FAILED'
  | 'ADAPTER_RUNTIME_INVALID_RESPONSE'

export interface RuntimeAdapterFailure {
  readonly ok: false
  readonly status: 'adapter-failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly executionId: string | null
  readonly code: RuntimeAdapterFailureCode
  readonly message: string
  readonly causeCode?: string
}

export interface RuntimeAdapterSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly request: InsightRuntimeRequest
  readonly knowledgeCollection: ValidatedKnowledgeCollection
  readonly response: InsightRuntimeSuccess
}

export interface RuntimeAdapterRuntimeFailure {
  readonly ok: false
  readonly status: 'runtime-failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly request: InsightRuntimeRequest
  readonly knowledgeCollection: ValidatedKnowledgeCollection
  readonly response: InsightRuntimeFailure
}

export type RuntimeAdapterResult =
  | RuntimeAdapterFailure
  | RuntimeAdapterSuccess
  | RuntimeAdapterRuntimeFailure

export interface RuntimeAdapter {
  adaptAndExecute(input: RuntimeAdapterInput | null | undefined): RuntimeAdapterResult
}

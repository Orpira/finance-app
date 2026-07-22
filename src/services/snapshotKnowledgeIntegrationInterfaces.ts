import type { SealedFinancialSnapshot } from '../types/financialSnapshot'
import type {
  KnowledgeBuilderInput,
  KnowledgeCollectionVersions,
  ValidatedKnowledgeCollection,
} from '../types/knowledgeLayer'
import type {
  SnapshotKnowledgeIntegrationRequest,
  SnapshotKnowledgeIntegrationResult,
} from './snapshotKnowledgeIntegrationResult'

export interface SnapshotKnowledgeLayerEngineResult {
  readonly balanceReport: {
    readonly hasData: boolean
    readonly generalBalance: number
    readonly netProfit: number
  }
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
}

export type SnapshotKnowledgeLayerSnapshot =
  KnowledgeBuilderInput<SnapshotKnowledgeLayerEngineResult>['snapshot']

export interface SnapshotKnowledgeLayerInput {
  readonly snapshot: SnapshotKnowledgeLayerSnapshot
  readonly versions: KnowledgeCollectionVersions
}

export interface SnapshotKnowledgeLayerPort {
  buildValidatedCollection(
    input: SnapshotKnowledgeLayerInput,
  ): ValidatedKnowledgeCollection
}

export interface SnapshotKnowledgeIntegrationDependencies {
  readonly knowledgeLayer?: SnapshotKnowledgeLayerPort
}

export interface SnapshotKnowledgeIntegration {
  integrate(
    request: SnapshotKnowledgeIntegrationRequest | null | undefined,
  ): SnapshotKnowledgeIntegrationResult
}

export type SnapshotKnowledgeInputSnapshot = SealedFinancialSnapshot<unknown>

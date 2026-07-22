import type {
  KnowledgeIntegrationRequest,
  KnowledgeIntegrationResult,
} from './knowledgeIntegrationResult'
import type {
  SnapshotKnowledgeIntegrationRequest,
  SnapshotKnowledgeIntegrationResult,
} from './snapshotKnowledgeIntegrationResult'
import type {
  InsightExecutionRequest,
  InsightExecutionResult,
} from './insightExecutionResult'

export interface InsightExecutionSnapshotIntegrationPort {
  integrate(
    request: SnapshotKnowledgeIntegrationRequest | null | undefined,
  ): SnapshotKnowledgeIntegrationResult
}

export interface InsightExecutionKnowledgeIntegrationPort {
  integrate(
    request: KnowledgeIntegrationRequest | null | undefined,
  ): KnowledgeIntegrationResult
}

export interface InsightExecutionDependencies {
  readonly snapshotIntegration?: InsightExecutionSnapshotIntegrationPort
  readonly knowledgeIntegration?: InsightExecutionKnowledgeIntegrationPort
}

export interface InsightExecutionService {
  execute(
    request: InsightExecutionRequest | null | undefined,
  ): InsightExecutionResult
}

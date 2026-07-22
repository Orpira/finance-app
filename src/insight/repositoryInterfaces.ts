import type {
  Insight,
  InsightCollection,
  InsightId,
  InsightRuleExecutionStatus,
} from './types'
import type {
  InsightRuleCategory,
  InsightRuleId,
  InsightRuleSeverity,
} from '../types/insightRule'
import type { InsightRepositoryStatistics } from './repositoryStatistics'

export interface InsightScopeFilter {
  readonly knowledgeCollectionId?: Insight['traceability']['knowledgeCollectionId']
  readonly sourceSnapshotId?: Insight['traceability']['sourceSnapshotId']
  readonly sourceSnapshotKey?: Insight['traceability']['sourceSnapshotKey']
  readonly sourceSnapshotRevision?: Insight['traceability']['sourceSnapshotRevision']
}

export interface InsightConfidenceFilter {
  readonly minimumScore?: number
  readonly maximumScore?: number
}

export interface InsightRepository {
  replace(collection: InsightCollection): InsightRepository
  clear(): InsightRepository
  getAll(): readonly Insight[]
  getById(insightId: InsightId): Insight | null
  exists(insightId: InsightId): boolean
  count(): number
  getByCategory(category: InsightRuleCategory): readonly Insight[]
  getBySeverity(severity: InsightRuleSeverity): readonly Insight[]
  getByStatus(status: InsightRuleExecutionStatus): readonly Insight[]
  getByScope(filter: InsightScopeFilter): readonly Insight[]
  getByRule(ruleId: InsightRuleId): readonly Insight[]
  filterByConfidence(
    filter: InsightConfidenceFilter,
  ): readonly Insight[]
  getStatistics(): InsightRepositoryStatistics
}
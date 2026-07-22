import type {
  InsightRuleCategory,
  InsightRuleId,
  InsightRuleSeverity,
} from '../types/insightRule'
import type { InsightEngine } from './engineInterfaces'
import type {
  InsightConfidenceFilter,
  InsightRepository,
  InsightScopeFilter,
} from './repositoryInterfaces'
import type { InsightRepositoryStatistics } from './repositoryStatistics'
import type { InsightRuntimeRequest } from './runtimeRequest'
import type { InsightRuntimeResponse } from './runtimeResponse'
import type {
  Insight,
  InsightId,
  InsightRuleExecutionStatus,
} from './types'

export interface InsightRuntimeSnapshot {
  readonly ready: boolean
  readonly deterministic: true
  readonly failClosed: true
  readonly insightCount: number
  readonly insights: readonly Insight[]
  readonly statistics: InsightRepositoryStatistics
}

export type InsightRuntimeQuery =
  | {
      readonly kind: 'by-category'
      readonly category: InsightRuleCategory
    }
  | {
      readonly kind: 'by-severity'
      readonly severity: InsightRuleSeverity
    }
  | {
      readonly kind: 'by-status'
      readonly status: InsightRuleExecutionStatus
    }
  | {
      readonly kind: 'by-scope'
      readonly filter: InsightScopeFilter
    }
  | {
      readonly kind: 'by-rule'
      readonly ruleId: InsightRuleId
    }
  | {
      readonly kind: 'by-confidence'
      readonly filter: InsightConfidenceFilter
    }
  | {
      readonly kind: 'statistics'
    }

export interface InsightRuntimeInsightsQueryResult {
  readonly kind: 'insights'
  readonly deterministic: true
  readonly failClosed: true
  readonly insights: readonly Insight[]
}

export interface InsightRuntimeStatisticsQueryResult {
  readonly kind: 'statistics'
  readonly deterministic: true
  readonly failClosed: true
  readonly statistics: InsightRepositoryStatistics
}

export type InsightRuntimeQueryResult =
  | InsightRuntimeInsightsQueryResult
  | InsightRuntimeStatisticsQueryResult

export interface InsightRuntimeDependencies {
  readonly orchestrator?: InsightEngine
  readonly repository?: InsightRepository
}

export interface InsightRuntime {
  execute(request: InsightRuntimeRequest | null | undefined): InsightRuntimeResponse
  getSnapshot(): InsightRuntimeSnapshot
  getAll(): readonly Insight[]
  getById(id: InsightId): Insight | null
  query(query: InsightRuntimeQuery): InsightRuntimeQueryResult
  count(): number
  exists(id: InsightId): boolean
}

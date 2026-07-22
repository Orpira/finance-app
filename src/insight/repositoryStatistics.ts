import {
  INSIGHT_RULE_CATEGORIES,
  INSIGHT_RULE_SEVERITIES,
  type InsightRuleCategory,
  type InsightRuleSeverity,
} from '../types/insightRule'
import type {
  Insight,
  InsightCollection,
  InsightRuleExecutionStatus,
} from './types'

const EXECUTION_STATUSES = ['generated', 'skipped'] as const

type ExecutionStatusKey = (typeof EXECUTION_STATUSES)[number]

export interface InsightRepositoryStatistics {
  readonly totalInsights: number
  readonly totalByCategory: Readonly<Record<InsightRuleCategory, number>>
  readonly totalBySeverity: Readonly<Record<InsightRuleSeverity, number>>
  readonly totalByStatus: Readonly<Record<InsightRuleExecutionStatus, number>>
  readonly totalByScope: Readonly<Record<string, number>>
  readonly confidenceAverage: number | null
  readonly confidenceMinimum: number | null
  readonly confidenceMaximum: number | null
}

function createCounter<K extends string>(keys: readonly K[]): Record<K, number> {
  const counter = {} as Record<K, number>
  for (const key of keys) {
    counter[key] = 0
  }
  return counter
}

function toScopeKey(insight: Insight): string {
  const traceability = insight.traceability
  return `${traceability.knowledgeCollectionId}|${traceability.sourceSnapshotId}|${traceability.sourceSnapshotKey}|${traceability.sourceSnapshotRevision}`
}

export function createEmptyInsightRepositoryStatistics(): InsightRepositoryStatistics {
  return {
    totalInsights: 0,
    totalByCategory: createCounter(INSIGHT_RULE_CATEGORIES),
    totalBySeverity: createCounter(INSIGHT_RULE_SEVERITIES),
    totalByStatus: createCounter(EXECUTION_STATUSES),
    totalByScope: {},
    confidenceAverage: null,
    confidenceMinimum: null,
    confidenceMaximum: null,
  }
}

export function buildInsightRepositoryStatistics(
  collection: InsightCollection | null,
): InsightRepositoryStatistics {
  if (collection === null) {
    return createEmptyInsightRepositoryStatistics()
  }

  const totalByCategory = createCounter(INSIGHT_RULE_CATEGORIES)
  const totalBySeverity = createCounter(INSIGHT_RULE_SEVERITIES)
  const totalByStatus = createCounter(EXECUTION_STATUSES)
  const totalByScope: Record<string, number> = {}

  let confidenceTotal = 0
  let confidenceMinimum = Number.POSITIVE_INFINITY
  let confidenceMaximum = Number.NEGATIVE_INFINITY

  for (const insight of collection.insights) {
    totalByCategory[insight.category] += 1
    totalBySeverity[insight.severity] += 1

    const scopeKey = toScopeKey(insight)
    totalByScope[scopeKey] = (totalByScope[scopeKey] ?? 0) + 1

    const score = insight.confidence.score
    confidenceTotal += score
    confidenceMinimum = Math.min(confidenceMinimum, score)
    confidenceMaximum = Math.max(confidenceMaximum, score)
  }

  for (const execution of collection.executions) {
    const status = execution.status as ExecutionStatusKey
    totalByStatus[status] += 1
  }

  const totalInsights = collection.insights.length
  const confidenceAverage =
    totalInsights === 0 ? null : confidenceTotal / totalInsights

  return {
    totalInsights,
    totalByCategory,
    totalBySeverity,
    totalByStatus,
    totalByScope,
    confidenceAverage,
    confidenceMinimum:
      totalInsights === 0 ? null : confidenceMinimum,
    confidenceMaximum:
      totalInsights === 0 ? null : confidenceMaximum,
  }
}
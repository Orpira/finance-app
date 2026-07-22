import type {
  Insight,
  InsightCollection,
  InsightId,
  InsightRuleExecutionStatus,
} from './types'
import type {
  InsightConfidenceFilter,
  InsightRepository,
  InsightScopeFilter,
} from './repositoryInterfaces'
import { buildInsightRepositoryStatistics } from './repositoryStatistics'
import type {
  InsightRuleCategory,
  InsightRuleId,
  InsightRuleSeverity,
} from '../types/insightRule'

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = deepClone(item)
  }

  return result as T
}

function cloneCollection(collection: InsightCollection): InsightCollection {
  return deepClone(collection)
}

function cloneInsight(insight: Insight): Insight {
  return deepClone(insight)
}

function cloneInsights(insights: readonly Insight[]): readonly Insight[] {
  return insights.map((insight) => cloneInsight(insight))
}

function isFailClosedCollection(
  collection: InsightCollection | null,
): collection is InsightCollection {
  if (collection === null) {
    return false
  }

  if (collection.deterministicOutput !== true || collection.failClosed !== true) {
    return false
  }

  if (!Array.isArray(collection.insights) || !Array.isArray(collection.executions)) {
    return false
  }

  return true
}

function normalizeCollection(
  collection: InsightCollection | null,
): InsightCollection | null {
  if (!isFailClosedCollection(collection)) {
    return null
  }

  return cloneCollection(collection)
}

function insightList(collection: InsightCollection | null): readonly Insight[] {
  return collection?.insights ?? []
}

function generatedInsightIdsByStatus(
  collection: InsightCollection,
  status: InsightRuleExecutionStatus,
): ReadonlySet<string> {
  const ids = new Set<string>()

  for (const execution of collection.executions) {
    if (execution.status !== status || execution.generatedInsightId === undefined) {
      continue
    }

    ids.add(String(execution.generatedInsightId))
  }

  return ids
}

function normalizeConfidenceFilter(
  filter: InsightConfidenceFilter,
): { readonly minimumScore: number | null; readonly maximumScore: number | null } {
  const minimumScore =
    typeof filter.minimumScore === 'number' && Number.isFinite(filter.minimumScore)
      ? filter.minimumScore
      : null
  const maximumScore =
    typeof filter.maximumScore === 'number' && Number.isFinite(filter.maximumScore)
      ? filter.maximumScore
      : null

  return {
    minimumScore,
    maximumScore,
  }
}

function createRepository(collection: InsightCollection | null): InsightRepository {
  const safeCollection = normalizeCollection(collection)

  function getById(insightId: InsightId): Insight | null {
    const match = insightList(safeCollection).find(
      (insight) => insight.insightId === insightId,
    )

    if (match === undefined) {
      return null
    }

    return cloneInsight(match)
  }

  function getByScope(filter: InsightScopeFilter): readonly Insight[] {
    const filtered = insightList(safeCollection).filter((insight) => {
      if (
        filter.knowledgeCollectionId !== undefined &&
        insight.traceability.knowledgeCollectionId !== filter.knowledgeCollectionId
      ) {
        return false
      }

      if (
        filter.sourceSnapshotId !== undefined &&
        insight.traceability.sourceSnapshotId !== filter.sourceSnapshotId
      ) {
        return false
      }

      if (
        filter.sourceSnapshotKey !== undefined &&
        insight.traceability.sourceSnapshotKey !== filter.sourceSnapshotKey
      ) {
        return false
      }

      if (
        filter.sourceSnapshotRevision !== undefined &&
        insight.traceability.sourceSnapshotRevision !== filter.sourceSnapshotRevision
      ) {
        return false
      }

      return true
    })

    return cloneInsights(filtered)
  }

  function filterByConfidence(filter: InsightConfidenceFilter): readonly Insight[] {
    const range = normalizeConfidenceFilter(filter)

    if (
      range.minimumScore !== null &&
      range.maximumScore !== null &&
      range.minimumScore > range.maximumScore
    ) {
      return []
    }

    const filtered = insightList(safeCollection).filter((insight) => {
      if (
        range.minimumScore !== null &&
        insight.confidence.score < range.minimumScore
      ) {
        return false
      }

      if (
        range.maximumScore !== null &&
        insight.confidence.score > range.maximumScore
      ) {
        return false
      }

      return true
    })

    return cloneInsights(filtered)
  }

  return {
    replace(nextCollection: InsightCollection): InsightRepository {
      return createRepository(nextCollection)
    },
    clear(): InsightRepository {
      return createRepository(null)
    },
    getAll(): readonly Insight[] {
      return cloneInsights(insightList(safeCollection))
    },
    getById,
    exists(insightId: InsightId): boolean {
      return insightList(safeCollection).some(
        (insight) => insight.insightId === insightId,
      )
    },
    count(): number {
      return insightList(safeCollection).length
    },
    getByCategory(category: InsightRuleCategory): readonly Insight[] {
      const filtered = insightList(safeCollection).filter(
        (insight) => insight.category === category,
      )

      return cloneInsights(filtered)
    },
    getBySeverity(severity: InsightRuleSeverity): readonly Insight[] {
      const filtered = insightList(safeCollection).filter(
        (insight) => insight.severity === severity,
      )

      return cloneInsights(filtered)
    },
    getByStatus(status: InsightRuleExecutionStatus): readonly Insight[] {
      if (safeCollection === null) {
        return []
      }

      const ids = generatedInsightIdsByStatus(safeCollection, status)
      const filtered = safeCollection.insights.filter((insight) =>
        ids.has(String(insight.insightId)),
      )

      return cloneInsights(filtered)
    },
    getByScope,
    getByRule(ruleId: InsightRuleId): readonly Insight[] {
      const filtered = insightList(safeCollection).filter(
        (insight) => insight.rule.ruleId === ruleId,
      )

      return cloneInsights(filtered)
    },
    filterByConfidence,
    getStatistics() {
      return deepClone(buildInsightRepositoryStatistics(safeCollection))
    },
  }
}

export function createInsightRepository(
  collection: InsightCollection | null = null,
): InsightRepository {
  return createRepository(collection)
}
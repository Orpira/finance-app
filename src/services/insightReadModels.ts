import type {
  InsightRuntimeFailure,
  InsightRuntimeResponse,
  InsightRuntimeSuccess,
} from '../insight/runtimeResponse'
import type {
  Insight,
  InsightRuleExecutionStatus,
  InsightRuleExecutionTrace,
} from '../insight/types'
import {
  INSIGHT_RULE_CATEGORIES,
  INSIGHT_RULE_SEVERITIES,
  type InsightRuleCategory,
  type InsightRuleSeverity,
} from '../types/insightRule'
import type {
  InsightReadModelFailure,
  InsightReadModelInsight,
  InsightReadModelProjection,
  InsightReadModelResult,
  InsightReadModels,
  InsightReadModelTraceabilityItem,
  InsightReadModelUpdateMetadata,
} from './readModelInterfaces'

const EXECUTION_STATUSES = ['generated', 'skipped'] as const
const CONFIDENCE_MODES = [
  'fixed-score',
  'bounded-score',
  'evidence-derived',
] as const

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function createCounter<K extends string>(keys: readonly K[]): Record<K, number> {
  const counter = {} as Record<K, number>
  for (const key of keys) {
    counter[key] = 0
  }
  return counter
}

function createInsightBucketsByCategory(): Record<
  InsightRuleCategory,
  InsightReadModelInsight[]
> {
  const buckets = {} as Record<InsightRuleCategory, InsightReadModelInsight[]>
  for (const category of INSIGHT_RULE_CATEGORIES) {
    buckets[category] = []
  }
  return buckets
}

function createInsightBucketsBySeverity(): Record<
  InsightRuleSeverity,
  InsightReadModelInsight[]
> {
  const buckets = {} as Record<InsightRuleSeverity, InsightReadModelInsight[]>
  for (const severity of INSIGHT_RULE_SEVERITIES) {
    buckets[severity] = []
  }
  return buckets
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function hasRuntimeFailureKind(value: unknown): boolean {
  return (
    value === 'invalid-request' ||
    value === 'validation-rejected' ||
    value === 'pipeline-failure'
  )
}

function hasValidationReportShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.status === 'valid' || value.status === 'invalid') &&
    value.failClosed === true &&
    value.deterministic === true &&
    isSafeNonNegativeInteger(value.issueCount) &&
    Array.isArray(value.issues)
  )
}

function hasRuntimeSuccessShape(value: unknown): value is InsightRuntimeSuccess {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === true &&
    value.status === 'success' &&
    isNonEmptyString(value.executionId) &&
    value.deterministic === true &&
    value.failClosed === true &&
    value.repositoryUpdated === true &&
    isRecord(value.collection) &&
    isRecord(value.assessment) &&
    hasValidationReportShape(value.validationReport)
  )
}

function hasRuntimeFailureShape(value: unknown): value is InsightRuntimeFailure {
  if (!isRecord(value)) {
    return false
  }

  const hasOptionalValidationReport =
    value.validationReport === undefined ||
    hasValidationReportShape(value.validationReport)

  return (
    value.ok === false &&
    value.status === 'failure' &&
    (value.executionId === null || isNonEmptyString(value.executionId)) &&
    value.deterministic === true &&
    value.failClosed === true &&
    hasRuntimeFailureKind(value.failureKind) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message) &&
    hasOptionalValidationReport
  )
}

function hasRuntimeResponseShape(value: unknown): value is InsightRuntimeResponse {
  return hasRuntimeSuccessShape(value) || hasRuntimeFailureShape(value)
}

function buildProjectionFailure(message: string): InsightReadModelFailure {
  return {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    code: 'READ_MODEL_INVALID_RUNTIME_RESPONSE',
    message,
  }
}

function buildExecutionStatusByInsightId(
  executions: readonly InsightRuleExecutionTrace[],
): Readonly<Record<string, InsightRuleExecutionStatus>> {
  const statusByInsightId: Record<string, InsightRuleExecutionStatus> = {}

  for (const execution of executions) {
    if (
      execution.status === 'generated' &&
      execution.generatedInsightId !== undefined
    ) {
      statusByInsightId[execution.generatedInsightId] = 'generated'
    }
  }

  return statusByInsightId
}

function toTraceabilityItem(insight: Insight): InsightReadModelTraceabilityItem {
  return {
    insightId: insight.insightId,
    ruleId: insight.traceability.rule.ruleId,
    ruleVersion: insight.traceability.rule.ruleVersion,
    protocolVersion: insight.traceability.rule.protocolVersion,
    knowledgeCollectionId: insight.traceability.knowledgeCollectionId,
    sourceSnapshotId: insight.traceability.sourceSnapshotId,
    sourceSnapshotKey: insight.traceability.sourceSnapshotKey,
    sourceSnapshotRevision: insight.traceability.sourceSnapshotRevision,
    factIds: insight.traceability.factIds.map((factId) => factId),
  }
}

function toReadModelInsight(input: {
  readonly insight: Insight
  readonly statusByInsightId: Readonly<Record<string, InsightRuleExecutionStatus>>
}): InsightReadModelInsight {
  const traceability = toTraceabilityItem(input.insight)
  const executionStatus =
    input.statusByInsightId[input.insight.insightId] ?? 'generated'

  return {
    insightId: input.insight.insightId,
    outputKind: input.insight.outputKind,
    category: input.insight.category,
    severity: input.insight.severity,
    titleCode: input.insight.titleCode,
    messageCode: input.insight.messageCode,
    executionStatus,
    confidence: {
      mode: input.insight.confidence.mode,
      scoreUnit: input.insight.confidence.scoreUnit,
      score: input.insight.confidence.score,
    },
    evidence: {
      evidenceType: input.insight.evidence.evidenceType,
      summaryCode: input.insight.evidence.summaryCode,
      requiredFactsCount: input.insight.evidence.requiredFacts.length,
      matchedFactsCount: input.insight.evidence.matchedFacts.length,
      missingFactsCount: input.insight.evidence.missingFacts.length,
    },
    traceability,
  }
}

function projectFromRuntimeResponse(
  response: InsightRuntimeResponse,
): InsightReadModelProjection {
  const insights = response.ok ? response.collection.insights : []
  const executions = response.ok ? response.collection.executions : []
  const statusByInsightId = buildExecutionStatusByInsightId(executions)

  const projectedInsights = insights.map((insight) =>
    toReadModelInsight({
      insight,
      statusByInsightId,
    }),
  )

  const insightsByCategory = createInsightBucketsByCategory()
  const insightsBySeverity = createInsightBucketsBySeverity()

  const totalByCategory = createCounter(INSIGHT_RULE_CATEGORIES)
  const totalBySeverity = createCounter(INSIGHT_RULE_SEVERITIES)
  const totalByStatus = createCounter(EXECUTION_STATUSES)
  const confidenceByMode = createCounter(CONFIDENCE_MODES)

  let confidenceTotal = 0
  let confidenceMinimum = Number.POSITIVE_INFINITY
  let confidenceMaximum = Number.NEGATIVE_INFINITY

  for (const insight of projectedInsights) {
    insightsByCategory[insight.category].push(insight)
    insightsBySeverity[insight.severity].push(insight)
    totalByCategory[insight.category] += 1
    totalBySeverity[insight.severity] += 1
    confidenceByMode[insight.confidence.mode] += 1

    confidenceTotal += insight.confidence.score
    confidenceMinimum = Math.min(confidenceMinimum, insight.confidence.score)
    confidenceMaximum = Math.max(confidenceMaximum, insight.confidence.score)
  }

  for (const execution of executions) {
    totalByStatus[execution.status] += 1
  }

  const totalInsights = projectedInsights.length
  const confidenceAverage =
    totalInsights === 0 ? null : confidenceTotal / totalInsights
  const normalizedConfidenceMinimum =
    totalInsights === 0 ? null : confidenceMinimum
  const normalizedConfidenceMaximum =
    totalInsights === 0 ? null : confidenceMaximum

  const validationIssueCount = response.ok
    ? response.validationReport.issueCount
    : (response.validationReport?.issueCount ?? 0)

  const summary = {
    runtimeStatus: response.status,
    totalInsights,
    totalExecutions: executions.length,
    generatedRules: response.ok ? response.assessment.generatedInsights : 0,
    skippedRules: response.ok ? response.assessment.skippedRules : 0,
    validationIssueCount,
  }

  const updateMetadata: InsightReadModelUpdateMetadata = {
    runtimeStatus: response.status,
    executionId: response.executionId,
    deterministic: true,
    failClosed: true,
    repositoryUpdated: response.ok ? response.repositoryUpdated : false,
    protocolVersion: response.ok ? response.collection.protocolVersion : null,
    sourceKnowledgeCollectionId: response.ok
      ? response.collection.sourceKnowledgeCollectionId
      : null,
    sourceSnapshotId: response.ok ? response.collection.sourceSnapshotId : null,
    sourceSnapshotKey: response.ok ? response.collection.sourceSnapshotKey : null,
    sourceSnapshotRevision: response.ok
      ? response.collection.sourceSnapshotRevision
      : null,
  }

  const projection: InsightReadModelProjection = {
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    summary,
    insights: projectedInsights,
    insightsByCategory,
    insightsBySeverity,
    statistics: {
      totalInsights,
      totalByCategory,
      totalBySeverity,
      totalByStatus,
      confidenceAverage,
      confidenceMinimum: normalizedConfidenceMinimum,
      confidenceMaximum: normalizedConfidenceMaximum,
      validationIssueCount,
    },
    confidenceIndicators: {
      averageScore: confidenceAverage,
      minimumScore: normalizedConfidenceMinimum,
      maximumScore: normalizedConfidenceMaximum,
      totalScoredInsights: totalInsights,
      byMode: confidenceByMode,
    },
    updateMetadata,
    traceability: projectedInsights.map((insight) => insight.traceability),
    ...(response.ok
      ? {}
      : {
          runtimeFailure: {
            failureKind: response.failureKind,
            code: response.code,
            message: response.message,
            validationIssueCount,
          },
        }),
  }

  return deepFreeze(projection)
}

export function createInsightReadModels(): InsightReadModels {
  return {
    project(
      response: InsightRuntimeResponse | null | undefined,
    ): InsightReadModelResult {
      if (!hasRuntimeResponseShape(response)) {
        return buildProjectionFailure(
          'runtime response must be a valid public InsightRuntimeResponse',
        )
      }

      return projectFromRuntimeResponse(response)
    },
  }
}

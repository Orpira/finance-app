import { INSIGHT_RULE_PROTOCOL_VERSION } from '../types/insightRule'
import type {
  InsightRuleDescriptor,
  InsightRuleProtocolVersion,
} from '../types/insightRule'
import type { KnowledgeCollection } from '../types/knowledgeLayer'
import type { InsightEngineResult } from './engineResult'
import type {
  InsightRepository,
} from './repositoryInterfaces'
import {
  createEmptyInsightRepositoryStatistics,
  type InsightRepositoryStatistics,
} from './repositoryStatistics'
import type {
  InsightRuntime,
  InsightRuntimeDependencies,
  InsightRuntimeQuery,
  InsightRuntimeQueryResult,
  InsightRuntimeSnapshot,
} from './runtimeInterfaces'
import type { InsightRuntimeRequest } from './runtimeRequest'
import type {
  InsightRuntimeFailure,
  InsightRuntimeFailureCode,
  InsightRuntimeFailureKind,
  InsightRuntimeResponse,
  InsightRuntimeSuccess,
} from './runtimeResponse'
import type {
  InsightBuildAssessment,
  InsightCollection,
} from './types'
import type { ValidationReport } from './validationReport'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function hasRepositoryShape(value: unknown): value is InsightRepository {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.replace === 'function' &&
    typeof value.clear === 'function' &&
    typeof value.getAll === 'function' &&
    typeof value.getById === 'function' &&
    typeof value.exists === 'function' &&
    typeof value.count === 'function' &&
    typeof value.getByCategory === 'function' &&
    typeof value.getBySeverity === 'function' &&
    typeof value.getByStatus === 'function' &&
    typeof value.getByScope === 'function' &&
    typeof value.getByRule === 'function' &&
    typeof value.filterByConfidence === 'function' &&
    typeof value.getStatistics === 'function'
  )
}

function hasOrchestratorShape(
  value: InsightRuntimeDependencies['orchestrator'],
): value is NonNullable<InsightRuntimeDependencies['orchestrator']> {
  return isRecord(value) && typeof value.run === 'function'
}

function hasValidValidationIssue(issue: unknown): boolean {
  if (!isRecord(issue)) {
    return false
  }

  return (
    isNonEmptyString(issue.code) &&
    typeof issue.path === 'string' &&
    isNonEmptyString(issue.message)
  )
}

function hasValidValidationReport(
  report: unknown,
): report is ValidationReport {
  if (!isRecord(report)) {
    return false
  }

  if (report.status !== 'valid' && report.status !== 'invalid') {
    return false
  }

  if (report.failClosed !== true || report.deterministic !== true) {
    return false
  }

  if (!isSafeNonNegativeInteger(report.issueCount)) {
    return false
  }

  if (!Array.isArray(report.issues)) {
    return false
  }

  if (report.issueCount !== report.issues.length) {
    return false
  }

  return report.issues.every((issue) => hasValidValidationIssue(issue))
}

function hasValidAssessment(
  assessment: unknown,
): assessment is InsightBuildAssessment {
  if (!isRecord(assessment)) {
    return false
  }

  if (assessment.status !== 'ok' && assessment.status !== 'blocked') {
    return false
  }

  if (!Array.isArray(assessment.failures)) {
    return false
  }

  for (const failure of assessment.failures) {
    if (!isRecord(failure)) {
      return false
    }

    if (!isNonEmptyString(failure.code) || !isNonEmptyString(failure.message)) {
      return false
    }
  }

  return (
    isSafeNonNegativeInteger(assessment.generatedInsights) &&
    isSafeNonNegativeInteger(assessment.skippedRules)
  )
}

function hasValidCollection(
  collection: unknown,
): collection is InsightCollection {
  if (!isRecord(collection)) {
    return false
  }

  if (!isSafeNonNegativeInteger(collection.protocolVersion)) {
    return false
  }

  return (
    isNonEmptyString(collection.sourceKnowledgeCollectionId) &&
    isNonEmptyString(collection.sourceSnapshotId) &&
    isNonEmptyString(collection.sourceSnapshotKey) &&
    isSafeNonNegativeInteger(collection.sourceSnapshotRevision) &&
    collection.deterministicOutput === true &&
    collection.failClosed === true &&
    Array.isArray(collection.insights) &&
    Array.isArray(collection.executions)
  )
}

function hasValidEngineResult(
  result: unknown,
): result is InsightEngineResult {
  if (!isRecord(result)) {
    return false
  }

  if (result.status !== 'accepted' && result.status !== 'rejected') {
    return false
  }

  return (
    result.deterministic === true &&
    result.failClosed === true &&
    typeof result.repositoryUpdated === 'boolean' &&
    hasValidCollection(result.collection) &&
    hasValidAssessment(result.assessment) &&
    hasValidValidationReport(result.validationReport) &&
    hasRepositoryShape(result.repository)
  )
}

function hasCompatibleKnowledgeCollection(
  knowledgeCollection: unknown,
): knowledgeCollection is KnowledgeCollection {
  if (!isRecord(knowledgeCollection)) {
    return false
  }

  if (knowledgeCollection.state !== 'validated') {
    return false
  }

  if (!isRecord(knowledgeCollection.identity)) {
    return false
  }

  if (
    !isNonEmptyString(knowledgeCollection.identity.knowledgeCollectionId) ||
    !isNonEmptyString(knowledgeCollection.identity.sourceSnapshotId) ||
    !isNonEmptyString(knowledgeCollection.identity.sourceSnapshotKey) ||
    !isSafeNonNegativeInteger(knowledgeCollection.identity.sourceSnapshotRevision) ||
    !isNonEmptyString(knowledgeCollection.identity.sourceFingerprintValue)
  ) {
    return false
  }

  if (!isRecord(knowledgeCollection.versions)) {
    return false
  }

  if (
    !isNonEmptyString(knowledgeCollection.versions.knowledgeVersion) ||
    !isNonEmptyString(knowledgeCollection.versions.builderVersion) ||
    !isNonEmptyString(knowledgeCollection.versions.rulesVersion) ||
    !isNonEmptyString(knowledgeCollection.versions.projectionVersion)
  ) {
    return false
  }

  if (!Array.isArray(knowledgeCollection.facts)) {
    return false
  }

  if (!Array.isArray(knowledgeCollection.relationships)) {
    return false
  }

  if (!isSafeNonNegativeInteger(knowledgeCollection.factCount)) {
    return false
  }

  if (knowledgeCollection.factCount !== knowledgeCollection.facts.length) {
    return false
  }

  const seenFactIds = new Set<string>()
  for (const fact of knowledgeCollection.facts) {
    if (!isRecord(fact) || !isNonEmptyString(fact.factId)) {
      return false
    }

    if (seenFactIds.has(fact.factId)) {
      return false
    }

    seenFactIds.add(fact.factId)
  }

  if (!isRecord(knowledgeCollection.validation)) {
    return false
  }

  return knowledgeCollection.validation.status === 'valid'
}

function hasCompatibleRuleCatalog(
  rules: unknown,
  protocolVersion: InsightRuleProtocolVersion,
): rules is readonly InsightRuleDescriptor[] {
  if (!Array.isArray(rules)) {
    return false
  }

  const identities = new Set<string>()

  for (const rule of rules) {
    if (!isRecord(rule)) {
      return false
    }

    if (!isRecord(rule.reference)) {
      return false
    }

    if (
      !isNonEmptyString(rule.reference.ruleId) ||
      !isNonEmptyString(rule.reference.ruleVersion) ||
      !isSafeNonNegativeInteger(rule.reference.protocolVersion)
    ) {
      return false
    }

    if (rule.reference.protocolVersion !== protocolVersion) {
      return false
    }

    if (!isRecord(rule.metadata)) {
      return false
    }

    if (
      rule.metadata.deterministicIdentity !== true ||
      rule.metadata.deterministicOutput !== true ||
      rule.metadata.failClosed !== true
    ) {
      return false
    }

    if (!isRecord(rule.compatibility)) {
      return false
    }

    if (
      !isSafeNonNegativeInteger(rule.compatibility.minimumProtocol) ||
      !isSafeNonNegativeInteger(rule.compatibility.maximumProtocol)
    ) {
      return false
    }

    if (rule.compatibility.minimumProtocol > rule.compatibility.maximumProtocol) {
      return false
    }

    const identityKey = `${rule.reference.ruleId}::${rule.reference.ruleVersion}::${rule.reference.protocolVersion}`
    if (identities.has(identityKey)) {
      return false
    }

    identities.add(identityKey)
  }

  return true
}

function buildFailure(input: {
  readonly executionId: string | null
  readonly failureKind: InsightRuntimeFailureKind
  readonly code: InsightRuntimeFailureCode
  readonly message: string
  readonly validationReport?: ValidationReport
}): InsightRuntimeFailure {
  return {
    ok: false,
    status: 'failure',
    executionId: input.executionId,
    deterministic: true,
    failClosed: true,
    failureKind: input.failureKind,
    code: input.code,
    message: input.message,
    validationReport:
      input.validationReport === undefined
        ? undefined
        : deepClone(input.validationReport),
  }
}

function buildSuccess(input: {
  readonly executionId: string
  readonly collection: InsightCollection
  readonly assessment: InsightBuildAssessment
  readonly validationReport: ValidationReport
}): InsightRuntimeSuccess {
  return {
    ok: true,
    status: 'success',
    executionId: input.executionId,
    deterministic: true,
    failClosed: true,
    repositoryUpdated: true,
    collection: deepClone(input.collection),
    assessment: deepClone(input.assessment),
    validationReport: deepClone(input.validationReport),
  }
}

type RuntimeRequestValidationResult =
  | {
      readonly ok: true
      readonly value: InsightRuntimeRequest
    }
  | {
      readonly ok: false
      readonly code: InsightRuntimeFailureCode
      readonly message: string
      readonly executionId: string | null
    }

function extractExecutionId(value: unknown): string | null {
  if (!isRecord(value) || !isNonEmptyString(value.executionId)) {
    return null
  }

  return value.executionId
}

function validateRuntimeRequest(
  request: InsightRuntimeRequest | null | undefined,
): RuntimeRequestValidationResult {
  if (!isRecord(request)) {
    return {
      ok: false,
      code: 'RUNTIME_INVALID_REQUEST',
      message: 'runtime request must be a non-null object',
      executionId: null,
    }
  }

  const executionId = extractExecutionId(request)

  if (executionId === null) {
    return {
      ok: false,
      code: 'RUNTIME_INVALID_REQUEST',
      message: 'runtime request executionId is required',
      executionId: null,
    }
  }

  if (!isSafeNonNegativeInteger(request.protocolVersion)) {
    return {
      ok: false,
      code: 'RUNTIME_INVALID_REQUEST',
      message: 'runtime request protocolVersion must be a non-negative integer',
      executionId,
    }
  }

  if (request.protocolVersion !== INSIGHT_RULE_PROTOCOL_VERSION) {
    return {
      ok: false,
      code: 'RUNTIME_INVALID_REQUEST',
      message: 'runtime request protocolVersion is not supported',
      executionId,
    }
  }

  if (!hasCompatibleKnowledgeCollection(request.knowledgeCollection)) {
    return {
      ok: false,
      code: 'RUNTIME_INCOMPATIBLE_KNOWLEDGE_COLLECTION',
      message: 'runtime request knowledgeCollection is incompatible',
      executionId,
    }
  }

  if (!hasCompatibleRuleCatalog(request.rules, request.protocolVersion)) {
    return {
      ok: false,
      code: 'RUNTIME_INVALID_RULE_CATALOG',
      message: 'runtime request rules catalog is invalid',
      executionId,
    }
  }

  return {
    ok: true,
    value: request,
  }
}

function emptyInsightRepositoryStatistics(): InsightRepositoryStatistics {
  return createEmptyInsightRepositoryStatistics()
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) {
    return false
  }

  return Object.values(value).every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  )
}

function hasValidInsightRepositoryStatistics(
  statistics: unknown,
): statistics is InsightRepositoryStatistics {
  if (!isRecord(statistics)) {
    return false
  }

  return (
    typeof statistics.totalInsights === 'number' &&
    Number.isFinite(statistics.totalInsights) &&
    isNumberRecord(statistics.totalByCategory) &&
    isNumberRecord(statistics.totalBySeverity) &&
    isNumberRecord(statistics.totalByStatus) &&
    isNumberRecord(statistics.totalByScope) &&
    (
      statistics.confidenceAverage === null ||
      (typeof statistics.confidenceAverage === 'number' &&
        Number.isFinite(statistics.confidenceAverage))
    ) &&
    (
      statistics.confidenceMinimum === null ||
      (typeof statistics.confidenceMinimum === 'number' &&
        Number.isFinite(statistics.confidenceMinimum))
    ) &&
    (
      statistics.confidenceMaximum === null ||
      (typeof statistics.confidenceMaximum === 'number' &&
        Number.isFinite(statistics.confidenceMaximum))
    )
  )
}

function buildEmptySnapshot(ready: boolean): InsightRuntimeSnapshot {
  return {
    ready,
    deterministic: true,
    failClosed: true,
    insightCount: 0,
    insights: [],
    statistics: emptyInsightRepositoryStatistics(),
  }
}

function buildInsightsQueryResult(insights: unknown): InsightRuntimeQueryResult {
  if (!Array.isArray(insights)) {
    return {
      kind: 'insights',
      deterministic: true,
      failClosed: true,
      insights: [],
    }
  }

  return {
    kind: 'insights',
    deterministic: true,
    failClosed: true,
    insights: deepClone(insights),
  }
}

function buildStatisticsQueryResult(
  statistics: unknown,
): InsightRuntimeQueryResult {
  if (!hasValidInsightRepositoryStatistics(statistics)) {
    return {
      kind: 'statistics',
      deterministic: true,
      failClosed: true,
      statistics: emptyInsightRepositoryStatistics(),
    }
  }

  return {
    kind: 'statistics',
    deterministic: true,
    failClosed: true,
    statistics: deepClone(statistics),
  }
}

function buildMissingDependencyFailure(
  executionId: string | null,
  dependencies: {
    readonly missingOrchestrator: boolean
    readonly missingRepository: boolean
  },
): InsightRuntimeFailure {
  const missing: string[] = []
  if (dependencies.missingOrchestrator) {
    missing.push('orchestrator')
  }
  if (dependencies.missingRepository) {
    missing.push('repository')
  }

  const dependencyLabel = missing.join(', ')

  return buildFailure({
    executionId,
    failureKind: 'pipeline-failure',
    code: 'RUNTIME_MISSING_DEPENDENCY',
    message: `runtime dependencies are missing: ${dependencyLabel}`,
  })
}

export function createInsightRuntime(
  dependencies: InsightRuntimeDependencies = {},
): InsightRuntime {
  const orchestrator = hasOrchestratorShape(dependencies.orchestrator)
    ? dependencies.orchestrator
    : null

  let repository: InsightRepository | null = hasRepositoryShape(
    dependencies.repository,
  )
    ? dependencies.repository
    : null

  return {
    execute(request: InsightRuntimeRequest | null | undefined): InsightRuntimeResponse {
      const validatedRequest = validateRuntimeRequest(request)
      if (!validatedRequest.ok) {
        return buildFailure({
          executionId: validatedRequest.executionId,
          failureKind: 'invalid-request',
          code: validatedRequest.code,
          message: validatedRequest.message,
        })
      }

      if (orchestrator === null || repository === null) {
        return buildMissingDependencyFailure(validatedRequest.value.executionId, {
          missingOrchestrator: orchestrator === null,
          missingRepository: repository === null,
        })
      }

      const currentRepository = repository
      let rawResult: unknown

      try {
        rawResult = orchestrator.run({
          knowledgeCollection: deepClone(validatedRequest.value.knowledgeCollection),
          rules: deepClone(validatedRequest.value.rules),
          repository: currentRepository,
        })
      } catch {
        return buildFailure({
          executionId: validatedRequest.value.executionId,
          failureKind: 'pipeline-failure',
          code: 'RUNTIME_ORCHESTRATOR_FAILURE',
          message: 'runtime execution failed while calling orchestrator',
        })
      }

      if (!isRecord(rawResult)) {
        return buildFailure({
          executionId: validatedRequest.value.executionId,
          failureKind: 'pipeline-failure',
          code: 'RUNTIME_ORCHESTRATOR_INCONSISTENT_RESULT',
          message: 'orchestrator returned a non-object result',
        })
      }

      if (!hasValidValidationReport(rawResult.validationReport)) {
        return buildFailure({
          executionId: validatedRequest.value.executionId,
          failureKind: 'pipeline-failure',
          code: 'RUNTIME_INVALID_VALIDATION_REPORT',
          message: 'orchestrator returned an invalid validation report',
        })
      }

      if (!hasValidEngineResult(rawResult)) {
        return buildFailure({
          executionId: validatedRequest.value.executionId,
          failureKind: 'pipeline-failure',
          code: 'RUNTIME_ORCHESTRATOR_INCONSISTENT_RESULT',
          message: 'orchestrator returned an inconsistent engine result',
        })
      }

      if (rawResult.status === 'accepted') {
        if (rawResult.repositoryUpdated !== true) {
          return buildFailure({
            executionId: validatedRequest.value.executionId,
            failureKind: 'pipeline-failure',
            code: 'RUNTIME_ORCHESTRATOR_INCONSISTENT_RESULT',
            message: 'accepted engine result must update repository',
          })
        }

        if (rawResult.validationReport.status !== 'valid') {
          return buildFailure({
            executionId: validatedRequest.value.executionId,
            failureKind: 'pipeline-failure',
            code: 'RUNTIME_INVALID_VALIDATION_REPORT',
            message: 'accepted engine result must contain a valid validation report',
          })
        }

        repository = rawResult.repository

        return buildSuccess({
          executionId: validatedRequest.value.executionId,
          collection: rawResult.collection,
          assessment: rawResult.assessment,
          validationReport: rawResult.validationReport,
        })
      }

      if (rawResult.repositoryUpdated !== false) {
        return buildFailure({
          executionId: validatedRequest.value.executionId,
          failureKind: 'pipeline-failure',
          code: 'RUNTIME_ORCHESTRATOR_INCONSISTENT_RESULT',
          message: 'rejected engine result cannot update repository',
        })
      }

      if (rawResult.validationReport.status !== 'invalid') {
        return buildFailure({
          executionId: validatedRequest.value.executionId,
          failureKind: 'pipeline-failure',
          code: 'RUNTIME_INVALID_VALIDATION_REPORT',
          message: 'rejected engine result must contain an invalid validation report',
        })
      }

      return buildFailure({
        executionId: validatedRequest.value.executionId,
        failureKind: 'validation-rejected',
        code: 'RUNTIME_VALIDATION_REJECTED',
        message: 'runtime execution rejected by validation report',
        validationReport: rawResult.validationReport,
      })
    },

    getSnapshot(): InsightRuntimeSnapshot {
      if (repository === null) {
        return buildEmptySnapshot(false)
      }

      try {
        const insights = repository.getAll()
        const statistics = repository.getStatistics()

        return {
          ready: true,
          deterministic: true,
          failClosed: true,
          insightCount: insights.length,
          insights: deepClone(insights),
          statistics: deepClone(statistics),
        }
      } catch {
        return buildEmptySnapshot(false)
      }
    },

    getAll() {
      if (repository === null) {
        return []
      }

      try {
        return deepClone(repository.getAll())
      } catch {
        return []
      }
    },

    getById(id) {
      if (repository === null) {
        return null
      }

      try {
        return deepClone(repository.getById(id))
      } catch {
        return null
      }
    },

    query(inputQuery: InsightRuntimeQuery): InsightRuntimeQueryResult {
      const fallbackStatistics = buildStatisticsQueryResult(
        emptyInsightRepositoryStatistics(),
      )
      const fallbackInsights = buildInsightsQueryResult([])
      const queryKind =
        isRecord(inputQuery) && typeof inputQuery.kind === 'string'
          ? inputQuery.kind
          : null

      if (queryKind === null) {
        return fallbackInsights
      }

      if (repository === null) {
        return queryKind === 'statistics'
          ? fallbackStatistics
          : fallbackInsights
      }

      try {
        switch (inputQuery.kind) {
          case 'by-category':
            return buildInsightsQueryResult(
              repository.getByCategory(inputQuery.category),
            )
          case 'by-severity':
            return buildInsightsQueryResult(
              repository.getBySeverity(inputQuery.severity),
            )
          case 'by-status':
            return buildInsightsQueryResult(
              repository.getByStatus(inputQuery.status),
            )
          case 'by-scope':
            return buildInsightsQueryResult(
              repository.getByScope(inputQuery.filter),
            )
          case 'by-rule':
            return buildInsightsQueryResult(
              repository.getByRule(inputQuery.ruleId),
            )
          case 'by-confidence':
            return buildInsightsQueryResult(
              repository.filterByConfidence(inputQuery.filter),
            )
          case 'statistics':
            return buildStatisticsQueryResult(repository.getStatistics())
          default:
            return fallbackInsights
        }
      } catch {
        return queryKind === 'statistics'
          ? fallbackStatistics
          : fallbackInsights
      }
    },

    count(): number {
      if (repository === null) {
        return 0
      }

      try {
        return repository.count()
      } catch {
        return 0
      }
    },

    exists(id): boolean {
      if (repository === null) {
        return false
      }

      try {
        return repository.exists(id)
      } catch {
        return false
      }
    },
  }
}

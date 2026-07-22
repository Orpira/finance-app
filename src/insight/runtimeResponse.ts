import type {
  InsightBuildAssessment,
  InsightCollection,
} from './types'
import type { ValidationReport } from './validationReport'

export type InsightRuntimeFailureCode =
  | 'RUNTIME_INVALID_REQUEST'
  | 'RUNTIME_INCOMPATIBLE_KNOWLEDGE_COLLECTION'
  | 'RUNTIME_INVALID_RULE_CATALOG'
  | 'RUNTIME_MISSING_DEPENDENCY'
  | 'RUNTIME_ORCHESTRATOR_FAILURE'
  | 'RUNTIME_ORCHESTRATOR_INCONSISTENT_RESULT'
  | 'RUNTIME_INVALID_VALIDATION_REPORT'
  | 'RUNTIME_VALIDATION_REJECTED'

export type InsightRuntimeFailureKind =
  | 'invalid-request'
  | 'validation-rejected'
  | 'pipeline-failure'

export interface InsightRuntimeSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly executionId: string
  readonly deterministic: true
  readonly failClosed: true
  readonly repositoryUpdated: true
  readonly collection: InsightCollection
  readonly assessment: InsightBuildAssessment
  readonly validationReport: ValidationReport
}

export interface InsightRuntimeFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly executionId: string | null
  readonly deterministic: true
  readonly failClosed: true
  readonly failureKind: InsightRuntimeFailureKind
  readonly code: InsightRuntimeFailureCode
  readonly message: string
  readonly validationReport?: ValidationReport
}

export type InsightRuntimeResponse =
  | InsightRuntimeSuccess
  | InsightRuntimeFailure

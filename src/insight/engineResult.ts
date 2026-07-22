import type { InsightRepository } from './repositoryInterfaces'
import type {
  InsightBuildAssessment,
  InsightCollection,
} from './types'
import type { ValidationReport } from './validationReport'

export type InsightEngineStatus = 'accepted' | 'rejected'

export interface InsightEngineResult {
  readonly status: InsightEngineStatus
  readonly deterministic: true
  readonly failClosed: true
  readonly repositoryUpdated: boolean
  readonly collection: InsightCollection
  readonly assessment: InsightBuildAssessment
  readonly validationReport: ValidationReport
  readonly repository: InsightRepository
}
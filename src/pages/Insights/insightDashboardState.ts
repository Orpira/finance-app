import type {
  InsightExecutionFailureCode,
} from '../../services/insightExecutionResult'
import type {
  InsightReadModelProjection,
} from '../../services/readModelInterfaces'

export type InsightDashboardRejectedCode =
  | InsightExecutionFailureCode
  | 'INSIGHT_DASHBOARD_SNAPSHOT_UNAVAILABLE'

export type InsightDashboardErrorCode =
  | 'INSIGHT_DASHBOARD_UNEXPECTED_ERROR'
  | 'INSIGHT_DASHBOARD_INVALID_READ_MODEL'

export interface InsightDashboardIdleState {
  readonly status: 'idle'
}

export interface InsightDashboardLoadingState {
  readonly status: 'loading'
}

export interface InsightDashboardSuccessState {
  readonly status: 'success'
  readonly projection: InsightReadModelProjection
}

export interface InsightDashboardEmptyState {
  readonly status: 'empty'
  readonly projection: InsightReadModelProjection
}

export interface InsightDashboardRejectedState {
  readonly status: 'rejected'
  readonly code: InsightDashboardRejectedCode
  readonly message: string
  readonly executionId: string | null
}

export interface InsightDashboardErrorState {
  readonly status: 'error'
  readonly code: InsightDashboardErrorCode
  readonly message: string
}

export type InsightDashboardState =
  | InsightDashboardIdleState
  | InsightDashboardLoadingState
  | InsightDashboardSuccessState
  | InsightDashboardEmptyState
  | InsightDashboardRejectedState
  | InsightDashboardErrorState

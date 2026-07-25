import type {
  InsightDashboardUseCaseError,
  InsightDashboardViewModel,
} from './insightDashboardContracts'

export interface InsightDashboardIdleState {
  readonly status: 'idle'
}

export interface InsightDashboardLoadingState {
  readonly status: 'loading'
}

export interface InsightDashboardSuccessState {
  readonly status: 'success'
  readonly data: InsightDashboardViewModel
}

export interface InsightDashboardEmptyState {
  readonly status: 'empty'
  readonly data: InsightDashboardViewModel
}

export interface InsightDashboardPartialState {
  readonly status: 'partial'
  readonly data: InsightDashboardViewModel
}

export interface InsightDashboardErrorState {
  readonly status: 'error'
  readonly error: InsightDashboardUseCaseError
}

export type InsightDashboardState =
  | InsightDashboardIdleState
  | InsightDashboardLoadingState
  | InsightDashboardSuccessState
  | InsightDashboardEmptyState
  | InsightDashboardPartialState
  | InsightDashboardErrorState

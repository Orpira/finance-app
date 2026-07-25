import {
  createInsightDashboardUseCase,
} from './insightDashboardUseCase'
import type {
  InsightDashboardControllerDependencies,
} from './insightDashboardController'

export function createInsightDashboardDependencies(): InsightDashboardControllerDependencies {
  return {
    useCase: createInsightDashboardUseCase(),
  }
}

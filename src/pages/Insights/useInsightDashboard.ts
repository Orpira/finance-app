import { useEffect, useMemo, useState } from 'react'

import {
  createInsightDashboardController,
  type InsightDashboardControllerDependencies,
} from './insightDashboardController'
import type { InsightDashboardState } from './insightDashboardState'

export interface InsightDashboardHookResult {
  readonly state: InsightDashboardState
  readonly reload: () => Promise<void>
}

export function useInsightDashboard(
  dependencies: InsightDashboardControllerDependencies,
): InsightDashboardHookResult {
  const controller = useMemo(
    () => createInsightDashboardController(dependencies),
    [dependencies],
  )

  const [state, setState] = useState<InsightDashboardState>(
    controller.getState(),
  )

  useEffect(() => {
    const unsubscribe = controller.subscribe((nextState) => {
      setState(nextState)
    })

    void controller.load()

    return () => {
      unsubscribe()
      controller.dispose()
    }
  }, [controller])

  return {
    state,
    reload: () => controller.load(),
  }
}

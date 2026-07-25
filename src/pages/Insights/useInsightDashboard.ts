import { useEffect, useRef, useState } from 'react'

import {
  createInsightDashboardController,
  type InsightDashboardController,
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
  const [state, setState] = useState<InsightDashboardState>({ status: 'idle' })
  const controllerRef = useRef<InsightDashboardController | null>(null)

  useEffect(() => {
    const controller = createInsightDashboardController(dependencies)
    controllerRef.current = controller

    const unsubscribe = controller.subscribe((nextState) => {
      setState(nextState)
    })

    void controller.load()

    return () => {
      unsubscribe()
      controller.dispose()
      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
    }
  }, [dependencies])

  return {
    state,
    reload: () => controllerRef.current?.load({ force: true }) ?? Promise.resolve(),
  }
}

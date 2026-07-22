import { InsightList } from './InsightList'
import { InsightSummary } from './InsightSummary'
import {
  InsightEmptyView,
  InsightErrorView,
  InsightLoadingView,
  InsightRejectedView,
} from './InsightStateViews'
import type { InsightDashboardState } from './insightDashboardState'

interface InsightDashboardProps {
  readonly state: InsightDashboardState
  readonly onReload: () => void
}

export function InsightDashboard({ state, onReload }: InsightDashboardProps) {
  if (state.status === 'idle' || state.status === 'loading') {
    return <InsightLoadingView />
  }

  if (state.status === 'rejected') {
    return <InsightRejectedView onReload={onReload} state={state} />
  }

  if (state.status === 'error') {
    return <InsightErrorView onReload={onReload} state={state} />
  }

  if (state.status === 'empty') {
    return (
      <div className="grid gap-4">
        <InsightSummary projection={state.projection} />
        <InsightEmptyView onReload={onReload} />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <InsightSummary projection={state.projection} />
      <InsightList projection={state.projection} />
    </div>
  )
}

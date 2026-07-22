import { useMemo } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { InsightDashboard } from './InsightDashboard'
import { createInsightDashboardDependencies } from './insightDashboardComposition'
import { useInsightDashboard } from './useInsightDashboard'

export function InsightDashboardPage() {
  const dependencies = useMemo(() => createInsightDashboardDependencies(), [])
  const { state, reload } = useInsightDashboard(dependencies)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        backLabel="Resumen completo"
        backTo="/resumen-completo"
        eyebrow="Insight Engine"
        title="Dashboard de insights"
      />

      <InsightDashboard
        onReload={() => {
          void reload()
        }}
        state={state}
      />
    </section>
  )
}

export default InsightDashboardPage

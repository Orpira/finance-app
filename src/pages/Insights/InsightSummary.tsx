import type {
  InsightDashboardViewModel,
} from './insightDashboardContracts'

interface InsightSummaryProps {
  readonly viewModel: InsightDashboardViewModel
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function InsightSummary({ viewModel }: InsightSummaryProps) {
  return (
    <section
      aria-labelledby="insights-summary-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2
        className="text-lg font-semibold text-slate-950"
        id="insights-summary-title"
      >
        Resumen general de insights
      </h2>

      <p className="mt-2 text-sm text-slate-600">{viewModel.subtitle}</p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Balance neto
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {formatCurrency(viewModel.summary.netBalance, viewModel.summary.currency)}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ingresos
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {formatCurrency(viewModel.summary.incomeTotal, viewModel.summary.currency)}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Egresos
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {formatCurrency(viewModel.summary.expenseTotal, viewModel.summary.currency)}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ajustes
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {formatCurrency(viewModel.summary.adjustmentTotal, viewModel.summary.currency)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <p>
          Estado de datos:{' '}
          <strong className="text-slate-900">
            {viewModel.dataStatus === 'partial' ? 'Parcial' : 'Completo'}
          </strong>
        </p>
        <p>
          Insights priorizados:{' '}
          <strong className="text-slate-900">
            {viewModel.insights.length}
          </strong>
        </p>
        <p>
          Acciones recomendadas:{' '}
          <strong className="text-slate-900">
            {viewModel.recommendedActions.length}
          </strong>
        </p>
        <p>
          Ultima actualizacion:{' '}
          <strong className="text-slate-900">
            {viewModel.generatedAtLabel}
          </strong>
        </p>
      </div>
    </section>
  )
}

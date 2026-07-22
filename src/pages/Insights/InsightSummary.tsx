import type {
  InsightReadModelProjection,
} from '../../services/readModelInterfaces'

interface InsightSummaryProps {
  readonly projection: InsightReadModelProjection
}

function formatConfidence(value: number | null): string {
  if (value === null) {
    return 'N/D'
  }

  return `${value.toFixed(1)}%`
}

export function InsightSummary({ projection }: InsightSummaryProps) {
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

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total de insights
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {projection.summary.totalInsights}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reglas generadas
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {projection.summary.generatedRules}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Reglas omitidas
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {projection.summary.skippedRules}
          </dd>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Confianza promedio
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-950">
            {formatConfidence(projection.confidenceIndicators.averageScore)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
        <p>
          Estado runtime:{' '}
          <strong className="text-slate-900">
            {projection.updateMetadata.runtimeStatus}
          </strong>
        </p>
        <p>
          Issues de validacion:{' '}
          <strong className="text-slate-900">
            {projection.statistics.validationIssueCount}
          </strong>
        </p>
        <p>
          Min confianza:{' '}
          <strong className="text-slate-900">
            {formatConfidence(projection.confidenceIndicators.minimumScore)}
          </strong>
        </p>
        <p>
          Max confianza:{' '}
          <strong className="text-slate-900">
            {formatConfidence(projection.confidenceIndicators.maximumScore)}
          </strong>
        </p>
      </div>
    </section>
  )
}

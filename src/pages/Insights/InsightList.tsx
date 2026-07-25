import type {
  InsightDashboardViewModel,
} from './insightDashboardContracts'

interface InsightListProps {
  readonly viewModel: InsightDashboardViewModel
}

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  budget: 'Presupuesto',
  goal: 'Meta',
  expense: 'Egreso',
  income: 'Ingreso',
  subscription: 'Suscripcion',
  health: 'Salud financiera',
}

const SEVERITY_LABELS: Readonly<Record<string, string>> = {
  CRITICAL: 'Critica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
  INFO: 'Informativa',
}

function labelFromMap(
  map: Readonly<Record<string, string>>,
  value: string,
): string {
  return map[value] ?? value
}

export function InsightList({ viewModel }: InsightListProps) {
  return (
    <section
      aria-labelledby="insights-list-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950" id="insights-list-title">
        Lista de insights
      </h2>

      <ul aria-label="Insights proyectados" className="mt-4 grid gap-3" role="list">
        {viewModel.insights.map((insight) => (
          <li key={insight.id}>
            <article className="rounded-lg border border-slate-200 p-4">
              <header className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Categoria: {labelFromMap(CATEGORY_LABELS, insight.category)}
                </span>
                <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Severidad: {labelFromMap(SEVERITY_LABELS, insight.severity)}
                </span>
                <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Prioridad: {labelFromMap(SEVERITY_LABELS, insight.priority)}
                </span>
              </header>

              <div className="mt-3 grid gap-1 text-sm text-slate-700">
                <p>
                  <strong>Titulo:</strong> {insight.title}
                </p>
                <p>
                  <strong>Descripcion:</strong> {insight.description}
                </p>
                <p>
                  <strong>Recomendacion:</strong> {insight.recommendation}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {viewModel.actionPlan === null ? null : (
        <article className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <h3 className="text-base font-semibold">Financial Action Plan</h3>
          <p className="mt-1 font-medium">{viewModel.actionPlan.title}</p>
          <p className="mt-2">{viewModel.actionPlan.summary}</p>
          <p className="mt-2">
            <strong>Objetivo:</strong> {viewModel.actionPlan.objective}
          </p>
          <p className="mt-1">
            <strong>Impacto estimado:</strong> {viewModel.actionPlan.estimatedImpact}
          </p>
        </article>
      )}

      {viewModel.recommendedActions.length === 0 ? null : (
        <section className="mt-6">
          <h3 className="text-base font-semibold text-slate-900">
            Acciones recomendadas
          </h3>
          <ul className="mt-3 grid gap-3" role="list">
            {viewModel.recommendedActions.map((action) => (
              <li key={action.id}>
                <article className="rounded-lg border border-slate-200 p-4 text-sm text-slate-700">
                  <p>
                    <strong>Tipo:</strong> {action.type}
                  </p>
                  <p>
                    <strong>Descripcion:</strong> {action.description}
                  </p>
                  <p>
                    <strong>Beneficio esperado:</strong> {action.expectedBenefit}
                  </p>
                  <p>
                    <strong>Prioridad:</strong> {action.priority}
                  </p>
                  <p>
                    <strong>Esfuerzo:</strong> {action.effort}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}

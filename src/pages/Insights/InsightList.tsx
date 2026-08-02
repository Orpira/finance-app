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
  subscription: 'Suscripción',
  health: 'Salud financiera',
}

const SEVERITY_LABELS: Readonly<Record<string, string>> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
  INFO: 'Informativa',
}

const ACTION_TYPE_LABELS: Readonly<Record<string, string>> = {
  'budget-optimization': 'Optimización del presupuesto',
  'cashflow-stabilization': 'Estabilización del flujo de caja',
  'expense-reduction': 'Reducción de gastos',
  'financial-health-improvement': 'Mejora de la salud financiera',
  'goal-recovery': 'Recuperación de objetivos',
  'savings-improvement': 'Mejora del ahorro',
}

const EFFORT_LABELS: Readonly<Record<string, string>> = {
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
}

const IMPACT_LABELS: Readonly<Record<string, string>> = {
  HIGH: 'Alto',
  MEDIUM: 'Medio',
  LOW: 'Bajo',
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
        Análisis priorizados
      </h2>

      <ul aria-label="Análisis priorizados" className="mt-4 grid gap-3" role="list">
        {viewModel.insights.map((insight) => (
          <li key={insight.id}>
            <article className="rounded-lg border border-slate-200 p-4">
              <header className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Categoría: {labelFromMap(CATEGORY_LABELS, insight.category)}
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
                  <strong>Título:</strong> {insight.title}
                </p>
                <p>
                  <strong>Descripción:</strong> {insight.description}
                </p>
                <p>
                  <strong>Recomendación:</strong> {insight.recommendation}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {viewModel.actionPlan === null ? null : (
        <article className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <h3 className="text-base font-semibold">Plan de acción financiera</h3>
          <p className="mt-1 font-medium">{viewModel.actionPlan.title}</p>
          <p className="mt-2">{viewModel.actionPlan.summary}</p>
          <p className="mt-2">
            <strong>Objetivo:</strong> {viewModel.actionPlan.objective}
          </p>
          <p className="mt-1">
            <strong>Impacto estimado:</strong>{' '}
            {labelFromMap(IMPACT_LABELS, viewModel.actionPlan.estimatedImpact)}
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
                    <strong>Tipo:</strong> {labelFromMap(ACTION_TYPE_LABELS, action.type)}
                  </p>
                  <p>
                    <strong>Descripción:</strong> {action.description}
                  </p>
                  <p>
                    <strong>Beneficio esperado:</strong> {action.expectedBenefit}
                  </p>
                  <p>
                    <strong>Prioridad:</strong> {labelFromMap(SEVERITY_LABELS, action.priority)}
                  </p>
                  <p>
                    <strong>Esfuerzo:</strong> {labelFromMap(EFFORT_LABELS, action.effort)}
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

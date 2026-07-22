import type {
  InsightReadModelProjection,
} from '../../services/readModelInterfaces'

interface InsightListProps {
  readonly projection: InsightReadModelProjection
}

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  'cash-flow': 'Flujo de caja',
  spending: 'Gasto',
  income: 'Ingreso',
  savings: 'Ahorro',
  balance: 'Balance',
  trend: 'Tendencia',
  anomaly: 'Anomalia',
  recurring: 'Recurrencia',
  'data-quality': 'Calidad de datos',
}

const SEVERITY_LABELS: Readonly<Record<string, string>> = {
  info: 'Informativa',
  notice: 'Aviso',
  warning: 'Advertencia',
  critical: 'Critica',
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  generated: 'Generado',
  skipped: 'Omitido',
}

function labelFromMap(
  map: Readonly<Record<string, string>>,
  value: string,
): string {
  return map[value] ?? value
}

export function InsightList({ projection }: InsightListProps) {
  return (
    <section
      aria-labelledby="insights-list-title"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-950" id="insights-list-title">
        Lista de insights
      </h2>

      <ul aria-label="Insights proyectados" className="mt-4 grid gap-3" role="list">
        {projection.insights.map((insight) => (
          <li key={insight.insightId}>
            <article className="rounded-lg border border-slate-200 p-4">
              <header className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Categoria: {labelFromMap(CATEGORY_LABELS, insight.category)}
                </span>
                <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Severidad: {labelFromMap(SEVERITY_LABELS, insight.severity)}
                </span>
                <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  Estado: {labelFromMap(STATUS_LABELS, insight.executionStatus)}
                </span>
              </header>

              <div className="mt-3 grid gap-1 text-sm text-slate-700">
                <p>
                  <strong>Titulo:</strong> {insight.titleCode}
                </p>
                <p>
                  <strong>Mensaje:</strong> {insight.messageCode}
                </p>
                <p>
                  <strong>Confianza:</strong> {insight.confidence.score.toFixed(1)}%
                </p>
                <p>
                  <strong>Trazabilidad:</strong> {insight.traceability.sourceSnapshotKey}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

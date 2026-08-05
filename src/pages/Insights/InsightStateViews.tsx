import { ActionableEmptyState } from '../../components/ActionableEmptyState'
import type {
  InsightDashboardUseCaseError,
} from './insightDashboardContracts'

interface InsightStateViewProps {
  readonly onReload: () => void
}

interface InsightPartialViewProps extends InsightStateViewProps {
  readonly warnings: readonly string[]
}

interface InsightErrorViewProps extends InsightStateViewProps {
  readonly error: InsightDashboardUseCaseError
}

interface InsightEmptyViewProps {
  readonly hasData?: boolean
  readonly onReload?: () => void
}

function ReloadButton({ onReload }: InsightStateViewProps) {
  return (
    <button
      className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
      onClick={onReload}
      type="button"
    >
      Reintentar
    </button>
  )
}

export function InsightLoadingView() {
  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm"
      role="status"
    >
      Cargando análisis financiero...
    </section>
  )
}

export function InsightEmptyView({
  hasData = false,
  onReload,
}: InsightEmptyViewProps = {}) {
  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm"
    >
      <ActionableEmptyState
        action={hasData && onReload
          ? { label: 'Actualizar análisis', onClick: onReload }
          : { label: 'Registrar ingreso', to: '/income/nuevo' }}
        compact
        description={hasData
          ? 'Tus datos financieros están disponibles, pero no generan recomendaciones en este momento.'
          : 'Registra ingresos o egresos para comenzar a generar tu análisis financiero.'}
        title={hasData
          ? 'No hay recomendaciones por ahora'
          : 'Aún no hay suficientes datos financieros'}
      />
    </section>
  )
}

export function InsightRejectedView({
  warnings,
  onReload,
}: InsightPartialViewProps) {
  return (
    <section
      aria-live="assertive"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
      role="alert"
    >
      <p className="font-semibold">Contenido parcial disponible</p>
      <p className="mt-1">
        Se cargó parte del análisis, pero el procesamiento no pudo completarse.
      </p>
      {warnings.length === 0 ? null : (
        <ul className="mt-2 list-disc pl-5 text-xs">
          {warnings.map((warning, index) => (
            <li key={`${warning}-${String(index)}`}>{warning}</li>
          ))}
        </ul>
      )}
      <div className="mt-4">
        <ReloadButton onReload={onReload} />
      </div>
    </section>
  )
}

export function InsightErrorView({ error, onReload }: InsightErrorViewProps) {
  return (
    <section
      aria-live="assertive"
      className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm"
      role="alert"
    >
      <p className="font-semibold">Error al cargar el análisis</p>
      <p className="mt-1">{error.message}</p>
      <p className="mt-2 text-xs">
        Código de error: <strong>{error.code}</strong>
      </p>
      <div className="mt-4">
        <ReloadButton onReload={onReload} />
      </div>
    </section>
  )
}

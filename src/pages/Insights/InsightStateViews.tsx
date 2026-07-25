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
      Cargando insights del dashboard...
    </section>
  )
}

export function InsightEmptyView({ onReload }: InsightStateViewProps) {
  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm"
      role="status"
    >
      <p className="font-semibold text-slate-900">Aun no hay suficientes datos financieros</p>
      <p className="mt-1">
        Registra ingresos o egresos para comenzar y generar insights del dashboard.
      </p>
      <div className="mt-4">
        <ReloadButton onReload={onReload} />
      </div>
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
        Se cargaron insights, pero una parte del procesamiento no pudo completarse.
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
      <p className="font-semibold">Error al cargar insights</p>
      <p className="mt-1">{error.message}</p>
      <p className="mt-2 text-xs">
        Codigo de error: <strong>{error.code}</strong>
      </p>
      <div className="mt-4">
        <ReloadButton onReload={onReload} />
      </div>
    </section>
  )
}

import type {
  InsightDashboardErrorState,
  InsightDashboardRejectedState,
} from './insightDashboardState'

interface InsightStateViewProps {
  readonly onReload: () => void
}

interface InsightRejectedViewProps extends InsightStateViewProps {
  readonly state: InsightDashboardRejectedState
}

interface InsightErrorViewProps extends InsightStateViewProps {
  readonly state: InsightDashboardErrorState
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
      <p className="font-semibold text-slate-900">No hay insights disponibles</p>
      <p className="mt-1">
        La ejecucion fue valida, pero no se generaron insights para este contexto.
      </p>
      <div className="mt-4">
        <ReloadButton onReload={onReload} />
      </div>
    </section>
  )
}

export function InsightRejectedView({
  state,
  onReload,
}: InsightRejectedViewProps) {
  return (
    <section
      aria-live="assertive"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm"
      role="alert"
    >
      <p className="font-semibold">Ejecucion de insights rechazada</p>
      <p className="mt-1">{state.message}</p>
      <p className="mt-2 text-xs">
        Codigo de rechazo: <strong>{state.code}</strong>
      </p>
      {state.executionId === null ? null : (
        <p className="mt-1 text-xs">
          Referencia de ejecucion: <strong>{state.executionId}</strong>
        </p>
      )}
      <div className="mt-4">
        <ReloadButton onReload={onReload} />
      </div>
    </section>
  )
}

export function InsightErrorView({ state, onReload }: InsightErrorViewProps) {
  return (
    <section
      aria-live="assertive"
      className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-sm"
      role="alert"
    >
      <p className="font-semibold">Error al cargar insights</p>
      <p className="mt-1">{state.message}</p>
      <p className="mt-2 text-xs">
        Codigo de error: <strong>{state.code}</strong>
      </p>
      <div className="mt-4">
        <ReloadButton onReload={onReload} />
      </div>
    </section>
  )
}

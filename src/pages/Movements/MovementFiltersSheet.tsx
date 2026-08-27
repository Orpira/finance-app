import { SlidersHorizontal } from 'lucide-react'
import { useRef, useState } from 'react'

import { DialogFrame } from '../../components/dialogs/DialogFrame'
import type { MovementFilters, MovementPeriod } from './movementFilters'

interface MovementFiltersSheetProps {
  readonly categories: readonly string[]
  readonly currencies: readonly string[]
  readonly defaultFilters: MovementFilters
  readonly filters: MovementFilters
  readonly onApply: (filters: MovementFilters) => void
  readonly onCancel: () => void
}

const fieldClassName =
  'h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-900'

export function MovementFiltersSheet({
  categories,
  currencies,
  defaultFilters,
  filters,
  onApply,
  onCancel,
}: MovementFiltersSheetProps) {
  const [draft, setDraft] = useState(filters)
  const periodRef = useRef<HTMLSelectElement>(null)
  const customRangeIsInvalid = draft.period === 'custom' && (
    draft.dateFrom === '' ||
    draft.dateTo === '' ||
    draft.dateFrom > draft.dateTo
  )

  function updateDraft(updates: Partial<MovementFilters>) {
    setDraft((current) => ({ ...current, ...updates }))
  }

  function selectPeriod(period: MovementPeriod) {
    const customDates = period === 'custom' && (!draft.dateFrom || !draft.dateTo)
      ? {
          dateFrom: `${defaultFilters.anchorDate.slice(0, 7)}-01`,
          dateTo: defaultFilters.anchorDate,
        }
      : {}

    updateDraft({
      period,
      anchorDate: defaultFilters.anchorDate,
      ...customDates,
    })
  }

  return (
    <DialogFrame
      actions={(
        <>
          <button
            className="h-11 rounded-md px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setDraft(defaultFilters)}
            type="button"
          >
            Restablecer
          </button>
          <button
            className="h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 dark:focus:ring-offset-slate-900"
            disabled={customRangeIsInvalid}
            onClick={() => onApply(draft)}
            type="button"
          >
            Aplicar
          </button>
        </>
      )}
      icon={<SlidersHorizontal aria-hidden="true" className="size-5" />}
      iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      initialFocusRef={periodRef}
      onCancel={onCancel}
      open
      title="Filtrar movimientos"
    >
      <div className="max-h-[min(45dvh,34rem)] space-y-4 overflow-y-auto pr-1">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Período</span>
          <select
            className={fieldClassName}
            onChange={(event) => selectPeriod(event.target.value as MovementPeriod)}
            ref={periodRef}
            value={draft.period}
          >
            <option value="all">Todo el historial</option>
            <option value="today">Hoy</option>
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>

        {draft.period === 'custom' && (
          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="sr-only">Rango personalizado</legend>
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Desde</span>
              <input
                className={`${fieldClassName} min-w-0`}
                max={draft.dateTo || undefined}
                onChange={(event) => updateDraft({ dateFrom: event.target.value })}
                type="date"
                value={draft.dateFrom}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Hasta</span>
              <input
                className={`${fieldClassName} min-w-0`}
                min={draft.dateFrom || undefined}
                onChange={(event) => updateDraft({ dateTo: event.target.value })}
                type="date"
                value={draft.dateTo}
              />
            </label>
            {customRangeIsInvalid && (
              <p aria-live="polite" className="col-span-2 text-sm text-red-600" role="alert">
                Selecciona un rango de fechas válido.
              </p>
            )}
          </fieldset>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo</span>
            <select
              className={fieldClassName}
              onChange={(event) => updateDraft({ type: event.target.value as MovementFilters['type'] })}
              value={draft.type}
            >
              <option value="all">Todos</option>
              <option value="income">Ingresos</option>
              <option value="expense">Gastos</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Categoría</span>
            <select
              className={fieldClassName}
              onChange={(event) => updateDraft({ category: event.target.value })}
              value={draft.category}
            >
              <option value="">Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Moneda</span>
            <select
              className={fieldClassName}
              onChange={(event) => updateDraft({ currency: event.target.value })}
              value={draft.currency}
            >
              <option value="">Todas</option>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Estado de reporte</span>
            <select
              className={fieldClassName}
              onChange={(event) => updateDraft({ reported: event.target.value as MovementFilters['reported'] })}
              value={draft.reported}
            >
              <option value="all">Cualquier estado</option>
              <option value="reported">Reportados</option>
              <option value="unreported">Sin reportar</option>
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Orden</span>
          <select
            className={fieldClassName}
            onChange={(event) => updateDraft({ order: event.target.value as MovementFilters['order'] })}
            value={draft.order}
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="amount_desc">Mayor importe</option>
            <option value="amount_asc">Menor importe</option>
          </select>
        </label>
      </div>
    </DialogFrame>
  )
}

export default MovementFiltersSheet
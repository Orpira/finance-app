import { CalendarClock, ChevronDown, History, Target } from 'lucide-react'
import { useState } from 'react'

import { reviseSeasonEconomicGoal, reviseSeasonPlannedEnd } from '../../../services/seasonRevisionService'
import type { EarningPeriod } from '../../../types/earningPeriod'
import type { SeasonRevision } from '../../../types/seasonRevision'
import type { CurrencyCode } from '../../../types/settings'
import { formatCurrency } from '../../../utils/currency'
import { GeoFormDialog, geoInputClassName } from './GeoFormDialog'
import { describeSeasonGeoError } from './seasonGeoMessages'
import { describeRevision } from './revisionPresentation'
import { formatCivilDate, formatRevisionDate } from './stayPresentation'

type RevisionDialog = 'plannedEnd' | 'goal' | null

export function SeasonRevisionPanel({
  season,
  revisions,
  onChanged,
}: {
  season: EarningPeriod
  revisions: readonly SeasonRevision[]
  onChanged: () => Promise<void> | void
}) {
  const currency = season.baseCurrency ?? 'EUR'
  const isActive = season.status === 'active'
  const [dialog, setDialog] = useState<RevisionDialog>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ordered = [...revisions].sort((left, right) => right.sequence - left.sequence)

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await action()
      setDialog(null)
      await onChanged()
    } catch (reason) {
      setError(describeSeasonGeoError(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><History aria-hidden="true" className="size-5 text-slate-500" /> Planificación</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Finalización prevista {formatCivilDate(season.plannedEndDate?.slice(0, 10))} · Objetivo {season.economicGoal ? formatCurrency(season.economicGoal, currency) : 'sin definir'}
          </p>
        </div>
        {isActive && (
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600" onClick={() => { setError(''); setDialog('plannedEnd') }} type="button">
              <CalendarClock aria-hidden="true" className="size-4" /> Revisar fecha prevista
            </button>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600" onClick={() => { setError(''); setDialog('goal') }} type="button">
              <Target aria-hidden="true" className="size-4" /> Revisar objetivo
            </button>
          </div>
        )}
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>Historial de revisiones ({revisions.length})</span>
          <ChevronDown aria-hidden="true" className="size-4 text-slate-400 transition-transform group-open:rotate-180" />
        </summary>
        {ordered.length ? (
          <ol className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {ordered.map((revision) => {
              const description = describeRevision(revision, currency)
              return (
                <li className="py-2 text-sm" key={revision.id ?? revision.sequence}>
                  <p className="font-medium">{description.title}</p>
                  <p className="text-slate-600 dark:text-slate-300">{description.detail}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatRevisionDate(revision.recordedAt)}{revision.reason ? ` · Motivo: ${revision.reason}` : ''}
                  </p>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Sin revisiones registradas.</p>
        )}
      </details>

      {dialog === 'plannedEnd' && (
        <PlannedEndDialog
          busy={busy}
          error={error}
          onCancel={() => !busy && setDialog(null)}
          onSubmit={(input) => run(() => reviseSeasonPlannedEnd({ earningPeriodId: season.id!, ...input }))}
          season={season}
        />
      )}
      {dialog === 'goal' && (
        <GoalDialog
          busy={busy}
          currency={currency}
          error={error}
          onCancel={() => !busy && setDialog(null)}
          onSubmit={(input) => run(() => reviseSeasonEconomicGoal({ earningPeriodId: season.id!, ...input }))}
          season={season}
        />
      )}
    </section>
  )
}

function PlannedEndDialog({ season, busy, error, onCancel, onSubmit }: {
  season: EarningPeriod
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (input: { plannedEndDate: string; mode: 'extension' | 'correction'; reason?: string }) => void
}) {
  const current = season.plannedEndDate?.slice(0, 10) ?? ''
  const [mode, setMode] = useState<'extension' | 'correction'>('extension')
  const [date, setDate] = useState(current)
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState('')

  function submit() {
    if (!date) {
      setLocalError('Indica una fecha.')
      return
    }
    if (mode === 'extension' && current && date <= current) {
      setLocalError('Una ampliación debe ser posterior a la fecha vigente. Para adelantarla usa «Corrección».')
      return
    }
    if (mode === 'correction' && !reason.trim()) {
      setLocalError('La corrección requiere un motivo.')
      return
    }
    setLocalError('')
    onSubmit({ plannedEndDate: date, mode, reason: reason.trim() || undefined })
  }

  return (
    <GeoFormDialog
      busy={busy}
      error={localError || error}
      icon={<CalendarClock className="size-6" aria-hidden="true" />}
      message={`Fecha vigente: ${formatCivilDate(current || null)}. El valor anterior queda en el historial. La fecha prevista no cierra la temporada.`}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel="Guardar revisión"
      title="Revisar fecha prevista"
    >
      <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label="Tipo de revisión">
        <label className="flex items-center gap-2"><input checked={mode === 'extension'} name="planned-end-mode" onChange={() => setMode('extension')} type="radio" /> Ampliación</label>
        <label className="flex items-center gap-2"><input checked={mode === 'correction'} name="planned-end-mode" onChange={() => setMode('correction')} type="radio" /> Corrección</label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">
        Nueva fecha prevista
        <input className={geoInputClassName} min={season.startDate.slice(0, 10)} onChange={(event) => setDate(event.target.value)} required type="date" value={date} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Motivo{mode === 'correction' ? '' : ' (opcional)'}
        <textarea className="min-h-20 rounded-md border border-slate-300 p-3 text-base dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setReason(event.target.value)} value={reason} />
      </label>
    </GeoFormDialog>
  )
}

function GoalDialog({ season, currency, busy, error, onCancel, onSubmit }: {
  season: EarningPeriod
  currency: CurrencyCode
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (input: { economicGoal: number; reason?: string }) => void
}) {
  const [amount, setAmount] = useState(season.economicGoal ? String(season.economicGoal) : '')
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState('')

  function submit() {
    const economicGoal = Number(amount.replace(',', '.'))
    if (!Number.isFinite(economicGoal) || economicGoal <= 0) {
      setLocalError('El objetivo debe ser mayor a cero.')
      return
    }
    if (economicGoal === season.economicGoal) {
      setLocalError('El objetivo no ha cambiado.')
      return
    }
    setLocalError('')
    onSubmit({ economicGoal, reason: reason.trim() || undefined })
  }

  return (
    <GeoFormDialog
      busy={busy}
      error={localError || error}
      icon={<Target className="size-6" aria-hidden="true" />}
      message={`Objetivo vigente: ${season.economicGoal ? formatCurrency(season.economicGoal, currency) : 'sin definir'}. El objetivo original se conserva y seguirá visible.`}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel="Guardar revisión"
      title="Revisar objetivo económico"
    >
      <label className="grid gap-1.5 text-sm font-medium">
        Nuevo objetivo ({currency})
        <input className={geoInputClassName} inputMode="decimal" min="0.01" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Motivo (opcional)
        <textarea className="min-h-20 rounded-md border border-slate-300 p-3 text-base dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setReason(event.target.value)} value={reason} />
      </label>
    </GeoFormDialog>
  )
}

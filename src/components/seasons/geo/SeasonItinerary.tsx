import {
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle2,
  MapPin,
  MapPinned,
  Pencil,
  PlayCircle,
  Plus,
  Repeat,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  cancelPlannedSeasonStay,
  completeSeasonStay,
  correctSeasonStay,
  createPlannedSeasonStay,
  reorderSeasonStays,
  switchActiveSeasonStay,
  type CorrectStayInput,
} from '../../../services/seasonStayService'
import type { Appointment } from '../../../types/appointment'
import type { EarningPeriod } from '../../../types/earningPeriod'
import type { Expense } from '../../../types/expense'
import type { SeasonStay } from '../../../types/seasonStay'
import type { ServiceIncome } from '../../../types/service'
import { fallbackCityOptions } from '../../../utils/countries'
import { GeoFormDialog, geoInputClassName } from './GeoFormDialog'
import { describeSeasonGeoError } from './seasonGeoMessages'
import {
  STAY_STATUS_LABELS,
  buildItinerary,
  countryLabel,
  currentTimeZone,
  formatGap,
  formatStayPeriod,
  formatVisitNumber,
  isoToLocalDateTimeInput,
  localDateTimeInputToIso,
} from './stayPresentation'

export interface SeasonItineraryRecords {
  incomes: ServiceIncome[]
  expenses: Expense[]
  appointments: Appointment[]
}

type DialogState =
  | { kind: 'plan' }
  | { kind: 'switchNew' }
  | { kind: 'activate'; stay: SeasonStay }
  | { kind: 'complete'; stay: SeasonStay }
  | { kind: 'correct'; stay: SeasonStay }
  | { kind: 'cancel'; stay: SeasonStay }

const STATUS_BADGE: Record<SeasonStay['status'], string> = {
  planned: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  completed: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
}

function nowLocalInput() {
  return isoToLocalDateTimeInput(new Date().toISOString())
}

function formatAppointmentDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function SeasonItinerary({
  season,
  stays,
  records,
  onChanged,
}: {
  season: EarningPeriod
  stays: readonly SeasonStay[]
  records: SeasonItineraryRecords
  onChanged: () => Promise<void> | void
}) {
  const isActiveSeason = season.status === 'active'
  const entries = useMemo(() => buildItinerary(stays), [stays])
  const activeStay = stays.find((stay) => stay.status === 'active')
  const undatedPlannedIds = stays
    .filter((stay) => stay.status === 'planned' && !stay.plannedStartDate && stay.id !== undefined)
    .map((stay) => stay.id!)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')

  function open(next: DialogState) {
    setError('')
    setActionError('')
    setDialog(next)
  }

  function close() {
    if (busy) return
    setDialog(null)
    setError('')
  }

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

  async function move(stayId: number, direction: -1 | 1) {
    const index = undatedPlannedIds.indexOf(stayId)
    const target = undatedPlannedIds[index + direction]
    if (index < 0 || target === undefined) return
    // reorderSeasonStays exige el itinerario completo: solo se intercambian
    // las posiciones de dos planes sin fecha; el resto conserva su posición.
    const ordered = [...stays].sort((left, right) => left.position - right.position).map((stay) => stay.id!)
    const from = ordered.indexOf(stayId)
    const to = ordered.indexOf(target)
    ordered[from] = target
    ordered[to] = stayId
    setActionError('')
    try {
      await reorderSeasonStays(season.id!, ordered)
      await onChanged()
    } catch (reason) {
      setActionError(describeSeasonGeoError(reason))
    }
  }

  return (
    <section aria-labelledby="season-itinerary-title" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold" id="season-itinerary-title">
            <MapPinned aria-hidden="true" className="size-5 text-emerald-700" /> Itinerario
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {activeStay
              ? `Estancia actual: ${activeStay.city}, ${countryLabel(activeStay.countryCode)}`
              : stays.length
                ? 'Sin estancia actual. Puedes activar una ciudad prevista o cambiar de ciudad.'
                : 'Ciudad por decidir. Añade ciudades cuando las conozcas; no es obligatorio.'}
          </p>
        </div>
        {isActiveSeason && (
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              onClick={() => open({ kind: 'plan' })}
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" /> Añadir ciudad prevista
            </button>
            <button
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white"
              onClick={() => open({ kind: 'switchNew' })}
              type="button"
            >
              <Repeat aria-hidden="true" className="size-4" /> {activeStay ? 'Cambiar de ciudad' : 'Empezar estancia'}
            </button>
          </div>
        )}
      </div>

      {actionError && <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700" role="alert">{actionError}</p>}

      {entries.length > 0 && (
        <ol className="mt-4 grid gap-2">
          {entries.map((entry) => {
            if (entry.type === 'gap') {
              return (
                <li className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400" key={entry.key}>
                  {formatGap(entry)}
                </li>
              )
            }
            const { stay } = entry
            const linkedAppointments = records.appointments.filter((item) => item.seasonStayId === stay.id)
            const linkedMovements = records.incomes.filter((item) => item.seasonStayId === stay.id).length +
              records.expenses.filter((item) => item.seasonStayId === stay.id).length
            const undatedIndex = stay.id === undefined ? -1 : undatedPlannedIds.indexOf(stay.id)
            return (
              <li
                className={[
                  'rounded-lg border p-3',
                  stay.status === 'active'
                    ? 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-700',
                  stay.status === 'cancelled' ? 'opacity-75' : '',
                ].join(' ')}
                key={stay.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <MapPin aria-hidden="true" className="size-4 text-slate-500" />
                      {stay.city}
                      {entry.repeated && entry.visitNumber && (
                        <span className="text-xs font-normal text-slate-500">{formatVisitNumber(entry.visitNumber)}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[stay.status]}`}>
                        {STAY_STATUS_LABELS[stay.status]}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{formatStayPeriod(stay)}</p>
                    {(linkedAppointments.length > 0 || linkedMovements > 0) && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {linkedMovements} movimiento{linkedMovements === 1 ? '' : 's'} · {linkedAppointments.length} cita{linkedAppointments.length === 1 ? '' : 's'}
                      </p>
                    )}
                    {stay.status === 'cancelled' && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {stay.cancellationReasonCode === 'season_closed' ? 'Cancelada al cerrar la temporada.' : `Motivo: ${stay.cancellationReason ?? '—'}`}
                      </p>
                    )}
                  </div>
                  {isActiveSeason && stay.status !== 'cancelled' && (
                    <div className="flex flex-wrap gap-1.5">
                      {stay.status === 'planned' && undatedIndex >= 0 && undatedPlannedIds.length > 1 && (
                        <>
                          <button aria-label={`Subir ${stay.city} en el itinerario`} className="inline-flex size-11 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40 dark:border-slate-600" disabled={undatedIndex === 0} onClick={() => move(stay.id!, -1)} type="button"><ArrowUp aria-hidden="true" className="size-4" /></button>
                          <button aria-label={`Bajar ${stay.city} en el itinerario`} className="inline-flex size-11 items-center justify-center rounded-md border border-slate-300 disabled:opacity-40 dark:border-slate-600" disabled={undatedIndex === undatedPlannedIds.length - 1} onClick={() => move(stay.id!, 1)} type="button"><ArrowDown aria-hidden="true" className="size-4" /></button>
                        </>
                      )}
                      {stay.status === 'planned' && (
                        <button className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white" onClick={() => open({ kind: 'activate', stay })} type="button">
                          <PlayCircle aria-hidden="true" className="size-4" /> Activar
                        </button>
                      )}
                      {stay.status === 'active' && (
                        <button className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600" onClick={() => open({ kind: 'complete', stay })} type="button">
                          <CheckCircle2 aria-hidden="true" className="size-4" /> Finalizar
                        </button>
                      )}
                      <button className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-sm font-semibold dark:border-slate-600" onClick={() => open({ kind: 'correct', stay })} type="button">
                        <Pencil aria-hidden="true" className="size-4" /> Corregir
                      </button>
                      {stay.status === 'planned' && (
                        <button className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-rose-300 px-3 text-sm font-semibold text-rose-700 dark:border-rose-800 dark:text-rose-300" onClick={() => open({ kind: 'cancel', stay })} type="button">
                          <Ban aria-hidden="true" className="size-4" /> Cancelar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {dialog?.kind === 'plan' && (
        <PlanStayDialog busy={busy} error={error} onCancel={close} onSubmit={(input) => run(() => createPlannedSeasonStay({ earningPeriodId: season.id!, ...input }))} season={season} />
      )}
      {dialog?.kind === 'switchNew' && (
        <SwitchStayDialog
          activeStay={activeStay}
          busy={busy}
          error={error}
          onCancel={close}
          onSubmit={({ city, effectiveAt }) => run(() => switchActiveSeasonStay({
            earningPeriodId: season.id!,
            next: { kind: 'new', city },
            effectiveAt,
            timeZone: currentTimeZone(),
          }))}
        />
      )}
      {dialog?.kind === 'activate' && (
        <SwitchStayDialog
          activeStay={activeStay}
          busy={busy}
          error={error}
          existingStay={dialog.stay}
          onCancel={close}
          onSubmit={({ effectiveAt }) => run(() => switchActiveSeasonStay({
            earningPeriodId: season.id!,
            next: { kind: 'existing', seasonStayId: dialog.stay.id! },
            effectiveAt,
            timeZone: currentTimeZone(),
          }))}
        />
      )}
      {dialog?.kind === 'complete' && (
        <CompleteStayDialog busy={busy} error={error} onCancel={close} onSubmit={(effectiveAt) => run(() => completeSeasonStay(dialog.stay.id!, effectiveAt, dialog.stay.timeZone ?? currentTimeZone()))} stay={dialog.stay} />
      )}
      {dialog?.kind === 'correct' && (
        <CorrectStayDialog busy={busy} error={error} onCancel={close} onSubmit={(input) => run(() => correctSeasonStay(input))} stay={dialog.stay} />
      )}
      {dialog?.kind === 'cancel' && (
        <CancelStayDialog
          appointments={records.appointments.filter((item) => item.seasonStayId === dialog.stay.id)}
          busy={busy}
          error={error}
          linkedMovements={records.incomes.filter((item) => item.seasonStayId === dialog.stay.id).length +
            records.expenses.filter((item) => item.seasonStayId === dialog.stay.id).length}
          onCancel={close}
          onSubmit={({ reason, detach }) => run(() => cancelPlannedSeasonStay(dialog.stay.id!, reason, { detachLinkedAppointments: detach }))}
          stay={dialog.stay}
        />
      )}
    </section>
  )
}

function CityInput({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <>
      <input autoComplete="off" className={geoInputClassName} id={id} list={`${id}-cities`} onChange={(event) => onChange(event.target.value)} required value={value} />
      <datalist id={`${id}-cities`}>
        {fallbackCityOptions.map((option) => <option key={`${option.country}:${option.value}`} value={option.value} />)}
      </datalist>
    </>
  )
}

function ReasonField({ value, onChange, required, label = 'Motivo' }: { value: string; onChange: (value: string) => void; required: boolean; label?: string }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}{required ? '' : ' (opcional)'}
      {/* Sin `required` nativo: la validación propia muestra un mensaje comprensible. */}
      <textarea aria-required={required} className="min-h-20 rounded-md border border-slate-300 p-3 text-base dark:border-slate-700 dark:bg-slate-950" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  )
}

function PlanStayDialog({ season, busy, error, onCancel, onSubmit }: {
  season: EarningPeriod
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (input: { city: string; plannedStartDate?: string; plannedEndDate?: string }) => void
}) {
  const [city, setCity] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  return (
    <GeoFormDialog busy={busy} error={error} icon={<Plus className="size-6" aria-hidden="true" />} message={`Las fechas son opcionales. La estancia estará en ${countryLabel(season.countryCode)}.`} onCancel={onCancel} onSubmit={() => onSubmit({ city, plannedStartDate: start || undefined, plannedEndDate: end || undefined })} submitLabel="Añadir" title="Añadir ciudad prevista">
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="plan-stay-city">Ciudad<CityInput id="plan-stay-city" onChange={setCity} value={city} /></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">Inicio previsto<input className={geoInputClassName} min={season.startDate.slice(0, 10)} onChange={(event) => setStart(event.target.value)} type="date" value={start} /></label>
        <label className="grid gap-1.5 text-sm font-medium">Fin previsto<input className={geoInputClassName} min={start || season.startDate.slice(0, 10)} onChange={(event) => setEnd(event.target.value)} type="date" value={end} /></label>
      </div>
    </GeoFormDialog>
  )
}

function SwitchStayDialog({ activeStay, existingStay, busy, error, onCancel, onSubmit }: {
  activeStay?: SeasonStay
  existingStay?: SeasonStay
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (input: { city: string; effectiveAt: string }) => void
}) {
  const [city, setCity] = useState('')
  const [when, setWhen] = useState(nowLocalInput)
  const [localError, setLocalError] = useState('')
  const title = existingStay ? `Activar ${existingStay.city}` : activeStay ? 'Cambiar de ciudad' : 'Empezar estancia'
  const message = activeStay && activeStay.id !== existingStay?.id
    ? `La estancia en ${activeStay.city} terminará exactamente en el momento indicado y la nueva empezará en ese mismo instante.`
    : 'La estancia empezará en el momento indicado. No puede ser una hora futura.'

  function submit() {
    const effectiveAt = localDateTimeInputToIso(when)
    if (!effectiveAt) {
      setLocalError('Indica una fecha y hora válidas.')
      return
    }
    setLocalError('')
    onSubmit({ city: existingStay?.city ?? city, effectiveAt })
  }

  return (
    <GeoFormDialog busy={busy} error={localError || error} icon={<Repeat className="size-6" aria-hidden="true" />} message={message} onCancel={onCancel} onSubmit={submit} submitLabel={existingStay ? 'Activar' : 'Confirmar'} title={title}>
      {!existingStay && <label className="grid gap-1.5 text-sm font-medium" htmlFor="switch-stay-city">Nueva ciudad<CityInput id="switch-stay-city" onChange={setCity} value={city} /></label>}
      <label className="grid gap-1.5 text-sm font-medium">
        Desde
        <input className={geoInputClassName} max={nowLocalInput()} onChange={(event) => setWhen(event.target.value)} required type="datetime-local" value={when} />
      </label>
    </GeoFormDialog>
  )
}

function CompleteStayDialog({ stay, busy, error, onCancel, onSubmit }: {
  stay: SeasonStay
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (effectiveAt: string) => void
}) {
  const [when, setWhen] = useState(nowLocalInput)
  const [localError, setLocalError] = useState('')
  return (
    <GeoFormDialog
      busy={busy}
      error={localError || error}
      icon={<CheckCircle2 className="size-6" aria-hidden="true" />}
      message="La temporada sigue activa. Hasta que actives otra ciudad no habrá estancia actual, y los movimientos podrán guardarse sin estancia."
      onCancel={onCancel}
      onSubmit={() => {
        const effectiveAt = localDateTimeInputToIso(when)
        if (!effectiveAt) {
          setLocalError('Indica una fecha y hora válidas.')
          return
        }
        onSubmit(effectiveAt)
      }}
      submitLabel="Finalizar estancia"
      title={`Finalizar estancia en ${stay.city}`}
    >
      <label className="grid gap-1.5 text-sm font-medium">
        Fin de la estancia
        <input className={geoInputClassName} max={nowLocalInput()} min={isoToLocalDateTimeInput(stay.actualStartAt)} onChange={(event) => setWhen(event.target.value)} required type="datetime-local" value={when} />
      </label>
    </GeoFormDialog>
  )
}

function CorrectStayDialog({ stay, busy, error, onCancel, onSubmit }: {
  stay: SeasonStay
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (input: CorrectStayInput) => void
}) {
  const [city, setCity] = useState(stay.city)
  const [plannedStart, setPlannedStart] = useState(stay.plannedStartDate ?? '')
  const [plannedEnd, setPlannedEnd] = useState(stay.plannedEndDate ?? '')
  const [actualStart, setActualStart] = useState(isoToLocalDateTimeInput(stay.actualStartAt))
  const [actualEnd, setActualEnd] = useState(isoToLocalDateTimeInput(stay.actualEndAt))
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState('')

  function submit() {
    const changes: CorrectStayInput['changes'] = {}
    if (city.trim() !== stay.city) changes.city = city
    if (stay.status === 'planned') {
      if ((plannedStart || undefined) !== stay.plannedStartDate) changes.plannedStartDate = plannedStart || undefined
      if ((plannedEnd || undefined) !== stay.plannedEndDate) changes.plannedEndDate = plannedEnd || undefined
    } else {
      if (actualStart !== isoToLocalDateTimeInput(stay.actualStartAt)) changes.actualStartAt = localDateTimeInputToIso(actualStart)
      if (stay.status === 'completed' && actualEnd !== isoToLocalDateTimeInput(stay.actualEndAt)) {
        changes.actualEndAt = localDateTimeInputToIso(actualEnd)
      }
    }
    if (!Object.keys(changes).length) {
      setLocalError('No hay cambios que corregir.')
      return
    }
    if (!reason.trim()) {
      setLocalError('La corrección requiere un motivo.')
      return
    }
    setLocalError('')
    onSubmit({ seasonStayId: stay.id!, changes, reason })
  }

  return (
    <GeoFormDialog
      busy={busy}
      error={localError || error}
      icon={<Pencil className="size-6" aria-hidden="true" />}
      message={`El país se mantiene (${countryLabel(stay.countryCode)}). La corrección queda en el historial y no modifica la ubicación guardada en los movimientos.`}
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel="Guardar corrección"
      title={`Corregir estancia en ${stay.city}`}
      tone="warning"
    >
      <label className="grid gap-1.5 text-sm font-medium" htmlFor="correct-stay-city">Ciudad<CityInput id="correct-stay-city" onChange={setCity} value={city} /></label>
      {stay.status === 'planned' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">Inicio previsto<input className={geoInputClassName} onChange={(event) => setPlannedStart(event.target.value)} type="date" value={plannedStart} /></label>
          <label className="grid gap-1.5 text-sm font-medium">Fin previsto<input className={geoInputClassName} min={plannedStart || undefined} onChange={(event) => setPlannedEnd(event.target.value)} type="date" value={plannedEnd} /></label>
        </div>
      ) : (
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-medium">Inicio real<input className={geoInputClassName} max={nowLocalInput()} onChange={(event) => setActualStart(event.target.value)} required type="datetime-local" value={actualStart} /></label>
          {stay.status === 'completed' && (
            <label className="grid gap-1.5 text-sm font-medium">Fin real<input className={geoInputClassName} max={nowLocalInput()} min={actualStart || undefined} onChange={(event) => setActualEnd(event.target.value)} required type="datetime-local" value={actualEnd} /></label>
          )}
        </div>
      )}
      <ReasonField onChange={(value) => { setReason(value); setLocalError('') }} required value={reason} />
    </GeoFormDialog>
  )
}

function CancelStayDialog({ stay, appointments, linkedMovements, busy, error, onCancel, onSubmit }: {
  stay: SeasonStay
  appointments: Appointment[]
  linkedMovements: number
  busy: boolean
  error: string
  onCancel: () => void
  onSubmit: (input: { reason: string; detach: boolean }) => void
}) {
  const [reason, setReason] = useState('')
  const [detach, setDetach] = useState(false)
  const [localError, setLocalError] = useState('')

  function submit() {
    if (!reason.trim()) {
      setLocalError('La cancelación requiere un motivo.')
      return
    }
    if (appointments.length > 0 && !detach) {
      setLocalError('Confirma que quieres desvincular las citas para poder cancelar la estancia.')
      return
    }
    onSubmit({ reason, detach })
  }

  return (
    <GeoFormDialog
      busy={busy}
      error={localError || error}
      icon={<Ban className="size-6" aria-hidden="true" />}
      message="El plan queda en el historial como cancelado. No se borra."
      onCancel={onCancel}
      onSubmit={submit}
      submitLabel="Cancelar estancia"
      title={`Cancelar estancia prevista en ${stay.city}`}
      tone="danger"
    >
      {linkedMovements > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Esta estancia tiene {linkedMovements} movimiento{linkedMovements === 1 ? '' : 's'} vinculado{linkedMovements === 1 ? '' : 's'} y no puede cancelarse.
        </p>
      )}
      {appointments.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Citas vinculadas ({appointments.length})</p>
          <ul className="max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-700">
            {appointments.map((appointment) => (
              <li className="px-3 py-2" key={appointment.id}>
                {formatAppointmentDate(appointment.dateTime)}
                {appointment.city ? ` · ${appointment.city}` : ''}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input checked={detach} className="mt-1 size-4" onChange={(event) => { setDetach(event.target.checked); setLocalError('') }} type="checkbox" />
            Desvincular estas citas de la estancia. Conservarán su ciudad, país y destino.
          </label>
        </div>
      )}
      <ReasonField onChange={(value) => { setReason(value); setLocalError('') }} required value={reason} />
    </GeoFormDialog>
  )
}

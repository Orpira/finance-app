import { MapPin, Navigation } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import type { GeographicRecordKind } from '../../../services/recordGeographyService'
import { listSelectableSeasonStays } from '../../../services/seasonStayService'
import type { SeasonStay } from '../../../types/seasonStay'
import type { CountryCode } from '../../../types/settings'
import { countries, fallbackCityOptions } from '../../../utils/countries'
import type { RecordGeographyDraft } from './recordGeographyForm'
import { describeSeasonGeoError } from './seasonGeoMessages'
import {
  STAY_STATUS_LABELS,
  cityHasRepeatedVisits,
  countryLabel,
  describeStay,
  formatStayPeriod,
} from './stayPresentation'

interface StayOption {
  stay: SeasonStay
  visitNumber?: number
  repeated: boolean
  compatible: boolean
  reason?: string
}

interface RecordGeographyFieldsProps {
  kind: GeographicRecordKind
  earningPeriodId?: number
  /** Fecha (YYYY-MM-DD) del movimiento o fecha-hora de la cita. */
  temporalValue: string
  seasonCountryCode?: CountryCode
  draft: RecordGeographyDraft
  onChange: (draft: RecordGeographyDraft) => void
  isEditing: boolean
  /** Instantánea histórica del registro, para explicar la sincronización. */
  historicalLocation?: { city?: string; country?: string }
  /** Registros reportados o temporadas cerradas: solo lectura. */
  readOnly?: boolean
}

const inputClassName =
  'h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white'

export function RecordGeographyFields({
  kind,
  earningPeriodId,
  temporalValue,
  seasonCountryCode,
  draft,
  onChange,
  isEditing,
  historicalLocation,
  readOnly = false,
}: RecordGeographyFieldsProps) {
  const stayFieldId = useId()
  const destinationLabelId = useId()
  const destinationCityId = useId()
  const destinationCountryId = useId()
  const cityListId = useId()
  const [options, setOptions] = useState<StayOption[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const draftRef = useRef(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!earningPeriodId) {
        setOptions([])
        return
      }
      try {
        const readModels = await listSelectableSeasonStays({
          earningPeriodId,
          recordKind: kind,
          currentSeasonStayId: draftRef.current.seasonStayId ?? undefined,
          temporalValue: temporalValue || undefined,
        })
        const stays = readModels.map((item) => item.stay)
        const evaluated = readModels.map((readModel): StayOption => {
          const stay = readModel.stay
          const base = {
            stay,
            // Número de visita calculado por el dominio (listSelectableSeasonStays).
            visitNumber: readModel.visitNumber,
            repeated: cityHasRepeatedVisits(stays, stay.cityNormalized),
          }
          if (!temporalValue || stay.id === undefined) {
            return { ...base, compatible: false, reason: 'Indica primero la fecha.' }
          }
          const reason = readModel.disabledReason === 'cancelled'
            ? 'La estancia está cancelada.'
            : readModel.disabledReason === 'not_started'
              ? 'La estancia todavía no ha comenzado.'
              : readModel.disabledReason === 'outside_interval'
                ? 'La fecha queda fuera del intervalo de la estancia.'
                : readModel.disabledReason === 'season_closed'
                  ? 'La temporada está cerrada.'
                  : undefined
          return { ...base, compatible: readModel.selectable, reason }
        })
        if (cancelled) return
        setLoadError('')
        setOptions(evaluated)
      } catch (error) {
        if (cancelled) return
        setOptions([])
        setLoadError(describeSeasonGeoError(error, 'No se pudieron cargar las estancias.'))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [earningPeriodId, kind, temporalValue])

  const selected = options?.find((option) => option.stay.id === draft.seasonStayId)
  const visibleOptions = (options ?? []).filter(
    (option) => option.stay.status !== 'cancelled' || option.stay.id === draft.seasonStayId,
  )

  // Nunca se asocia una estancia sin acción de la usuaria: la estancia actual
  // compatible solo se ofrece como sugerencia explícita e identificable.
  const suggestion = !isEditing && draft.seasonStayId === null
    ? options?.find((option) => option.stay.status === 'active' && option.compatible)
    : undefined

  function selectStay(value: string) {
    const seasonStayId = value === '' ? null : Number(value)
    onChange({
      ...draft,
      seasonStayId,
      syncLocationFromStay: seasonStayId === null ? false : draft.syncLocationFromStay,
    })
  }

  function updateDestination(changes: Partial<RecordGeographyDraft['destination']>) {
    onChange({ ...draft, destination: { ...draft.destination, ...changes } })
  }

  return (
    <fieldset className="grid gap-4 rounded-lg border border-slate-200 p-3 dark:border-slate-700" disabled={readOnly}>
      <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-100">Ubicación</legend>

      <div className="grid gap-2">
        <label className="flex items-center gap-2 text-sm font-medium" htmlFor={stayFieldId}>
          <MapPin aria-hidden="true" className="size-4 text-emerald-700" />
          Estancia (opcional)
        </label>
        {options === null ? (
          <p className="text-sm text-slate-500">Cargando estancias...</p>
        ) : (
          <select
            aria-describedby={`${stayFieldId}-hint`}
            className={inputClassName}
            id={stayFieldId}
            onChange={(event) => selectStay(event.target.value)}
            value={draft.seasonStayId === null ? '' : String(draft.seasonStayId)}
          >
            <option value="">Sin estancia</option>
            {visibleOptions.map((option) => {
              const isCurrent = option.stay.id === draft.seasonStayId
              const status = STAY_STATUS_LABELS[option.stay.status].toLowerCase()
              const suffix = option.compatible ? '' : ' — no disponible para esta fecha'
              return (
                <option
                  disabled={!option.compatible && !isCurrent}
                  key={option.stay.id}
                  value={option.stay.id}
                >
                  {describeStay(option.stay, { visitNumber: option.visitNumber, showVisit: option.repeated })}
                  {` · ${formatStayPeriod(option.stay)} · ${status}${suffix}`}
                </option>
              )
            })}
          </select>
        )}
        {suggestion && (
          <button
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-left text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            onClick={() => selectStay(String(suggestion.stay.id))}
            type="button"
          >
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            Usar estancia actual: {describeStay(suggestion.stay, { visitNumber: suggestion.visitNumber, showVisit: suggestion.repeated })}
          </button>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400" id={`${stayFieldId}-hint`}>
          {options && options.length === 0
            ? 'Esta temporada aún no tiene estancias. Puedes guardar sin estancia.'
            : draft.seasonStayId === null
              ? 'No se asociará ninguna estancia salvo que la elijas.'
            : kind === 'appointment'
              ? 'Las citas futuras pueden asociarse a una estancia prevista.'
              : 'Solo se pueden elegir estancias ya iniciadas cuyas fechas incluyan este movimiento.'}
        </p>
        {loadError && <p className="text-sm font-medium text-rose-700" role="alert">{loadError}</p>}
        {selected && !selected.compatible && (
          <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100" role="status">
            {isEditing
              ? `Estancia histórica: ${selected.reason ?? 'ya no es compatible con esta fecha.'} Puedes conservarla si no cambias la fecha, o elegir otra.`
              : selected.reason}
          </p>
        )}
        {isEditing && draft.seasonStayId !== null && selected && (
          <label className="flex items-start gap-2 text-sm">
            <input
              checked={draft.syncLocationFromStay}
              className="mt-1 size-4"
              onChange={(event) => onChange({ ...draft, syncLocationFromStay: event.target.checked })}
              type="checkbox"
            />
            <span>
              Actualizar la ciudad y el país del registro con los de la estancia ({selected.stay.city}, {countryLabel(selected.stay.countryCode)}).
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Ubicación guardada: {historicalLocation?.city || 'sin ciudad'}{historicalLocation?.country ? `, ${countryLabel(historicalLocation.country)}` : ''}. Si no lo marcas, se conserva.
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="grid gap-3">
        <label className="flex items-start gap-2 text-sm font-medium">
          <input
            checked={draft.destinationEnabled}
            className="mt-1 size-4"
            onChange={(event) => onChange({
              ...draft,
              destinationEnabled: event.target.checked,
              destination: event.target.checked && !draft.destination.countryCode && seasonCountryCode
                ? { ...draft.destination, countryCode: seasonCountryCode }
                : draft.destination,
            })}
            type="checkbox"
          />
          <span className="flex items-center gap-2">
            <Navigation aria-hidden="true" className="size-4 text-sky-700" />
            Destino puntual de desplazamiento
          </span>
        </label>
        {draft.destinationEnabled && (
          <div className="grid gap-3 rounded-md bg-slate-50 p-3 dark:bg-slate-900">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Un destino puntual no cambia la estancia, la temporada, la moneda ni los importes.
            </p>
            <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label="Tipo de destino">
              {(['city', 'place'] as const).map((value) => (
                <label className="flex items-center gap-2" key={value}>
                  <input
                    checked={draft.destination.kind === value}
                    name={`${destinationLabelId}-kind`}
                    onChange={() => updateDestination({ kind: value })}
                    type="radio"
                  />
                  {value === 'city' ? 'Ciudad' : 'Lugar concreto'}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium" htmlFor={destinationLabelId}>
                {draft.destination.kind === 'city' ? 'Ciudad de destino' : 'Nombre del lugar'}
                <input
                  className={inputClassName}
                  id={destinationLabelId}
                  list={draft.destination.kind === 'city' ? cityListId : undefined}
                  onChange={(event) => updateDestination({ label: event.target.value })}
                  value={draft.destination.label}
                />
              </label>
              {draft.destination.kind === 'place' && (
                <label className="grid gap-1.5 text-sm font-medium" htmlFor={destinationCityId}>
                  Ciudad (opcional)
                  <input
                    className={inputClassName}
                    id={destinationCityId}
                    list={cityListId}
                    onChange={(event) => updateDestination({ city: event.target.value })}
                    value={draft.destination.city}
                  />
                </label>
              )}
              <label className="grid gap-1.5 text-sm font-medium" htmlFor={destinationCountryId}>
                País (opcional)
                <select
                  className={inputClassName}
                  id={destinationCountryId}
                  onChange={(event) => updateDestination({ countryCode: event.target.value as CountryCode | '' })}
                  value={draft.destination.countryCode}
                >
                  <option value="">Sin indicar</option>
                  {countries.map((country) => (
                    <option key={country.value} value={country.value}>{country.label}</option>
                  ))}
                </select>
              </label>
            </div>
            {draft.destination.countryCode && seasonCountryCode && draft.destination.countryCode !== seasonCountryCode && (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Destino internacional: el registro sigue en la temporada de {countryLabel(seasonCountryCode)} y conserva su moneda.
              </p>
            )}
          </div>
        )}
      </div>
      <datalist id={cityListId}>
        {fallbackCityOptions.map((option) => (
          <option key={`${option.country}:${option.value}`} value={option.value} />
        ))}
      </datalist>
    </fieldset>
  )
}

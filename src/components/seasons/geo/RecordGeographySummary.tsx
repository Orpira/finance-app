import { MapPin, Navigation } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  getRecordGeographyReadModel,
  type RecordGeographyReadModel,
} from '../../../services/recordGeographyService'
import type { TravelDestination } from '../../../types/travelDestination'
import { STAY_STATUS_LABELS, countryLabel, formatStayPeriod, formatTravelDestination } from './stayPresentation'

export interface GeographyReadableRecord {
  earningPeriodId?: number
  seasonPeriodId?: number
  seasonStayId?: number
  travelDestination?: TravelDestination
  city?: string
  country?: string
}

/**
 * Lectura de estancia + destino + ubicación histórica de un registro.
 * Estancia y destino se muestran por separado para no confundirlos, y la
 * ausencia de estancia se presenta como un estado normal, no como error.
 */
export function RecordGeographySummary({
  record,
  compact = false,
}: {
  record: GeographyReadableRecord
  compact?: boolean
}) {
  const [model, setModel] = useState<RecordGeographyReadModel | null>(null)
  const { earningPeriodId, seasonPeriodId, seasonStayId, travelDestination, city, country } = record

  useEffect(() => {
    let cancelled = false
    getRecordGeographyReadModel({ earningPeriodId, seasonPeriodId, seasonStayId, travelDestination, city, country })
      .then((result) => {
        if (!cancelled) setModel(result)
      })
      .catch(() => {
        if (!cancelled) setModel(null)
      })
    return () => {
      cancelled = true
    }
  }, [earningPeriodId, seasonPeriodId, seasonStayId, travelDestination, city, country])

  const stay = model?.seasonStay
  const location = [city, countryLabel(country)].filter(Boolean).join(', ')

  if (compact) {
    const parts: string[] = []
    if (stay) parts.push(`Estancia: ${stay.city}`)
    if (travelDestination) parts.push(`Destino: ${formatTravelDestination(travelDestination)}`)
    if (!parts.length) return null
    return <p className="text-xs text-slate-500 dark:text-slate-400">{parts.join(' · ')}</p>
  }

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <MapPin aria-hidden="true" className="size-3.5" /> Estancia
        </dt>
        <dd className="mt-1 text-slate-900 dark:text-slate-100">
          {stay ? (
            <>
              {stay.city}, {countryLabel(stay.countryCode)}
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {formatStayPeriod(stay)} · {STAY_STATUS_LABELS[stay.status]}
              </span>
            </>
          ) : model?.hasOrphanedStayReference ? (
            <span className="text-amber-800 dark:text-amber-200">La estancia vinculada ya no está disponible.</span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">Sin estancia asignada</span>
          )}
        </dd>
      </div>
      <div>
        <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Navigation aria-hidden="true" className="size-3.5" /> Destino puntual
        </dt>
        <dd className="mt-1 text-slate-900 dark:text-slate-100">
          {travelDestination ? formatTravelDestination(travelDestination) : <span className="text-slate-500 dark:text-slate-400">Sin destino puntual</span>}
        </dd>
      </div>
      {location && (
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ubicación registrada</dt>
          <dd className="mt-1 text-slate-900 dark:text-slate-100">{location}</dd>
        </div>
      )}
    </dl>
  )
}

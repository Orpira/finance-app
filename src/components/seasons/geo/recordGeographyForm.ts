import type { TravelDestination, TravelDestinationKind } from '../../../types/travelDestination'
import type { CountryCode } from '../../../types/settings'

/**
 * Estado de formulario para estancia + destino puntual de un registro
 * (ingreso, egreso o cita) y su traducción a los DTO de PB-GEO-002.
 *
 * Semántica del contrato de Etapa 2 (docs/PB_GEO_002_STAGE_1_CONTRACT.md):
 * - campo omitido → el servicio conserva el valor persistido;
 * - `null` → elimina la asociación o el destino;
 * - valor → el servicio valida y lo establece.
 * En edición solo se envían los campos que la usuaria cambió, para no
 * reescribir instantáneas históricas por accidente.
 */

export interface DestinationDraft {
  kind: TravelDestinationKind
  label: string
  city: string
  countryCode: CountryCode | ''
}

export interface RecordGeographyDraft {
  seasonStayId: number | null
  destinationEnabled: boolean
  destination: DestinationDraft
  /** Solo edición: copiar explícitamente ciudad/país desde la estancia. */
  syncLocationFromStay: boolean
}

export interface GeographyRecordSnapshot {
  seasonStayId?: number
  travelDestination?: TravelDestination
}

export function emptyDestinationDraft(defaultCountry?: CountryCode): DestinationDraft {
  return { kind: 'city', label: '', city: '', countryCode: defaultCountry ?? '' }
}

export function createGeographyDraft(
  record?: GeographyRecordSnapshot,
  defaultCountry?: CountryCode,
): RecordGeographyDraft {
  const destination = record?.travelDestination
  return {
    seasonStayId: record?.seasonStayId ?? null,
    destinationEnabled: Boolean(destination),
    destination: destination
      ? {
          kind: destination.kind,
          label: destination.label,
          city: destination.kind === 'place' ? destination.city ?? '' : '',
          countryCode: destination.countryCode ?? '',
        }
      : emptyDestinationDraft(defaultCountry),
    syncLocationFromStay: false,
  }
}

/** Construye el destino tal como lo espera el servicio; cityNormalized lo calcula el dominio. */
export function buildTravelDestination(draft: DestinationDraft): TravelDestination {
  const label = draft.label.trim()
  const countryCode = draft.countryCode || undefined
  if (draft.kind === 'city') {
    return { kind: 'city', label, city: label || undefined, countryCode, source: 'manual' }
  }
  const city = draft.city.trim()
  return { kind: 'place', label, city: city || undefined, countryCode, source: 'manual' }
}

export function validateDestinationDraft(draft: RecordGeographyDraft): string | null {
  if (!draft.destinationEnabled) return null
  if (!draft.destination.label.trim()) {
    return draft.destination.kind === 'city'
      ? 'Indica la ciudad del destino puntual o quita el destino.'
      : 'Indica el nombre del lugar del destino puntual o quita el destino.'
  }
  return null
}

function sameDestination(left?: TravelDestination, right?: TravelDestination) {
  if (!left || !right) return left === right
  return left.kind === right.kind &&
    left.label.trim() === right.label.trim() &&
    (left.city?.trim() || undefined) === (right.city?.trim() || undefined) &&
    (left.countryCode || undefined) === (right.countryCode || undefined)
}

export interface CreateGeographyPayload {
  seasonStayId?: number
  travelDestination?: TravelDestination
}

export function buildCreateGeographyPayload(draft: RecordGeographyDraft): CreateGeographyPayload {
  const payload: CreateGeographyPayload = {}
  if (draft.seasonStayId !== null) payload.seasonStayId = draft.seasonStayId
  if (draft.destinationEnabled) payload.travelDestination = buildTravelDestination(draft.destination)
  return payload
}

export interface UpdateGeographyPayload {
  seasonStayId?: number | null
  travelDestination?: TravelDestination | null
  syncLocationFromStay?: true
}

export function buildUpdateGeographyPayload(
  initial: GeographyRecordSnapshot,
  draft: RecordGeographyDraft,
): UpdateGeographyPayload {
  const payload: UpdateGeographyPayload = {}
  const initialStayId = initial.seasonStayId ?? null
  if (draft.seasonStayId !== initialStayId) payload.seasonStayId = draft.seasonStayId

  const nextDestination = draft.destinationEnabled ? buildTravelDestination(draft.destination) : undefined
  if (!nextDestination && initial.travelDestination) {
    payload.travelDestination = null
  } else if (nextDestination && !sameDestination(nextDestination, initial.travelDestination)) {
    payload.travelDestination = nextDestination
  }

  if (draft.syncLocationFromStay && draft.seasonStayId !== null) payload.syncLocationFromStay = true
  return payload
}

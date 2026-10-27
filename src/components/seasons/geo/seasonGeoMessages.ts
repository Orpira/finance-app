import type { SeasonGeoErrorCode } from '../../../utils/seasonGeoValidation'

/**
 * Mensajes de interfaz para los códigos de dominio de PB-GEO-002. La UI
 * decide por `code`, nunca por el texto del error (contrato §5.6); el mensaje
 * del servicio solo se usa como último recurso.
 */
const SEASON_GEO_MESSAGES: Record<SeasonGeoErrorCode, string> = {
  SEASON_NOT_FOUND: 'La temporada ya no existe. Recarga la pantalla.',
  SEASON_CLOSED: 'La temporada está cerrada y solo puede consultarse.',
  STAY_NOT_FOUND: 'La estancia ya no existe. Recarga la pantalla y elige otra.',
  STAY_SEASON_MISMATCH: 'La estancia pertenece a otra temporada.',
  STAY_COUNTRY_MISMATCH: 'La estancia debe estar en el país de la temporada.',
  STAY_STATUS_INVALID: 'La estancia no admite esta operación en su estado actual.',
  STAY_DATE_INVALID: 'Las fechas de la estancia no son válidas o quedan fuera de la temporada.',
  STAY_OVERLAP: 'Las fechas se solapan con otra estancia ya realizada.',
  ACTIVE_STAY_ALREADY_EXISTS: 'Ya hay una estancia actual. Finalízala o cambia de ciudad.',
  STAY_STARTED_CANNOT_CANCEL: 'Una estancia que ya comenzó no puede cancelarse. Puedes finalizarla o corregirla.',
  STAY_HAS_LINKED_RECORDS: 'La estancia tiene registros vinculados que impiden esta operación.',
  STAY_NOT_STARTED: 'La estancia todavía no ha comenzado.',
  CORRECTION_REASON_REQUIRED: 'Indica un motivo para continuar.',
  RECORD_SEASON_MISMATCH: 'El registro no pertenece a la temporada de la estancia.',
  RECORD_STAY_MISMATCH: 'Este registro no puede asociarse a una estancia.',
  RECORD_OUTSIDE_STAY_INTERVAL: 'La fecha del registro queda fuera de las fechas de la estancia elegida.',
  TRAVEL_DESTINATION_INVALID: 'Revisa el destino puntual: necesita un nombre válido.',
  REVISION_INVALID: 'El valor indicado no es válido para esta revisión.',
  BACKUP_SEASON_GEO_INVALID: 'La copia contiene datos de estancias inconsistentes.',
}

const COMPLETION_MESSAGES: Record<string, string> = {
  APPOINTMENT_NOT_FOUND: 'La cita ya no existe. Recarga la agenda.',
  APPOINTMENT_PRECONDITION_CHANGED: 'Los datos de la cita cambiaron mientras se preparaba la finalización. No se guardó nada; puedes volver a intentarlo.',
  APPOINTMENT_SEASON_INVALID: 'La cita no pertenece a una temporada activa. No se guardó nada.',
  APPOINTMENT_COMPLETION_INTEGRITY_ERROR: 'La cita no puede finalizarse todavía (por ejemplo, el servicio no se inició). No se guardó nada.',
}

/** Errores en los que reintentar es seguro: la operación no persistió nada. */
export const RETRYABLE_COMPLETION_CODES = new Set(['APPOINTMENT_PRECONDITION_CHANGED'])

export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }
  return undefined
}

const MESSAGE_CODES: Record<string, string> = {
  FINANCIAL_CONVERSION_INCOMPLETE: 'La conversión monetaria está incompleta y no se ha guardado nada. Espera a que se recalcule la conversión o revisa la cotización, y vuelve a guardar.',
}

export function describeSeasonGeoError(error: unknown, fallback = 'No se pudo completar la operación.') {
  // Algunos servicios señalan el error con un código estable en el mensaje.
  if (error instanceof Error && error.message in MESSAGE_CODES) return MESSAGE_CODES[error.message]
  const code = getErrorCode(error)
  if (code && code in SEASON_GEO_MESSAGES) return SEASON_GEO_MESSAGES[code as SeasonGeoErrorCode]
  if (code && code in COMPLETION_MESSAGES) return COMPLETION_MESSAGES[code]
  if (error instanceof Error && error.message) return error.message
  return fallback
}

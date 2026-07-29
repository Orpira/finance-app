import type { LicenseAccessStatus } from './licenseService'
import type { TrialAttemptOutcome } from './trialService'

export interface LicenseStatusSnapshot {
  status: LicenseAccessStatus
  license?: unknown
}

/**
 * Elegibilidad para el auto-trial: solo una instalación nueva sin ninguna
 * licencia local (ni siquiera una inactiva de un trial/compra previa).
 */
export function deriveTrialState(
  result: LicenseStatusSnapshot,
): 'eligible' | null {
  if (result.status === 'inactive' && !result.license) {
    return 'eligible'
  }
  return null
}

export type TrialFlowResult =
  | { state: 'trial-active' }
  | { state: 'trial-expired' }
  | { state: 'clock-tampered' }
  | { state: 'error'; detail: string }

const DEFAULT_MAX_ATTEMPTS = 2
const GENERIC_ERROR_DETAIL = 'No se pudo iniciar la prueba gratuita.'

function detailOf(outcome: TrialAttemptOutcome): string {
  return 'detail' in outcome ? outcome.detail : GENERIC_ERROR_DETAIL
}

/**
 * Orquesta el intento de trial con reintentos ACOTADOS: nunca más de
 * maxAttempts llamadas, nunca bucle. granted/expired/clock-tampered son
 * finales (paran de inmediato); el resto de outcomes (red, servidor,
 * activación local) son transitorios y se reintentan hasta agotar el
 * límite, momento en el que se devuelve un estado 'error' visible.
 */
export async function runTrialFlow(
  attempt: () => Promise<TrialAttemptOutcome>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<TrialFlowResult> {
  let lastDetail = GENERIC_ERROR_DETAIL

  for (let attemptNumber = 0; attemptNumber < maxAttempts; attemptNumber += 1) {
    const outcome = await attempt()

    if (outcome.outcome === 'granted') {
      return { state: 'trial-active' }
    }
    if (outcome.outcome === 'expired') {
      return { state: 'trial-expired' }
    }
    if (outcome.outcome === 'clock-tampered') {
      return { state: 'clock-tampered' }
    }

    lastDetail = detailOf(outcome)
  }

  return { state: 'error', detail: lastDetail }
}

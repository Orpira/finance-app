import { getPrivateBalanceApiUrl } from './apiBaseUrl'
import { activateSignedLicense } from './signedLicenseService'
import type { DeviceIdentity } from '../types/deviceIdentity'

interface TrialStartResponse {
  activationCode: string
  expiresAt: string
}

const GENERIC_SERVER_ERROR_MESSAGE = 'No se pudo iniciar la prueba gratuita.'

export type TrialAttemptOutcome =
  | { outcome: 'granted'; license: Awaited<ReturnType<typeof activateSignedLicense>> }
  | { outcome: 'expired' }
  | { outcome: 'clock-tampered' }
  | { outcome: 'server-error'; status: number; detail: string }
  | { outcome: 'network-error'; detail: string }
  | { outcome: 'activation-error'; detail: string }

/**
 * Intenta un trial de 7 días para este dispositivo, sin mostrar ni pedir
 * nada al usuario. Nunca lanza: cualquier fallo (red, rechazo del servidor,
 * activación local) se devuelve como un outcome estructurado para que el
 * llamador pueda registrar/actuar sobre datos, no sobre mensajes sueltos.
 */
export async function attemptFreeTrial(
  identity: DeviceIdentity,
): Promise<TrialAttemptOutcome> {
  let response: Response

  try {
    response = await fetch(getPrivateBalanceApiUrl('/api/trial-start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceCode: identity.deviceCode,
        userCode: identity.userCode,
        platform: identity.platform,
      }),
    })
  } catch (error) {
    return {
      outcome: 'network-error',
      detail: error instanceof Error ? error.message : String(error),
    }
  }

  if (response.status === 409) {
    const body = await response
      .json()
      .catch(() => ({}) as { outcome?: string; error?: string })

    if (body.outcome === 'expired') return { outcome: 'expired' }
    if (body.outcome === 'clock-tampered') return { outcome: 'clock-tampered' }

    return {
      outcome: 'server-error',
      status: 409,
      detail: body.error ?? GENERIC_SERVER_ERROR_MESSAGE,
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string })
    return {
      outcome: 'server-error',
      status: response.status,
      detail: body.error ?? GENERIC_SERVER_ERROR_MESSAGE,
    }
  }

  const { activationCode } = (await response.json()) as TrialStartResponse

  try {
    const license = await activateSignedLicense(activationCode, identity)
    return { outcome: 'granted', license }
  } catch (error) {
    return {
      outcome: 'activation-error',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

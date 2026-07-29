import { getOrCreateDeviceIdentity } from './deviceIdentityService'
import { activateSignedLicense } from './signedLicenseService'

export class TrialUnavailableError extends Error {}

interface TrialStartResponse {
  activationCode: string
  expiresAt: string
}

/**
 * Solicita un trial de 7 días para este dispositivo, sin mostrar ni pedir
 * nada al usuario: el deviceCode ya existe (generado en silencio por
 * deviceIdentityService). Si el servidor lo concede, el código firmado se
 * activa localmente igual que cualquier licencia de pago — reutilizando
 * toda la validación de expiración y detección de manipulación de reloj.
 *
 * Lanza TrialUnavailableError si este dispositivo ya usó su prueba antes
 * (el llamador debe entonces mostrar la pantalla normal de activación).
 */
export async function startFreeTrial() {
  const identity = await getOrCreateDeviceIdentity()

  const response = await fetch('/api/trial-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceCode: identity.deviceCode,
      userCode: identity.userCode,
      platform: identity.platform,
    }),
  })

  if (response.status === 409) {
    throw new TrialUnavailableError(
      'Este dispositivo ya usó su prueba gratuita de 7 días.',
    )
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}) as { error?: string })
    throw new Error(body.error ?? 'No se pudo iniciar la prueba gratuita.')
  }

  const { activationCode } = (await response.json()) as TrialStartResponse

  return activateSignedLicense(activationCode)
}

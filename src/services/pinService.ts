import { disablePin, enablePin, getSettings } from './settingsService'
import { createPinHash, isValidPin, verifyPinHash } from '../utils/pin'

export async function setPin(pin: string) {
  if (!isValidPin(pin)) {
    throw new Error('El PIN debe tener entre 4 y 6 números.')
  }

  const pinHash = await createPinHash(pin)

  return enablePin(pinHash)
}

export async function verifyPin(pin: string) {
  const settings = await getSettings()

  if (!settings.pinEnabled || !settings.pinHash) {
    return true
  }

  return verifyPinHash(pin, settings.pinHash)
}

export async function changePin(currentPin: string, nextPin: string) {
  const isCurrentPinValid = await verifyPin(currentPin)

  if (!isCurrentPinValid) {
    throw new Error('El PIN actual no es correcto.')
  }

  return setPin(nextPin)
}

export async function removePin(currentPin: string) {
  const isCurrentPinValid = await verifyPin(currentPin)

  if (!isCurrentPinValid) {
    throw new Error('El PIN actual no es correcto.')
  }

  return disablePin()
}

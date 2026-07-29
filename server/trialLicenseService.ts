/// <reference types="node" />

import { authorizeLicenseDevice } from './licenseDeviceRegistry.js'
import { resolveTrialDecision } from './trialEligibility.js'
import type { TrialGrantsRepository } from './trialGrantsRepository.js'
import { getSignedLicenseKey, signTrialLicense } from './trialLicenseSecurity.js'

export class TrialExpiredError extends Error {
  constructor() {
    super('Este dispositivo ya usó su prueba gratuita de 7 días y expiró.')
  }
}

export class ClockTamperedError extends Error {
  constructor() {
    super('El reloj del dispositivo no es de confianza para emitir el trial.')
  }
}

export interface TrialIssueInput {
  deviceCode: string
  userCode: string
  platform: 'web' | 'android' | 'ios' | 'unknown'
}

export interface TrialServiceResult {
  outcome: 'issued' | 'reactivated'
  activationCode: string
  expiresAt: string
  deviceAuthorization: 'existing' | 'registered'
  activeDevices: number
  maxDevices: number
}

/**
 * Emite un trial nuevo o reactiva uno vigente para el mismo dispositivo, de
 * forma idempotente: reabrir la app nunca debe encontrarse con un 409 en
 * bucle mientras el trial original siga vigente. Solo un trial YA EXPIRADO
 * (o un reloj manipulado) es un caso de error real. La reactivación firma
 * un activationCode nuevo pero conserva el expiresAt original: nunca
 * extiende la ventana de 7 días.
 */
export async function issueOrReactivateTrial(
  input: TrialIssueInput,
  repository: TrialGrantsRepository,
): Promise<TrialServiceResult> {
  const now = new Date()
  const existingRow = await repository.findByDeviceCode(input.deviceCode)
  const decision = resolveTrialDecision({
    now,
    existing: existingRow
      ? { issuedAt: existingRow.issuedAt, expiresAt: existingRow.expiresAt }
      : null,
  })

  if (decision.decision === 'expired') {
    throw new TrialExpiredError()
  }
  if (decision.decision === 'clock-tampered') {
    throw new ClockTamperedError()
  }

  if (decision.decision === 'reactivate') {
    const expiresAt = decision.existing.expiresAt
    const { activationCode } = await signTrialLicense(
      input.deviceCode,
      new Date(expiresAt),
    )
    const authorization = await authorizeLicenseDevice({
      licenseKey: getSignedLicenseKey(activationCode),
      userCode: input.userCode,
      deviceCode: input.deviceCode,
      platform: input.platform,
      licenseType: 'trial',
      expiresAt,
      devicePolicy: 'single',
    })

    return {
      outcome: 'reactivated',
      activationCode,
      expiresAt,
      deviceAuthorization: authorization.deviceAuthorization,
      activeDevices: authorization.activeDevices,
      maxDevices: authorization.maxDevices,
    }
  }

  const { activationCode, expiresAt } = await signTrialLicense(input.deviceCode)
  await repository.insert({
    deviceCode: input.deviceCode,
    userCode: input.userCode,
    issuedAt: now.toISOString(),
    expiresAt,
  })

  const authorization = await authorizeLicenseDevice({
    licenseKey: getSignedLicenseKey(activationCode),
    userCode: input.userCode,
    deviceCode: input.deviceCode,
    platform: input.platform,
    licenseType: 'trial',
    expiresAt,
    devicePolicy: 'single',
  })

  return {
    outcome: 'issued',
    activationCode,
    expiresAt,
    deviceAuthorization: authorization.deviceAuthorization,
    activeDevices: authorization.activeDevices,
    maxDevices: authorization.maxDevices,
  }
}

/// <reference types="node" />

import { neon } from '@neondatabase/serverless'

import {
  authorizeLicenseDevice,
  LicenseRegistryError,
} from './licenseDeviceRegistry.js'
import { getSignedLicenseKey, signTrialLicense } from './trialLicenseSecurity.js'

export class TrialAlreadyUsedError extends Error {
  constructor() {
    super('Este dispositivo ya usó su prueba gratuita de 7 días.')
  }
}

export interface TrialIssueInput {
  deviceCode: string
  userCode: string
  platform: 'web' | 'android' | 'ios' | 'unknown'
}

export interface TrialIssueResult {
  activationCode: string
  expiresAt: string
  deviceAuthorization: 'existing' | 'registered'
  activeDevices: number
  maxDevices: number
}

let schemaRequest: Promise<void> | undefined

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error('El registro de licencias no está configurado.')
  }
  return databaseUrl
}

async function ensureTrialSchema() {
  const sql = neon(getDatabaseUrl())

  // Una fila por dispositivo: si ya reclamó un trial, cualquier intento
  // posterior de ese mismo device_code es rechazado por la restricción
  // UNIQUE, sin importar si el trial anterior ya expiró o fue revocado.
  await sql`
    CREATE TABLE IF NOT EXISTS trial_grants (
      device_code TEXT PRIMARY KEY,
      user_code TEXT,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `
}

function ensureTrialSchemaOnce() {
  if (!schemaRequest) {
    schemaRequest = ensureTrialSchema().catch((error) => {
      schemaRequest = undefined
      throw error
    })
  }
  return schemaRequest
}

export async function issueTrialLicense(
  input: TrialIssueInput,
): Promise<TrialIssueResult> {
  await ensureTrialSchemaOnce()

  const sql = neon(getDatabaseUrl())
  const { activationCode, expiresAt } = await signTrialLicense(input.deviceCode)

  const inserted = await sql`
    INSERT INTO trial_grants (device_code, user_code, expires_at)
    VALUES (${input.deviceCode}, ${input.userCode}, ${expiresAt})
    ON CONFLICT (device_code) DO NOTHING
    RETURNING device_code
  `

  if (inserted.length === 0) {
    throw new TrialAlreadyUsedError()
  }

  const licenseKey = getSignedLicenseKey(activationCode)

  try {
    const authorization = await authorizeLicenseDevice({
      licenseKey,
      userCode: input.userCode,
      deviceCode: input.deviceCode,
      platform: input.platform,
      licenseType: 'trial',
      expiresAt,
      devicePolicy: 'single',
    })

    return {
      activationCode,
      expiresAt,
      deviceAuthorization: authorization.deviceAuthorization,
      activeDevices: authorization.activeDevices,
      maxDevices: authorization.maxDevices,
    }
  } catch (error) {
    // Revertir la reserva del trial si el alta en license_devices falla,
    // para no dejar "quemado" un dispositivo sin haber recibido su prueba.
    await sql`DELETE FROM trial_grants WHERE device_code = ${input.deviceCode}`

    if (error instanceof LicenseRegistryError) {
      throw error
    }
    throw new Error('No se pudo registrar el dispositivo de prueba.', {
      cause: error,
    })
  }
}

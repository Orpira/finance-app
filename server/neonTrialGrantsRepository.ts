/// <reference types="node" />

import { neon } from '@neondatabase/serverless'

import type { TrialGrantRow, TrialGrantsRepository } from './trialGrantsRepository.js'

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

  // Una fila por dispositivo. A diferencia del diseño anterior, un trial
  // vigente ya NO es rechazado por la restricción UNIQUE como error: el
  // servicio lee la fila y decide issue/reactivate/expired en aplicación
  // (ver server/trialEligibility.ts), así que aquí solo se garantiza que
  // exista como máximo una fila por dispositivo.
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

interface TrialGrantDbRow {
  device_code: string
  user_code: string | null
  issued_at: string
  expires_at: string
}

class NeonTrialGrantsRepository implements TrialGrantsRepository {
  async findByDeviceCode(deviceCode: string): Promise<TrialGrantRow | null> {
    await ensureTrialSchemaOnce()
    const sql = neon(getDatabaseUrl())

    const rows = (await sql`
      SELECT device_code, user_code, issued_at, expires_at
      FROM trial_grants
      WHERE device_code = ${deviceCode}
    `) as TrialGrantDbRow[]

    const row = rows[0]
    if (!row) return null

    return {
      deviceCode: row.device_code,
      userCode: row.user_code,
      issuedAt: new Date(row.issued_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
    }
  }

  async insert(row: TrialGrantRow): Promise<void> {
    await ensureTrialSchemaOnce()
    const sql = neon(getDatabaseUrl())

    const inserted = await sql`
      INSERT INTO trial_grants (device_code, user_code, issued_at, expires_at)
      VALUES (${row.deviceCode}, ${row.userCode}, ${row.issuedAt}, ${row.expiresAt})
      ON CONFLICT (device_code) DO NOTHING
      RETURNING device_code
    `

    if (inserted.length === 0) {
      throw new Error(
        `Ya existe una fila de trial para ${row.deviceCode} (carrera de inserción).`,
      )
    }
  }
}

export const neonTrialGrantsRepository: TrialGrantsRepository =
  new NeonTrialGrantsRepository()

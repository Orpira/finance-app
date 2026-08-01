import { createHash } from 'node:crypto'

import { CommunicationDuplicateRequestError } from '../errors/communicationErrors.js'
import { getIdempotencyRecord, saveIdempotencyRecord } from '../repositories/idempotencyRepository.js'

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

export interface IdempotentExecutionResult<T> {
  status: number
  body: T
  replayed: boolean
}

/**
 * Misma estrategia que `processed_events` en n8n (ver
 * docs/04_N8N_WORKFLOWS.md): una clave repetida con el mismo hash de payload
 * devuelve el resultado ya guardado sin repetir el efecto (enviar un
 * mensaje, procesar un webhook); una clave repetida con un hash distinto se
 * rechaza como solicitud conflictiva en lugar de sobrescribir el resultado
 * anterior en silencio.
 */
export async function withIdempotency<T>(
  key: string,
  payload: unknown,
  retentionDays: number,
  execute: () => Promise<{ status: number; body: T }>,
): Promise<IdempotentExecutionResult<T>> {
  const payloadHash = hashPayload(payload)
  const existing = await getIdempotencyRecord(key)

  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new CommunicationDuplicateRequestError(
        `La clave de idempotencia "${key}" ya se usó con una solicitud diferente.`,
      )
    }
    return { status: existing.resultStatus, body: existing.resultBody as T, replayed: true }
  }

  const result = await execute()
  await saveIdempotencyRecord({
    key,
    payloadHash,
    resultStatus: result.status,
    resultBody: result.body,
    retentionDays,
  })
  return { ...result, replayed: false }
}

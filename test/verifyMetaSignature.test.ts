import { createHmac } from 'node:crypto'
import { Readable } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { verifyMetaWebhookSignature } from '../server/communication/security/verifyMetaSignature'
import { readRawRequestBody } from '../server/communication/security/rawBody'
import type { VercelRequest } from '../server/apiUtils'

const APP_SECRET = 'meta-app-secret'

function signBody(body: Buffer, secret = APP_SECRET) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

describe('verifyMetaWebhookSignature', () => {
  it('acepta una firma calculada correctamente sobre los bytes originales', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }))
    expect(verifyMetaWebhookSignature(rawBody, signBody(rawBody), APP_SECRET)).toBe(true)
  })

  it('rechaza una firma calculada con un secreto distinto', () => {
    const rawBody = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }))
    expect(verifyMetaWebhookSignature(rawBody, signBody(rawBody, 'otro-secreto'), APP_SECRET)).toBe(false)
  })

  it('rechaza una firma calculada sobre un body reserializado (distinto al original)', () => {
    const originalRawBody = Buffer.from('{"a":1,"b":2}')
    const reserializedBody = Buffer.from(JSON.stringify(JSON.parse(originalRawBody.toString())))
    const signatureOverReserialized = signBody(reserializedBody)

    expect(verifyMetaWebhookSignature(originalRawBody, signatureOverReserialized, APP_SECRET)).toBe(
      originalRawBody.equals(reserializedBody),
    )
  })

  it('rechaza cuando la cabecera de firma está ausente', () => {
    const rawBody = Buffer.from('{}')
    expect(verifyMetaWebhookSignature(rawBody, undefined, APP_SECRET)).toBe(false)
  })

  it('rechaza cuando la cabecera no tiene el prefijo sha256=', () => {
    const rawBody = Buffer.from('{}')
    expect(verifyMetaWebhookSignature(rawBody, 'deadbeef', APP_SECRET)).toBe(false)
  })

  it('rechaza una firma con longitud distinta a la esperada', () => {
    const rawBody = Buffer.from('{}')
    expect(verifyMetaWebhookSignature(rawBody, 'sha256=abcd', APP_SECRET)).toBe(false)
  })
})

describe('readRawRequestBody', () => {
  it('devuelve exactamente los bytes originales del stream, sin parsear', async () => {
    const originalPayload = Buffer.from('{"messages":[{"id":"wamid.1"}]}')
    const request = Readable.from([originalPayload]) as unknown as VercelRequest

    const rawBody = await readRawRequestBody(request)
    expect(rawBody.equals(originalPayload)).toBe(true)
  })

  it('rechaza cuerpos que superan el límite configurado', async () => {
    const oversized = Buffer.alloc(100, 'a')
    const request = Readable.from([oversized]) as unknown as VercelRequest

    await expect(readRawRequestBody(request, 10)).rejects.toThrow()
  })
})

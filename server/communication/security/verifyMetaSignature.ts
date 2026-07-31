/// <reference types="node" />

import { createHmac, timingSafeEqual } from 'node:crypto'

const SIGNATURE_PREFIX = 'sha256='

/**
 * Meta firma el body crudo con HMAC-SHA256 usando el App Secret y lo envía
 * en `X-Hub-Signature-256: sha256=<hex>`. `rawBody` debe ser exactamente los
 * bytes recibidos, antes de cualquier parseo JSON.
 */
export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) return false

  const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length).trim()
  if (!/^[0-9a-f]+$/i.test(providedHex)) return false

  const expected = createHmac('sha256', appSecret).update(rawBody).digest()
  const provided = Buffer.from(providedHex, 'hex')

  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}

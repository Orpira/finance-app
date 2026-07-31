/// <reference types="node" />

import type { VercelRequest } from '../../apiUtils.js'

const DEFAULT_MAX_BYTES = 256 * 1024

/**
 * Lee el body sin parsear. Necesario para validar la firma HMAC de Meta
 * (X-Hub-Signature-256), que se calcula sobre los bytes originales, nunca
 * sobre un objeto JSON reserializado. La ruta que la use debe exportar
 * `config.api.bodyParser = false` para que Vercel no consuma el stream antes.
 */
export function readRawRequestBody(
  request: VercelRequest,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0

    request.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalBytes += buffer.length
      if (totalBytes > maxBytes) {
        reject(new Error('Cuerpo de la solicitud demasiado grande.'))
        request.destroy()
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

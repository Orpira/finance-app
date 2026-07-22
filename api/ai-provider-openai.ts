/// <reference types="node" />

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import { verifyAutomationJwt } from '../server/automationSecurity.js'

const MAX_TIMEOUT_MS = 30_000
const DEFAULT_TIMEOUT_MS = 10_000
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

const requestSchema = z.object({
  providerId: z.literal('OPENAI'),
  model: z.string().min(1).max(120),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string().min(1).max(12_000),
  })).min(1).max(64),
  temperature: z.number().finite().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().max(8_192).optional(),
  response_format: z.object({
    type: z.enum(['text', 'json_object']),
  }).optional(),
  timeoutMs: z.number().int().min(1_000).max(MAX_TIMEOUT_MS).optional(),
}).strict()

function getBearerToken(request: VercelRequest) {
  const authorization = request.headers.authorization
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    throw new Error('Autorización ausente.')
  }

  return authorization.slice('Bearer '.length).trim()
}

function requireOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  const model = process.env.OPENAI_MODEL?.trim()
  const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1'
  const configuredTimeout = process.env.OPENAI_TIMEOUT_MS?.trim()

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY_MISSING')
  }

  if (!model) {
    throw new Error('OPENAI_MODEL_MISSING')
  }

  const baseUrl = new URL(rawBaseUrl)
  const isLocal = baseUrl.protocol === 'http:' && LOCAL_HOSTS.has(baseUrl.hostname)
  if (baseUrl.protocol !== 'https:' && !isLocal) {
    throw new Error('OPENAI_BASE_URL_INVALID')
  }

  const timeoutMs = configuredTimeout === undefined
    ? DEFAULT_TIMEOUT_MS
    : Number(configuredTimeout)
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error('OPENAI_TIMEOUT_INVALID')
  }

  return {
    apiKey,
    model,
    baseUrl: baseUrl.href.replace(/\/$/, ''),
    timeoutMs,
  }
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (rejectInvalidRequest(request, response, 256 * 1024)) return

  try {
    verifyAutomationJwt(getBearerToken(request))
  } catch {
    response.status(401).json({ error: 'Autorización inválida o expirada.', code: 'authorization-invalid' })
    return
  }

  let input
  try {
    input = requestSchema.parse(request.body)
  } catch {
    response.status(422).json({ error: 'Solicitud de proveedor inválida.', code: 'invalid-request' })
    return
  }

  let config
  try {
    config = requireOpenAIConfig()
  } catch (error) {
    const code = error instanceof Error ? error.message : 'OPENAI_CONFIG_INVALID'
    response.status(503).json({
      error: 'El proveedor de IA no está configurado correctamente.',
      code: code.toLowerCase(),
    })
    return
  }

  if (input.model !== config.model) {
    response.status(422).json({
      error: 'El modelo solicitado no coincide con la configuración permitida.',
      code: 'model-mismatch',
    })
    return
  }

  const timeoutMs = input.timeoutMs ?? config.timeoutMs
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > MAX_TIMEOUT_MS) {
    response.status(422).json({
      error: 'El timeout solicitado no es válido.',
      code: 'timeout-invalid',
    })
    return
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const upstreamResponse = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
        ...(input.max_tokens === undefined ? {} : { max_tokens: input.max_tokens }),
        ...(input.response_format === undefined ? {} : { response_format: input.response_format }),
      }),
      signal: controller.signal,
    })

    if (!upstreamResponse.ok) {
      const upstreamBody = await safeReadJson(upstreamResponse)
      const upstreamError =
        upstreamBody && typeof upstreamBody === 'object' && !Array.isArray(upstreamBody)
          ? (upstreamBody as Record<string, unknown>).error
          : undefined
      const upstreamCode =
        upstreamError && typeof upstreamError === 'object' && !Array.isArray(upstreamError)
          ? (upstreamError as Record<string, unknown>).code
          : undefined

      response.status(upstreamResponse.status).json({
        error: 'El proveedor de IA rechazó la solicitud.',
        ...(typeof upstreamCode === 'string' ? { code: upstreamCode } : {}),
      })
      return
    }

    const payload = await upstreamResponse.json()
    response.status(200).json(payload)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      response.status(504).json({
        error: 'El proveedor de IA tardó demasiado en responder.',
        code: 'gateway-timeout',
      })
      return
    }

    response.status(502).json({
      error: 'No se pudo contactar con el proveedor de IA.',
      code: 'gateway-unavailable',
    })
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

/// <reference types="node" />

import { CommunicationConfigurationError } from '../errors/communicationErrors.js'

/**
 * Estricto a propósito: solo "true"/"false" (sin distinguir mayúsculas) son
 * valores válidos. Un valor ausente usa `defaultValue` (siempre `false` para
 * estas banderas), pero un valor presente y no reconocido (typo, "1", "yes",
 * espacio en blanco con basura, etc.) lanza en vez de degradar en silencio a
 * `defaultValue` — un typo en WHATSAPP_CLOUD_ALLOW_REAL_SEND nunca debe leerse
 * como "false" sin que quede constancia explícita del error.
 */
function parseBooleanFlag(envName: string, value: string | undefined, defaultValue: boolean) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return defaultValue
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  throw new CommunicationConfigurationError(
    `${envName} debe ser exactamente "true" o "false" (valor no reconocido).`,
  )
}

function parseRetentionDays(value: string | undefined, defaultValue: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : defaultValue
}

function isProductionEnvironment() {
  return process.env.VERCEL_ENV === 'production'
}

export interface MetaCloudDisabledConfig {
  enabled: false
  allowRealSend: boolean
  webhookEnabled: boolean
  forwardInboundToN8n: boolean
  forwardStatusToN8n: boolean
  messageRetentionDays: number
  idempotencyRetentionDays: number
}

export interface MetaCloudEnabledConfig {
  enabled: true
  allowRealSend: boolean
  webhookEnabled: boolean
  forwardInboundToN8n: boolean
  forwardStatusToN8n: boolean
  messageRetentionDays: number
  idempotencyRetentionDays: number
  appId?: string
  appSecret: string
  accessToken: string
  verifyToken: string
  wabaId?: string
  phoneNumberId: string
  graphApiVersion: string
  n8nCommunicationApiKey: string
}

export type MetaCloudConfig = MetaCloudDisabledConfig | MetaCloudEnabledConfig

const REQUIRED_WHEN_ENABLED: readonly [string, string][] = [
  ['META_APP_SECRET', 'appSecret'],
  ['META_ACCESS_TOKEN', 'accessToken'],
  ['META_VERIFY_TOKEN', 'verifyToken'],
  ['META_PHONE_NUMBER_ID', 'phoneNumberId'],
  ['META_GRAPH_API_VERSION', 'graphApiVersion'],
  ['N8N_COMMUNICATION_API_KEY', 'n8nCommunicationApiKey'],
]

/**
 * Con WHATSAPP_CLOUD_ENABLED=false (o ausente) no exige ninguna variable de
 * Meta: el backend arranca igual y Evolution sigue funcionando. Con
 * WHATSAPP_CLOUD_ENABLED=true, valida que todas las variables requeridas
 * estén presentes y lanza CommunicationConfigurationError si falta alguna —
 * nunca degrada en silencio a un estado "medio configurado".
 */
export function getMetaCloudConfig(): MetaCloudConfig {
  const enabled = parseBooleanFlag('WHATSAPP_CLOUD_ENABLED', process.env.WHATSAPP_CLOUD_ENABLED, false)
  const shared = {
    allowRealSend: parseBooleanFlag('WHATSAPP_CLOUD_ALLOW_REAL_SEND', process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND, false),
    webhookEnabled: parseBooleanFlag('WHATSAPP_CLOUD_WEBHOOK_ENABLED', process.env.WHATSAPP_CLOUD_WEBHOOK_ENABLED, false),
    forwardInboundToN8n: parseBooleanFlag('WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N', process.env.WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N, false),
    forwardStatusToN8n: parseBooleanFlag('WHATSAPP_CLOUD_FORWARD_STATUS_TO_N8N', process.env.WHATSAPP_CLOUD_FORWARD_STATUS_TO_N8N, false),
    messageRetentionDays: parseRetentionDays(process.env.WHATSAPP_MESSAGE_RETENTION_DAYS, 0),
    idempotencyRetentionDays: parseRetentionDays(process.env.WHATSAPP_IDEMPOTENCY_RETENTION_DAYS, 30),
  }

  if (!enabled) {
    return { enabled: false, ...shared }
  }

  const missing = REQUIRED_WHEN_ENABLED
    .filter(([envName]) => !process.env[envName]?.trim())
    .map(([envName]) => envName)

  if (missing.length > 0) {
    throw new CommunicationConfigurationError(
      `WHATSAPP_CLOUD_ENABLED=true requiere: ${missing.join(', ')}.`,
    )
  }

  const graphApiVersion = process.env.META_GRAPH_API_VERSION!.trim()
  if (isProductionEnvironment() && graphApiVersion.toLowerCase() === 'latest') {
    throw new CommunicationConfigurationError(
      'META_GRAPH_API_VERSION="latest" no está permitido en producción. Usa una versión explícita (p. ej. v21.0).',
    )
  }

  return {
    enabled: true,
    ...shared,
    appId: process.env.META_APP_ID?.trim() || undefined,
    appSecret: process.env.META_APP_SECRET!.trim(),
    accessToken: process.env.META_ACCESS_TOKEN!.trim(),
    verifyToken: process.env.META_VERIFY_TOKEN!.trim(),
    wabaId: process.env.META_WABA_ID?.trim() || undefined,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID!.trim(),
    graphApiVersion,
    n8nCommunicationApiKey: process.env.N8N_COMMUNICATION_API_KEY!.trim(),
  }
}

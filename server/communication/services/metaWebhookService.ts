import type { NormalizedMetaWebhookEvent } from '../contracts/metaWebhook.js'
import type { MetaCloudEnabledConfig } from '../config/metaCloudConfig.js'
import { getIdempotencyRecord, saveIdempotencyRecord } from '../repositories/idempotencyRepository.js'
import { touchMetaChannelInbound } from '../repositories/metaChannelRepository.js'
import { updateCorrelationStatusByProviderMessageId } from '../repositories/correlationRepository.js'
import { registerInbound } from './serviceWindowService.js'
import { processInboundStatus } from './messageStatusService.js'
import { forwardInboundMessage, forwardMessageStatus } from './n8nInboundForwarder.js'
import { logCommunicationEvent } from '../security/redactCommunicationData.js'

export interface ProcessWebhookResult {
  processedMessages: number
  duplicateMessages: number
  processedStatuses: number
  duplicateStatuses: number
  unknownEntries: number
  forwardedMessages: number
  forwardedStatuses: number
}

/**
 * `key` es autodescriptivo (providerMessageId + status + timestamp para
 * estados), así que no hace falta comparar un hash de payload: la propia
 * clave identifica de forma única el evento entrante.
 */
async function claimEventOnce(key: string, retentionDays: number): Promise<boolean> {
  const existing = await getIdempotencyRecord(key)
  if (existing) return false
  await saveIdempotencyRecord({
    key, payloadHash: key, resultStatus: 200, resultBody: null, retentionDays,
  })
  return true
}

/**
 * Normaliza, aplica idempotencia, registra estado técnico mínimo, actualiza
 * la actividad del canal persistido (Fase 4) y reenvía a n8n cuando las
 * banderas correspondientes están activas. El reenvío es de un único
 * intento (ver n8nInboundForwarder.ts); no bloquea ni falla el webhook si
 * n8n no responde.
 */
export async function processNormalizedWebhookEvent(
  event: NormalizedMetaWebhookEvent,
  config: MetaCloudEnabledConfig,
): Promise<ProcessWebhookResult> {
  let processedMessages = 0
  let duplicateMessages = 0
  let processedStatuses = 0
  let duplicateStatuses = 0
  let forwardedMessages = 0
  let forwardedStatuses = 0

  for (const message of event.messages) {
    const isNew = await claimEventOnce(`inbound:${message.providerMessageId}`, config.idempotencyRetentionDays)
    if (!isNew) {
      duplicateMessages += 1
      continue
    }

    await registerInbound(message.senderPhone, message.timestamp)
    await touchMetaChannelInbound(message.senderPhone, message.timestamp)
    logCommunicationEvent('whatsapp.message.inbound', {
      providerMessageId: message.providerMessageId,
      type: message.type,
      senderPhone: message.senderPhone,
    })
    processedMessages += 1

    if (config.forwardInboundToN8n) {
      const result = await forwardInboundMessage(message)
      if (result.forwarded) forwardedMessages += 1
    }
  }

  for (const status of event.statuses) {
    const key = `status:${status.providerMessageId}:${status.status}:${status.timestamp}`
    const isNew = await claimEventOnce(key, config.idempotencyRetentionDays)
    if (!isNew) {
      duplicateStatuses += 1
      continue
    }

    await processInboundStatus(status)
    await updateCorrelationStatusByProviderMessageId(status.providerMessageId, status.status)
    logCommunicationEvent('whatsapp.message.status', {
      providerMessageId: status.providerMessageId,
      status: status.status,
    })
    processedStatuses += 1

    if (config.forwardStatusToN8n) {
      const result = await forwardMessageStatus(status)
      if (result.forwarded) forwardedStatuses += 1
    }
  }

  return {
    processedMessages,
    duplicateMessages,
    processedStatuses,
    duplicateStatuses,
    unknownEntries: event.unknownEntries,
    forwardedMessages,
    forwardedStatuses,
  }
}

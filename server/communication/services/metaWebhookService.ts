import type { NormalizedMetaWebhookEvent } from '../contracts/metaWebhook.js'
import type { MetaCloudEnabledConfig } from '../config/metaCloudConfig.js'
import { getIdempotencyRecord, saveIdempotencyRecord } from '../repositories/idempotencyRepository.js'
import { registerInbound } from './serviceWindowService.js'
import { processInboundStatus } from './messageStatusService.js'
import { logCommunicationEvent } from '../security/redactCommunicationData.js'

export interface ProcessWebhookResult {
  processedMessages: number
  duplicateMessages: number
  processedStatuses: number
  duplicateStatuses: number
  unknownEntries: number
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
 * Normaliza, aplica idempotencia y registra estado técnico mínimo. No activa
 * respuestas automáticas ni reenvía a workflows de n8n reales todavía (ver
 * WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N en docs/whatsapp/meta-cloud-webhooks.md).
 */
export async function processNormalizedWebhookEvent(
  event: NormalizedMetaWebhookEvent,
  config: MetaCloudEnabledConfig,
): Promise<ProcessWebhookResult> {
  let processedMessages = 0
  let duplicateMessages = 0
  let processedStatuses = 0
  let duplicateStatuses = 0

  for (const message of event.messages) {
    const isNew = await claimEventOnce(`inbound:${message.providerMessageId}`, config.idempotencyRetentionDays)
    if (!isNew) {
      duplicateMessages += 1
      continue
    }

    await registerInbound(message.senderPhone, message.timestamp)
    logCommunicationEvent('whatsapp.message.inbound', {
      providerMessageId: message.providerMessageId,
      type: message.type,
      senderPhone: message.senderPhone,
    })
    processedMessages += 1
  }

  for (const status of event.statuses) {
    const key = `status:${status.providerMessageId}:${status.status}:${status.timestamp}`
    const isNew = await claimEventOnce(key, config.idempotencyRetentionDays)
    if (!isNew) {
      duplicateStatuses += 1
      continue
    }

    await processInboundStatus(status)
    logCommunicationEvent('whatsapp.message.status', {
      providerMessageId: status.providerMessageId,
      status: status.status,
    })
    processedStatuses += 1
  }

  if (config.forwardInboundToN8n && (event.messages.length > 0 || event.statuses.length > 0)) {
    logCommunicationEvent('whatsapp.webhook.forward_not_implemented', {
      note: 'WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N está activo; el reenvío real llega en la Fase 4.',
    })
  }

  return {
    processedMessages,
    duplicateMessages,
    processedStatuses,
    duplicateStatuses,
    unknownEntries: event.unknownEntries,
  }
}

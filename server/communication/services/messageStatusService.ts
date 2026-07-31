import type { NormalizedWhatsAppMessageStatus } from '../contracts/metaWebhook.js'
import { recordMessageStatus, getLatestMessageStatus } from '../repositories/messageStatusRepository.js'

export async function processInboundStatus(status: NormalizedWhatsAppMessageStatus): Promise<void> {
  await recordMessageStatus({
    providerMessageId: status.providerMessageId,
    status: status.status,
    errorCode: status.errorCode,
    errorMessage: status.errorMessage,
    occurredAt: status.timestamp,
  })
}

export async function recordOutboundStatus(input: {
  providerMessageId: string
  requestId: string
  status: string
  occurredAt: string
}): Promise<void> {
  await recordMessageStatus({
    providerMessageId: input.providerMessageId,
    requestId: input.requestId,
    status: input.status,
    occurredAt: input.occurredAt,
  })
}

export { getLatestMessageStatus }

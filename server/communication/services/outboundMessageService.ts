import type { MarkAsReadRequest, SendTemplateRequest, SendTextRequest } from '../contracts/outboundMessage.js'
import type { CommunicationSuccessResult } from '../contracts/communicationResult.js'
import type { MetaCloudEnabledConfig } from '../config/metaCloudConfig.js'
import { CommunicationTemplateRequiredError } from '../errors/communicationErrors.js'
import { touchMetaChannelOutbound } from '../repositories/metaChannelRepository.js'
import { recordCorrelation } from '../repositories/correlationRepository.js'
import { createMetaCloudClient } from './metaCloudClient.js'
import { withIdempotency } from './idempotencyService.js'
import { getStatus as getServiceWindowStatus } from './serviceWindowService.js'
import { recordOutboundStatus } from './messageStatusService.js'

function simulatedResult(requestId: string): CommunicationSuccessResult {
  return { success: true, requestId, provider: 'meta-cloud', status: 'simulated', simulation: true }
}

interface OutboundContext {
  requestId: string
  context?: {
    eventId?: string
    eventType?: string
    workflowId?: string
    userReference?: string
    deviceReference?: string
  }
}

/**
 * Correlación técnica (requestId ↔ eventId/workflowId/providerMessageId ↔
 * referencias opacas de usuario/dispositivo que envía n8n), nunca datos
 * financieros ni el texto del mensaje. Se registra tanto en simulación como
 * en envío real, para que la trazabilidad de staging sea la misma que en
 * producción.
 */
async function recordOutboundCorrelation(input: OutboundContext, status: string, providerMessageId?: string) {
  await recordCorrelation({
    requestId: input.requestId,
    eventId: input.context?.eventId ?? null,
    workflowId: input.context?.workflowId ?? null,
    userReference: input.context?.userReference ?? null,
    deviceReference: input.context?.deviceReference ?? null,
    providerMessageId: providerMessageId ?? null,
    status,
  })
}

/**
 * Con WHATSAPP_CLOUD_ALLOW_REAL_SEND=false nunca llama a Meta: devuelve un
 * resultado de simulación explícitamente marcado (`simulation: true`), no
 * un falso "accepted" que finja que Meta lo recibió.
 */
export async function sendTextMessage(
  input: SendTextRequest,
  config: MetaCloudEnabledConfig,
): Promise<CommunicationSuccessResult> {
  const { body } = await withIdempotency(
    `outbound:${input.requestId}`,
    input,
    config.idempotencyRetentionDays,
    async () => {
      if (!config.allowRealSend) {
        await recordOutboundCorrelation(input, 'simulated')
        return { status: 200, body: simulatedResult(input.requestId) }
      }

      const windowStatus = await getServiceWindowStatus(input.recipient)
      if (!windowStatus.open) {
        throw new CommunicationTemplateRequiredError('La conversación requiere una plantilla aprobada.')
      }

      const client = createMetaCloudClient(config)
      const result = await client.sendText({ recipient: input.recipient, text: input.text })
      const occurredAt = new Date().toISOString()
      await recordOutboundStatus({
        providerMessageId: result.providerMessageId,
        requestId: input.requestId,
        status: 'sent',
        occurredAt,
      })
      await recordOutboundCorrelation(input, 'accepted', result.providerMessageId)
      await touchMetaChannelOutbound(input.recipient, occurredAt)

      const successBody: CommunicationSuccessResult = {
        success: true,
        requestId: input.requestId,
        provider: 'meta-cloud',
        status: 'accepted',
        providerMessageId: result.providerMessageId,
      }
      return { status: 200, body: successBody }
    },
  )

  return body
}

export async function sendTemplateMessage(
  input: SendTemplateRequest,
  config: MetaCloudEnabledConfig,
): Promise<CommunicationSuccessResult> {
  const { body } = await withIdempotency(
    `outbound:${input.requestId}`,
    input,
    config.idempotencyRetentionDays,
    async () => {
      if (!config.allowRealSend) {
        await recordOutboundCorrelation(input, 'simulated')
        return { status: 200, body: simulatedResult(input.requestId) }
      }

      const client = createMetaCloudClient(config)
      const result = await client.sendTemplate({
        recipient: input.recipient,
        templateName: input.template.name,
        languageCode: input.template.languageCode,
        components: input.template.components,
      })
      const occurredAt = new Date().toISOString()
      await recordOutboundStatus({
        providerMessageId: result.providerMessageId,
        requestId: input.requestId,
        status: 'sent',
        occurredAt,
      })
      await recordOutboundCorrelation(input, 'accepted', result.providerMessageId)
      await touchMetaChannelOutbound(input.recipient, occurredAt)

      const successBody: CommunicationSuccessResult = {
        success: true,
        requestId: input.requestId,
        provider: 'meta-cloud',
        status: 'accepted',
        providerMessageId: result.providerMessageId,
      }
      return { status: 200, body: successBody }
    },
  )

  return body
}

export async function markMessageAsRead(
  input: MarkAsReadRequest,
  config: MetaCloudEnabledConfig,
): Promise<CommunicationSuccessResult> {
  const { body } = await withIdempotency(
    `outbound:mark-read:${input.requestId}`,
    input,
    config.idempotencyRetentionDays,
    async () => {
      if (!config.allowRealSend) {
        return { status: 200, body: simulatedResult(input.requestId) }
      }

      const client = createMetaCloudClient(config)
      await client.markAsRead(input.providerMessageId)

      const successBody: CommunicationSuccessResult = {
        success: true,
        requestId: input.requestId,
        provider: 'meta-cloud',
        status: 'accepted',
      }
      return { status: 200, body: successBody }
    },
  )

  return body
}

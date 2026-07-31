export { getMetaCloudConfig } from './config/metaCloudConfig.js'
export type { MetaCloudConfig, MetaCloudEnabledConfig, MetaCloudDisabledConfig } from './config/metaCloudConfig.js'

export * from './errors/communicationErrors.js'

export {
  sendTextRequestSchema,
  sendTemplateRequestSchema,
  markAsReadRequestSchema,
} from './contracts/outboundMessage.js'
export type { SendTextRequest, SendTemplateRequest, MarkAsReadRequest } from './contracts/outboundMessage.js'
export type { CommunicationSuccessResult, CommunicationErrorResult } from './contracts/communicationResult.js'
export { normalizeMetaWebhookPayload } from './contracts/metaWebhook.js'
export type {
  NormalizedMetaWebhookEvent,
  NormalizedInboundWhatsAppMessage,
  NormalizedWhatsAppMessageStatus,
} from './contracts/metaWebhook.js'

export { authenticateAutomationClient } from './security/authenticateAutomationClient.js'
export { verifyMetaWebhookSignature } from './security/verifyMetaSignature.js'
export { readRawRequestBody } from './security/rawBody.js'
export { redactCommunicationData, logCommunicationEvent } from './security/redactCommunicationData.js'

export { createMetaCloudClient } from './services/metaCloudClient.js'
export type { MetaCloudClient } from './services/metaCloudClient.js'
export { sendTextMessage, sendTemplateMessage, markMessageAsRead } from './services/outboundMessageService.js'
export { processNormalizedWebhookEvent } from './services/metaWebhookService.js'
export { getStatus as getServiceWindowStatus } from './services/serviceWindowService.js'

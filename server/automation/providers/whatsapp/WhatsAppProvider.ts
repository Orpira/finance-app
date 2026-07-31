import type { AutomationEvent } from '../../eventTypes.js'
import type { WebhookDispatchResult } from '../../webhookDispatcher.js'

export type WhatsAppProviderName = 'evolution' | 'meta-cloud'

export const WHATSAPP_PROVIDER_NAMES = [
  'evolution',
  'meta-cloud',
] as const satisfies readonly WhatsAppProviderName[]

export interface WhatsAppProviderCapabilities {
  supportsQr: boolean
  supportsPairingCode: boolean
  supportsTemplates: boolean
  supportsMessageStatus: boolean
  supportsInboundWebhooks: boolean
  supportsCoexistence: boolean
}

/**
 * Eventos que Private Balance gestiona hoy como "canal WhatsApp" (conexión,
 * desconexión, estado, prueba y preferencias). No incluye los eventos
 * financieros (income.created, expense.created, calendar.created,
 * service.completed): esos siempre viajan por el webhook general de
 * automatización, con independencia del proveedor de WhatsApp activo.
 */
const WHATSAPP_CHANNEL_EVENTS = [
  'device.whatsapp.connect.requested',
  'communication.whatsapp.qr.requested',
  'communication.whatsapp.status.requested',
  'communication.whatsapp.disconnect.requested',
  'communication.whatsapp.test.requested',
  'communication.whatsapp.preferences.updated',
] as const satisfies readonly AutomationEvent[]

export type WhatsAppChannelEvent = (typeof WHATSAPP_CHANNEL_EVENTS)[number]

export function isWhatsAppChannelEvent(event: AutomationEvent): event is WhatsAppChannelEvent {
  return (WHATSAPP_CHANNEL_EVENTS as readonly AutomationEvent[]).includes(event)
}

export interface WhatsAppChannelEventInput {
  event: WhatsAppChannelEvent
  eventId: string
  payload: unknown
}

export type WhatsAppChannelEventResult = WebhookDispatchResult

/**
 * Operaciones que este backend realiza hoy contra el proveedor de WhatsApp
 * activo. Deliberadamente NO incluye `sendText`/`sendTemplate`/`markAsRead`:
 * el envío real de mensajes ocurre íntegramente dentro de n8n (nodo "HTTP
 * Request WhatsApp" del workflow "Nuevo Ingreso", ver
 * docs/whatsapp/n8n-current-contracts.md). Este backend nunca llama a
 * Evolution directamente; solo reenvía eventos de canal y eventos financieros
 * enriquecidos con el canal activo. Esos métodos se añadirán cuando el
 * Backend Comunicaciones (fases posteriores) asuma el envío real hacia
 * WhatsApp Cloud API.
 */
export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName
  getCapabilities(): WhatsAppProviderCapabilities
  dispatchChannelEvent(input: WhatsAppChannelEventInput): Promise<WhatsAppChannelEventResult>
}

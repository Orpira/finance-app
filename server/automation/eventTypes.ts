export const AUTOMATION_EVENT_TYPES = [
  'income.created',
  'service.completed',
  'expense.created',
  'calendar.created',
  'device.provision.requested',
  'device.whatsapp.connect.requested',
  // Compatibility for QR requests already persisted by older clients.
  'communication.whatsapp.qr.requested',
  'communication.whatsapp.status.requested',
  'communication.whatsapp.disconnect.requested',
  'communication.whatsapp.test.requested',
  'communication.whatsapp.preferences.updated',
] as const

export type AutomationEvent = (typeof AUTOMATION_EVENT_TYPES)[number]

export interface AutomationEnvelope {
  eventId: string
  event: AutomationEvent
  createdAt: string
  schemaVersion: 1
  source?: 'private-balance-pwa'
  data: Record<string, unknown>
  userCode?: string
  deviceCode?: string
  timezone?: string
  locale?: string
}

const SYNCHRONOUS_EVENTS = new Set<AutomationEvent>([
  'device.whatsapp.connect.requested',
  'communication.whatsapp.qr.requested',
  'communication.whatsapp.status.requested',
  'communication.whatsapp.disconnect.requested',
  'communication.whatsapp.test.requested',
  'communication.whatsapp.preferences.updated',
])

export function isSynchronousAutomationEvent(event: AutomationEvent) {
  return SYNCHRONOUS_EVENTS.has(event)
}

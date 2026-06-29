export const PRIVATE_BALANCE_AUTOMATION_EVENTS = [
  'income.created',
  'expense.created',
  'calendar.created',
  'device.provision.requested',
  'device.whatsapp.connect.requested',
  'communication.whatsapp.qr.requested',
  'communication.whatsapp.status.requested',
  'communication.whatsapp.disconnect.requested',
  'communication.whatsapp.test.requested',
  'communication.whatsapp.preferences.updated',
] as const

export type PrivateBalanceEvent =
  (typeof PRIVATE_BALANCE_AUTOMATION_EVENTS)[number]

export interface AutomationEventEnvelope {
  eventId: string
  event: PrivateBalanceEvent
  createdAt: string
  schemaVersion: 1
  source?: 'private-balance-pwa'
  data: Record<string, unknown>
}

export interface AutomationOutboxRecord extends AutomationEventEnvelope {
  attempts: number
  nextAttemptAt: string
  lastAttemptAt?: string
  lastError?: string
}

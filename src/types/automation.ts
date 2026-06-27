export const PRIVATE_BALANCE_AUTOMATION_EVENTS = [
  'income.created',
  'expense.created',
  'calendar.created',
] as const

export type PrivateBalanceEvent =
  (typeof PRIVATE_BALANCE_AUTOMATION_EVENTS)[number]

export interface AutomationEventEnvelope {
  eventId: string
  event: PrivateBalanceEvent
  createdAt: string
  schemaVersion: 1
  data: Record<string, unknown>
}

export interface AutomationOutboxRecord extends AutomationEventEnvelope {
  attempts: number
  nextAttemptAt: string
  lastAttemptAt?: string
  lastError?: string
}

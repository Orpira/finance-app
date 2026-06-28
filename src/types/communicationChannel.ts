export type CommunicationChannelStatus =
  | 'not_configured'
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'error'

export interface CommunicationChannel {
  id: 'whatsapp'
  type: 'whatsapp'
  provider: 'evolution-api'
  instanceName: string
  status: CommunicationChannelStatus
  qrCode?: string
  connectedNumber?: string
  notifyIncomeCreated: boolean
  notifyExpenseCreated: boolean
  notifyCalendarReminder: boolean
  notifyBackupCompleted: boolean
  createdAt: string
  updatedAt: string
}

export type WhatsAppNotificationPreferences = Pick<
  CommunicationChannel,
  | 'notifyIncomeCreated'
  | 'notifyExpenseCreated'
  | 'notifyCalendarReminder'
  | 'notifyBackupCompleted'
>

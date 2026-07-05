export type CommunicationChannelStatus =
  | 'not_configured'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'

export interface CommunicationChannel {
  id: 'whatsapp'
  type: 'whatsapp'
  provider: 'evolution-api'
  instanceName: string
  instanceId?: string
  status: CommunicationChannelStatus
  qrCode?: string
  phoneNumber?: string
  connectedNumber?: string
  pairingCode?: string
  ownerJid?: string
  profileName?: string
  profilePhoto?: string
  providerMetadata?: Record<string, unknown>
  connectedAt?: string
  lastSeenAt?: string
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

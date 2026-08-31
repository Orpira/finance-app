export type NotificationPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type NotificationSource =
  | 'financial'
  | 'goal'
  | 'season'
  | 'agenda'
  | 'security'
  | 'system'
  | 'copilot'

export type NotificationStatus =
  | 'new'
  | 'seen'
  | 'read'
  | 'dismissed'
  | 'acted'
  | 'expired'
  | 'suppressed'

export type NotificationPrivacy = 'private' | 'generic' | 'user_allowed'

export type NotificationSuppressionReason =
  | 'disabled'
  | 'category_disabled'
  | 'duplicate'
  | 'cooldown'
  | 'frequency_limit'
  | 'expired'
  | 'stale'
  | 'contradictory'
  | 'low_confidence'
  | 'quiet_hours'
  | 'privacy'
  | 'invalid_action'
  | 'not_relevant'

export interface NotificationAction {
  label: string
  destination: string
}

/** Fase 1.5 — superficies por las que una CopilotNotification puede entregarse. */
export type NotificationChannel = 'in_app' | 'android'

export type AndroidDeliveryStatus = 'delivered' | 'permission_denied' | 'failed' | 'not_requested'

export interface NotificationDeliveryState {
  inApp?: {
    deliveredAt?: string
  }
  android?: {
    deliveredAt?: string
    nativeId?: number
    status?: AndroidDeliveryStatus
  }
}

/**
 * A reason to possibly notify the user. Produced by rules (season, agenda, ...).
 * Never delivered directly — always evaluated by the NotificationPolicyEngine first.
 */
export interface NotificationCandidate {
  type: string
  priority: NotificationPriority
  source: NotificationSource
  title: string
  message: string
  reason?: string
  /** Required when priority is not defined by a fully deterministic rule (ADR-034 §8). */
  confidence?: number
  dedupKey: string
  action?: NotificationAction
  expiresAt?: string
  /** Overrides the default NOTIFICATION_COOLDOWNS entry for this candidate's type. */
  cooldownMs?: number
  privacy?: NotificationPrivacy
  metadata?: Record<string, unknown>
  /** Re-checked immediately before delivery; false cancels a stale candidate (ADR-034 §14). */
  revalidate?: () => boolean | Promise<boolean>
}

/** A candidate the Policy Engine authorized and persisted. */
export interface CopilotNotification {
  id: string
  type: string
  priority: NotificationPriority
  source: NotificationSource
  title: string
  message: string
  reason?: string
  confidence?: number
  action?: NotificationAction
  dedupKey: string
  createdAt: string
  expiresAt?: string
  cooldownUntil?: string
  status: NotificationStatus
  privacy: NotificationPrivacy
  metadata?: Record<string, unknown>
  /** Estado de entrega por canal (Fase 1.5). No confundir con `status`, que es funcional (read/acted/...). */
  delivery?: NotificationDeliveryState
}

export type NotificationDecision =
  | { decision: 'deliver'; notification: CopilotNotification }
  | { decision: 'defer'; reason: NotificationSuppressionReason }
  | { decision: 'suppress'; reason: NotificationSuppressionReason }

export interface NotificationPreferences {
  copilotNotificationsEnabled: boolean
  importantAlertsEnabled: boolean
  financialInsightsEnabled: boolean
  agendaNotificationsEnabled: boolean
  periodicSummaryEnabled: boolean
  showFinancialDetailsExternally: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  /** Fase 1.5 — interruptor general de entrega nativa Android (P0/P1 por defecto). */
  androidNotificationsEnabled: boolean
  androidActionRequiredEnabled: boolean
  androidFinancialInsightsEnabled: boolean
  androidSummaryEnabled: boolean
}

/** Everything the Policy Engine needs besides the candidate. Assembled by NotificationService. */
export interface NotificationPolicyContext {
  now: Date
  preferences: NotificationPreferences
  /** Most recent non-expired notification sharing the candidate's dedupKey, if any. */
  activeByDedupKey: CopilotNotification | undefined
  /** Notifications of the candidate's priority delivered since local midnight. */
  deliveredTodayForPriority: number
  /** Non-critical (P1+P2+P3) notifications delivered since local midnight. */
  deliveredTodayNonCritical: number
}

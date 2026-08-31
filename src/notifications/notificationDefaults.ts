import type { NotificationPreferences } from './types'

/** ADR-034 §19 — conservative Fase 1 defaults. Kept dependency-free (no db/service imports) so db.ts can use it too. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  copilotNotificationsEnabled: true,
  importantAlertsEnabled: true,
  financialInsightsEnabled: true,
  agendaNotificationsEnabled: true,
  periodicSummaryEnabled: false,
  showFinancialDetailsExternally: false,
  quietHoursEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  androidNotificationsEnabled: true,
  androidActionRequiredEnabled: true,
  androidFinancialInsightsEnabled: false,
  androidSummaryEnabled: false,
}

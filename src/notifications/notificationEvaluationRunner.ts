import { getSettings } from '../services/settingsService'
import { usesProfessionalAgenda } from '../utils/usageMode'
import { getNotificationService, notifyNotificationsChanged } from './notificationService'
import { buildAgendaPendingActionCandidate } from './rules/agendaPendingActionRule'
import { buildSeasonEndingCandidate } from './rules/seasonEndingRule'
import { buildSeasonGoalAchievedCandidate } from './rules/seasonGoalAchievedRule'
import { buildSeasonGoalRiskCandidate } from './rules/seasonGoalRiskRule'

/**
 * Fase 1 rules only (ADR-034 §30). Runs Insight → Candidate → NotificationService.submitCandidate
 * (which is itself Candidate → Policy Engine → Repository) for every deterministic Fase 1 source.
 * Safe to call repeatedly: dedup/cooldown/frequency limits make re-evaluation idempotent, which is
 * how this design gets "defer" semantics for quiet hours without a real delivery queue (see
 * notificationPolicyEngine.ts doc comment).
 */
export async function runNotificationEvaluation(): Promise<void> {
  const settings = await getSettings()
  // Season/goal/agenda rules only apply to the Profesional workflow (routes are guarded the same way).
  if (!usesProfessionalAgenda(settings)) return

  const service = getNotificationService()

  const builders = [
    buildSeasonEndingCandidate,
    buildSeasonGoalRiskCandidate,
    buildSeasonGoalAchievedCandidate,
    buildAgendaPendingActionCandidate,
  ]

  let delivered = false

  for (const build of builders) {
    try {
      const candidate = await build()
      if (!candidate) continue
      const decision = await service.submitCandidate(candidate)
      if (decision.decision === 'deliver') delivered = true
    } catch (error) {
      console.warn('[copilot-notifications] regla de evaluación falló', error)
    }
  }

  if (delivered) notifyNotificationsChanged()
}

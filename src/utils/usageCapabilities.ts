import type { ActiveContext } from '../types/settings'

/**
 * Every capability gate audited in el Bloque 3 (modos de uso, especificación
 * "Personal, Profesional e Híbrido"). This is the documented single source
 * of truth the audit asked for — it does not replace the existing
 * `isProfessionalMode`/`requiresSeason`/`usesEarningPercentage`/
 * `usesProfessionalAgenda` helpers in `usageMode.ts` (all built on the same
 * `resolveActiveUsageMode`), which stay as the more ergonomic call at each
 * of their ~50 existing call sites (forms, routes, services, exports,
 * assistant). Both read the same underlying resolution; this module exists
 * so a capability question always has one canonical, typed answer to point
 * to instead of a fresh ad hoc `usageMode === 'professional'` check.
 */
export type UsageCapability =
  | 'payment-method'
  | 'main-priority'
  | 'income-calculation-method'
  | 'time-based-income'
  | 'professional-percentages'
  | 'professional-agenda'
  | 'unreported-income'
  | 'professional-notifications'

/**
 * Every capability audited so far is professional-only. 'unreported-income'
 * additionally depends on `settings.showUnreportedIncome` (a per-installation
 * toggle within Profesional) — that secondary check stays with the caller
 * (incomeReport.service.ts / homePendingIncomePresentation.ts), since it is
 * not a function of `activeContext` at all.
 */
const PROFESSIONAL_ONLY_CAPABILITIES: ReadonlySet<UsageCapability> = new Set([
  'payment-method',
  'main-priority',
  'income-calculation-method',
  'time-based-income',
  'professional-percentages',
  'professional-agenda',
  'unreported-income',
  'professional-notifications',
])

export function canUseCapability(
  capability: UsageCapability,
  activeContext: ActiveContext,
): boolean {
  if (!PROFESSIONAL_ONLY_CAPABILITIES.has(capability)) return true
  return activeContext === 'professional'
}

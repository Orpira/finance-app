export const COACHING_PROTOCOL_VERSION = 1 as const

/**
 * Tipo de oportunidad detectada (seccion 5). Se deriva exclusivamente de
 * campos ya certificados y estables de `FinancialInsight.category` /
 * `FinancialRecommendedAction.type` -- nunca de heuristicas nuevas sobre
 * montos o tendencias (DA-0172-01, DA-0172-02): el Opportunity Detector no
 * sabe "si los ingresos estan creciendo o son inestables", solo que el
 * Insight/Planning Engine ya certificado produjo algo relevante para esa
 * categoria.
 */
export const OPPORTUNITY_TYPES = [
  'BUDGET_OPPORTUNITY',
  'GOAL_OPPORTUNITY',
  'EXPENSE_OPPORTUNITY',
  'INCOME_OPPORTUNITY',
  'SUBSCRIPTION_OPPORTUNITY',
  'FINANCIAL_HEALTH_OPPORTUNITY',
] as const

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number]

export interface CoachingOpportunity {
  readonly protocolVersion: typeof COACHING_PROTOCOL_VERSION
  readonly opportunityId: string
  readonly type: OpportunityType
  readonly sourceKind: 'insight' | 'action'
  readonly title: string
  readonly recommendationText: string
  readonly rank: number
}

export interface NextBestAction {
  readonly opportunityId: string
  readonly type: OpportunityType
  readonly actionText: string
  readonly justification: string
}

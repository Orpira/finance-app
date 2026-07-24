import type {
  FinancialPlanningImpact,
  FinancialPlanningPrioritizer,
  FinancialPlanningPrioritizerConfig,
  FinancialPlanningPriority,
  FinancialRecommendedAction,
} from './financialPlanningContracts'

const DEFAULT_PRIORITY_ORDER: readonly FinancialPlanningPriority[] = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
]

const DEFAULT_IMPACT_ORDER: readonly FinancialPlanningImpact[] = [
  'HIGH',
  'MEDIUM',
  'LOW',
]

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function signature(action: FinancialRecommendedAction): string {
  return [
    normalizeText(action.type),
    normalizeText(action.description),
    normalizeText(action.expectedBenefit),
    action.relatedGoal === null ? 'no-goal' : normalizeText(action.relatedGoal),
  ].join('|')
}

function rank(value: string, order: readonly string[]): number {
  const index = order.indexOf(value)
  return index === -1 ? order.length : index
}

function impactFromEffort(action: FinancialRecommendedAction): FinancialPlanningImpact {
  if (action.effort === 'LOW' && (action.priority === 'CRITICAL' || action.priority === 'HIGH')) {
    return 'HIGH'
  }

  if (action.effort === 'HIGH' && action.priority === 'INFO') {
    return 'LOW'
  }

  if (action.priority === 'CRITICAL' || action.priority === 'HIGH') {
    return 'HIGH'
  }

  if (action.priority === 'MEDIUM') {
    return 'MEDIUM'
  }

  return 'LOW'
}

export function createFinancialPlanningPrioritizer(
  config: Partial<FinancialPlanningPrioritizerConfig> = {},
): FinancialPlanningPrioritizer {
  const resolved: FinancialPlanningPrioritizerConfig = {
    maxActions: config.maxActions ?? 8,
    priorityOrder: config.priorityOrder ?? DEFAULT_PRIORITY_ORDER,
    impactOrder: config.impactOrder ?? DEFAULT_IMPACT_ORDER,
  }

  return {
    prioritize(actions) {
      const deduplicated: FinancialRecommendedAction[] = []
      const seen = new Set<string>()

      for (const action of actions) {
        const key = signature(action)
        if (seen.has(key)) {
          continue
        }

        seen.add(key)
        deduplicated.push(action)
      }

      return deduplicated
        .slice()
        .sort((left, right) => {
          const leftImpact = impactFromEffort(left)
          const rightImpact = impactFromEffort(right)
          const impactRank = rank(leftImpact, resolved.impactOrder) - rank(rightImpact, resolved.impactOrder)
          if (impactRank !== 0) {
            return impactRank
          }

          const priorityRank = rank(left.priority, resolved.priorityOrder) - rank(right.priority, resolved.priorityOrder)
          if (priorityRank !== 0) {
            return priorityRank
          }

          return left.actionId.localeCompare(right.actionId)
        })
        .slice(0, resolved.maxActions)
    },
  }
}

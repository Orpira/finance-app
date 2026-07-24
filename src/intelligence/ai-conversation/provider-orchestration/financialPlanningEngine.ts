import type {
  FinancialActionPlan,
  FinancialPlanningEngine,
  FinancialPlanningEngineDependencies,
  FinancialPlanningImpact,
  FinancialPlanningPriority,
  FinancialPlanningRegistry,
  FinancialPlanningStrategy,
  FinancialRecommendedAction,
} from './financialPlanningContracts'
import {
  createFinancialPlanningPrioritizer,
} from './financialPlanningPrioritizer'
import {
  createFinancialPlanningRegistry,
} from './financialPlanningRegistry'
import {
  createBudgetOptimizationStrategy,
} from './planning/budgetOptimizationStrategy'
import {
  createSavingsImprovementStrategy,
} from './planning/savingsImprovementStrategy'
import {
  createGoalRecoveryStrategy,
} from './planning/goalRecoveryStrategy'
import {
  createExpenseReductionStrategy,
} from './planning/expenseReductionStrategy'
import {
  createCashFlowStabilizationStrategy,
} from './planning/cashFlowStabilizationStrategy'
import {
  createFinancialHealthImprovementStrategy,
} from './planning/financialHealthImprovementStrategy'
import {
  validateFinancialActionPlan,
  validateFinancialPlanningPrioritizer,
  validateFinancialPlanningRegistry,
} from './financialPlanningValidator'

function rankPriority(priority: FinancialPlanningPriority): number {
  if (priority === 'CRITICAL') return 0
  if (priority === 'HIGH') return 1
  if (priority === 'MEDIUM') return 2
  if (priority === 'LOW') return 3
  return 4
}

function rankImpact(impact: FinancialPlanningImpact): number {
  if (impact === 'HIGH') return 0
  if (impact === 'MEDIUM') return 1
  return 2
}

function highestPriority(
  actions: readonly FinancialRecommendedAction[],
): FinancialPlanningPriority {
  if (actions.length === 0) {
    return 'INFO'
  }

  return actions
    .slice()
    .sort((left, right) => rankPriority(left.priority) - rankPriority(right.priority))[0]?.priority ?? 'INFO'
}

function highestImpact(
  plans: readonly FinancialActionPlan[],
): FinancialPlanningImpact {
  if (plans.length === 0) {
    return 'LOW'
  }

  return plans
    .slice()
    .sort((left, right) => rankImpact(left.estimatedImpact) - rankImpact(right.estimatedImpact))[0]?.estimatedImpact ?? 'LOW'
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function createNoopMetricsRecorder() {
  return {
    record() {
      // observabilidad opt-in
    },
  }
}

function createDefaultStrategies(): readonly FinancialPlanningStrategy[] {
  return [
    createBudgetOptimizationStrategy(),
    createSavingsImprovementStrategy(),
    createGoalRecoveryStrategy(),
    createExpenseReductionStrategy(),
    createCashFlowStabilizationStrategy(),
    createFinancialHealthImprovementStrategy(),
  ]
}

function createDefaultRegistry(): FinancialPlanningRegistry {
  const registry = createFinancialPlanningRegistry(createDefaultStrategies())
  const validation = validateFinancialPlanningRegistry(registry)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return registry
}

export function createFinancialPlanningEngine(
  dependencies: FinancialPlanningEngineDependencies = {},
): FinancialPlanningEngine {
  const registry = dependencies.registry ?? createDefaultRegistry()
  const prioritizer = dependencies.prioritizer ?? createFinancialPlanningPrioritizer({
    maxActions: 8,
  })
  const metrics = dependencies.metrics ?? createNoopMetricsRecorder()

  const registryValidation = validateFinancialPlanningRegistry(registry)
  if (registryValidation !== null) {
    throw new Error(registryValidation.safeMessage)
  }

  const prioritizerValidation = validateFinancialPlanningPrioritizer(prioritizer)
  if (prioritizerValidation !== null) {
    throw new Error(prioritizerValidation.safeMessage)
  }

  return {
    build(input) {
      const strategyInput = {
        sessionId: input.sessionId,
        userMessage: input.userMessage,
        requestedAt: input.requestedAt,
        executionPlan: input.executionPlan,
        insights: input.insights,
      }

      const plans: FinancialActionPlan[] = []
      for (const strategy of registry.findSupporting(strategyInput)) {
        const startedAt = Date.now()
        try {
          const plan = strategy.buildPlan(strategyInput)
          if (plan !== null) {
            const validation = validateFinancialActionPlan(plan)
            if (validation === null) {
              plans.push(plan)
              metrics.record({
                strategyId: strategy.strategyId,
                planId: plan.planId,
                actionCount: plan.recommendedActions.length,
                priority: plan.priority,
                durationMs: Date.now() - startedAt,
                success: true,
              })
            } else {
              metrics.record({
                strategyId: strategy.strategyId,
                planId: null,
                actionCount: 0,
                priority: null,
                durationMs: Date.now() - startedAt,
                success: false,
                errorCode: validation.code,
              })
            }
          } else {
            metrics.record({
              strategyId: strategy.strategyId,
              planId: null,
              actionCount: 0,
              priority: null,
              durationMs: Date.now() - startedAt,
              success: true,
            })
          }
        } catch (error) {
          metrics.record({
            strategyId: strategy.strategyId,
            planId: null,
            actionCount: 0,
            priority: null,
            durationMs: Date.now() - startedAt,
            success: false,
            ...(error instanceof Error ? { errorCode: error.name } : {}),
          })
        }
      }

      if (plans.length === 0) {
        return null
      }

      const mergedActions = prioritizer.prioritize(
        plans.flatMap((plan) => plan.recommendedActions),
      )

      if (mergedActions.length === 0) {
        return null
      }

      const objective = plans[0]?.objective ?? 'Organizar acciones financieras priorizadas.'
      const summary = `Se generaron ${mergedActions.length} acciones recomendadas priorizadas.`

      const actionPlan: FinancialActionPlan = {
        planId: `financial-action-plan:${input.sessionId}:${input.requestedAt}`,
        createdAt: input.requestedAt,
        title: 'Plan financiero inteligente',
        summary,
        objective,
        priority: highestPriority(mergedActions),
        estimatedImpact: highestImpact(plans),
        recommendedActions: mergedActions,
        relatedInsights: unique(plans.flatMap((plan) => plan.relatedInsights)),
        assumptions: unique(plans.flatMap((plan) => plan.assumptions)),
        warnings: unique(plans.flatMap((plan) => plan.warnings)),
      }

      const validation = validateFinancialActionPlan(actionPlan)
      if (validation !== null) {
        return null
      }

      return actionPlan
    },
  }
}

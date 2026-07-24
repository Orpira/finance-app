import {
  createFinancialInsightsToolUseCase,
  type FinancialInsightsToolUseCase,
} from '../../ai-tools/financial/insightsTool'
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'
import type {
  FinancialInsight,
  FinancialInsightEngine,
  FinancialInsightEngineDependencies,
  FinancialInsightEngineInput,
  FinancialInsightEvaluator,
  FinancialInsightPrioritizer,
  FinancialInsightRegistry,
} from './financialInsightContracts'
import {
  createFinancialInsightPrioritizer,
} from './financialInsightPrioritizer'
import {
  createFinancialInsightRegistry,
} from './financialInsightRegistry'
import {
  validateFinancialInsightPrioritizer,
  validateFinancialInsightRegistry,
} from './financialInsightValidator'
import {
  createBudgetOverspendingEvaluator,
} from './insights/budgetOverspendingEvaluator'
import {
  createSavingsGoalRiskEvaluator,
} from './insights/savingsGoalRiskEvaluator'
import {
  createExpenseTrendEvaluator,
} from './insights/expenseTrendEvaluator'
import {
  createIncomeStabilityEvaluator,
} from './insights/incomeStabilityEvaluator'
import {
  createSubscriptionOpportunityEvaluator,
} from './insights/subscriptionOpportunityEvaluator'
import {
  createFinancialHealthEvaluator,
} from './insights/financialHealthEvaluator'
import type {
  FinancialReportFilters,
  FinancialReportOutput,
} from '../../ai-tools/financial/reportsContracts'
import type {
  AIToolJsonValue,
} from '../../ai-tools'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonValue(value: unknown): value is AIToolJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item))
  }

  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item))
  }

  return false
}

function extractPeriod(
  planContext: FinancialConversationExecutionPlan['context'] | undefined,
  snapshotPeriod: Readonly<Record<string, AIToolJsonValue>> | null | undefined,
): Readonly<Record<string, AIToolJsonValue>> | undefined {
  if (planContext?.activePeriod !== undefined && isJsonValue(planContext.activePeriod)) {
    return structuredClone(planContext.activePeriod)
  }

  return snapshotPeriod === undefined || snapshotPeriod === null
    ? undefined
    : structuredClone(snapshotPeriod)
}

function buildInsightsToolFilters(input: FinancialInsightEngineInput): FinancialReportFilters | undefined {
  const period = extractPeriod(input.plan.context, input.snapshot?.lastPeriod)
  const filters: FinancialReportFilters = {
    ...(period === undefined ? {} : { period: period as FinancialReportFilters['period'] }),
    ...(input.plan.context?.activeCategory === undefined || input.plan.context.activeCategory === null
      ? {}
      : { tags: [input.plan.context.activeCategory] }),
  }

  return Object.keys(filters).length === 0 ? undefined : filters
}

function buildInsightsToolUseCase(
  useCase: FinancialInsightsToolUseCase | undefined,
): FinancialInsightsToolUseCase {
  return useCase ?? createFinancialInsightsToolUseCase()
}

function createNoopMetricsRecorder() {
  return {
    record() {
      // observabilidad opt-in
    },
  }
}

function createInsightsReport(input: {
  readonly sessionId: string
  readonly requestedAt: string
  readonly plan: FinancialConversationExecutionPlan
  readonly snapshot: FinancialInsightEngineInput['snapshot']
  readonly useCase: FinancialInsightsToolUseCase
}): Promise<FinancialReportOutput | null> {
  const filters = buildInsightsToolFilters({
    sessionId: input.sessionId,
    userMessage: '',
    requestedAt: input.requestedAt,
    plan: input.plan,
    snapshot: input.snapshot,
  })

  return input.useCase.execute({
    requestId: `financial-insight-engine:${input.sessionId}:${input.requestedAt}`,
    requestedAt: input.requestedAt,
    format: 'json',
    ...(filters === undefined ? {} : { filters }),
  }).then((result) => {
    if (result.kind === 'failure') {
      return null
    }

    return result.output
  }).catch(() => null)
}

function createDefaultEvaluators(): readonly FinancialInsightEvaluator[] {
  return [
    createBudgetOverspendingEvaluator(),
    createSavingsGoalRiskEvaluator(),
    createExpenseTrendEvaluator(),
    createIncomeStabilityEvaluator(),
    createSubscriptionOpportunityEvaluator(),
    createFinancialHealthEvaluator(),
  ]
}

function createDefaultRegistry(): FinancialInsightRegistry {
  const registry = createFinancialInsightRegistry(createDefaultEvaluators())
  const validation = validateFinancialInsightRegistry(registry)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return registry
}

function createDefaultPrioritizer(input: FinancialInsightEngineDependencies): FinancialInsightPrioritizer {
  const prioritizer = input.prioritizer ?? createFinancialInsightPrioritizer({
    maxInsights: 5,
  })

  const validation = validateFinancialInsightPrioritizer(prioritizer)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return prioritizer
}

function createExecutionContext(input: FinancialInsightEngineInput) {
  return {
    sessionId: input.sessionId,
    userMessage: input.userMessage,
    requestedAt: input.requestedAt,
    plan: input.plan,
    snapshot: input.snapshot,
  }
}

export function createFinancialInsightEngine(
  input: FinancialInsightEngineDependencies = {},
): FinancialInsightEngine {
  const registry = input.registry ?? createDefaultRegistry()
  const prioritizer = createDefaultPrioritizer(input)
  const toolUseCase = buildInsightsToolUseCase(input.financialInsightsToolUseCase)
  const metrics = input.metrics ?? createNoopMetricsRecorder()

  return {
    async evaluate(engineInput: FinancialInsightEngineInput): Promise<readonly FinancialInsight[]> {
      const report = await createInsightsReport({
        sessionId: engineInput.sessionId,
        requestedAt: engineInput.requestedAt,
        plan: engineInput.plan,
        snapshot: engineInput.snapshot,
        useCase: toolUseCase,
      })

      const evaluationInput = {
        ...createExecutionContext(engineInput),
        report,
      }

      const evaluators = registry.findSupporting(evaluationInput)
      const insights: FinancialInsight[] = []

      for (const evaluator of evaluators) {
        const evaluatorStartedAt = Date.now()
        try {
          const evaluated = await evaluator.evaluate(evaluationInput)
          for (const insight of evaluated) {
            insights.push(insight)
          }

          metrics.record({
            evaluatorId: evaluator.evaluatorId,
            insightId: evaluated[0]?.insightId ?? null,
            severity: evaluated[0]?.severity ?? null,
            durationMs: Date.now() - evaluatorStartedAt,
            generatedCount: evaluated.length,
            success: true,
          })
        } catch (error) {
          metrics.record({
            evaluatorId: evaluator.evaluatorId,
            insightId: null,
            severity: null,
            durationMs: Date.now() - evaluatorStartedAt,
            generatedCount: 0,
            success: false,
            ...(error instanceof Error ? { errorCode: error.name } : {}),
          })
        }
      }

      return prioritizer.prioritize(insights)
    },
  }
}

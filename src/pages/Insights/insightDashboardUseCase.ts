import {
  createFinancialInsightEngine,
} from '../../intelligence/ai-conversation/provider-orchestration/financialInsightFactory'
import type {
  FinancialInsight,
  FinancialInsightEngine,
} from '../../intelligence/ai-conversation/provider-orchestration/financialInsightContracts'
import {
  createFinancialPlanningEngine,
} from '../../intelligence/ai-conversation/provider-orchestration/financialPlanningFactory'
import type {
  FinancialActionPlan,
  FinancialPlanningEngine,
} from '../../intelligence/ai-conversation/provider-orchestration/financialPlanningContracts'
import {
  runFinancialEngine,
  type FinancialEngineResult,
} from '../../services/financialEngineAdapter'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import { getSettings } from '../../services/settingsService'
import {
  createInsightDashboardMapper,
} from './insightDashboardMapper'
import type {
  InsightDashboardFinancialData,
  InsightDashboardFinancialDataReader,
  InsightDashboardPlanningRunner,
  InsightDashboardSnapshot,
  InsightDashboardUseCase,
  InsightDashboardUseCaseError,
  InsightDashboardUseCaseResult,
} from './insightDashboardContracts'
import {
  validateInsightDashboardSnapshot,
  validateInsightDashboardViewModel,
} from './insightDashboardValidator'

const DEFAULT_TIMEOUT_MS = 10000

function createExecutionPlan(input: {
  readonly periodStart?: string
  readonly periodEnd?: string
}) {
  return {
    skillId: 'insight-dashboard-runtime-skill',
    activationDecision: {
      protocolVersion: 1 as const,
      activationType: 'DIRECT_TOOL' as const,
      provider: 'dashboard-runtime',
      toolId: 'financial_insights',
      confidence: 1,
      requiresAI: false,
      requiresTool: true,
      requiresExplanation: false,
      fallback: { used: false },
      reason: 'dashboard-runtime-projection',
      intent: 'insights_dashboard',
    },
    requiredTools: ['financial_insights'],
    requiresAIExplanation: false,
    expectedOutput: 'INSIGHT_DASHBOARD_SNAPSHOT',
    executionPriority: 'NORMAL' as const,
    context: {
      ...(input.periodStart === undefined && input.periodEnd === undefined
        ? {}
        : {
            activePeriod: {
              ...(input.periodStart === undefined ? {} : { from: input.periodStart }),
              ...(input.periodEnd === undefined ? {} : { to: input.periodEnd }),
            },
          }),
    },
  }
}

function timeoutError(): InsightDashboardUseCaseError {
  return {
    code: 'INSIGHT_DASHBOARD_TIMEOUT',
    message: 'La carga del dashboard excedio el tiempo de espera local.',
  }
}

async function withTimeout<T>(input: {
  readonly promise: Promise<T>
  readonly timeoutMs: number
}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(timeoutError())
    }, input.timeoutMs)

    input.promise.then((value) => {
      clearTimeout(timeoutId)
      resolve(value)
    }).catch((error) => {
      clearTimeout(timeoutId)
      reject(error)
    })
  })
}

class DefaultFinancialDataReader implements InsightDashboardFinancialDataReader {
  async read(): Promise<InsightDashboardFinancialData> {
    const [settings, activePeriod, incomes, expenses] = await Promise.all([
      getSettings(),
      getActiveEarningPeriod(),
      listServiceIncomes({ newestFirst: false }),
      listExpenses({ newestFirst: false }),
    ])

    const effectivePeriodId = settings.usageMode === 'professional'
      ? activePeriod?.id
      : undefined

    const engineResult: FinancialEngineResult = runFinancialEngine({
      incomes,
      expenses,
      currency: settings.defaultCurrency,
      usageMode: settings.usageMode,
      ...(effectivePeriodId === undefined ? {} : { earningPeriodId: effectivePeriodId }),
    })

    return {
      usageMode: settings.usageMode,
      currency: settings.defaultCurrency,
      incomeTotal: engineResult.balanceReport.incomeGrossTotal,
      expenseTotal: engineResult.balanceReport.expenseTotal,
      adjustmentTotal: engineResult.balanceReport.adjustmentImpactTotal,
      netBalance: engineResult.balanceReport.generalBalance,
      incomeCount: engineResult.incomeCount,
      expenseCount: engineResult.expenseCount,
      adjustmentCount: engineResult.adjustmentCount,
      hasData: engineResult.balanceReport.hasData,
      ...(activePeriod?.id === undefined ? {} : { periodId: activePeriod.id }),
      ...(activePeriod?.startDate === undefined
        ? {}
        : { periodStart: activePeriod.startDate.slice(0, 10) }),
      ...(activePeriod?.endDate === undefined
        ? {}
        : { periodEnd: activePeriod.endDate.slice(0, 10) }),
    }
  }
}

class DefaultPlanningRunner implements InsightDashboardPlanningRunner {
  private readonly planningEngine: FinancialPlanningEngine

  constructor(planningEngine: FinancialPlanningEngine) {
    this.planningEngine = planningEngine
  }

  run(input: {
    readonly sessionId: string
    readonly requestedAt: string
    readonly insights: readonly FinancialInsight[]
    readonly periodStart?: string
    readonly periodEnd?: string
  }): FinancialActionPlan | null {
    return this.planningEngine.build({
      sessionId: input.sessionId,
      userMessage: 'Generar plan financiero para dashboard runtime',
      requestedAt: input.requestedAt,
      executionPlan: createExecutionPlan({
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      }),
      insights: input.insights,
    })
  }
}

export interface InsightDashboardUseCaseDependencies {
  readonly financialDataReader?: InsightDashboardFinancialDataReader
  readonly insightEngine?: FinancialInsightEngine
  readonly planningRunner?: InsightDashboardPlanningRunner
  readonly timeoutMs?: number
  readonly now?: () => string
}

function normalizeUseCaseError(error: unknown): InsightDashboardUseCaseError {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && 'message' in error
    && (error as { code: string }).code === 'INSIGHT_DASHBOARD_TIMEOUT'
  ) {
    return timeoutError()
  }

  return {
    code: 'INSIGHT_DASHBOARD_READ_FAILED',
    message: 'No fue posible leer los datos financieros del dashboard.',
  }
}

export function createInsightDashboardUseCase(
  input: InsightDashboardUseCaseDependencies = {},
): InsightDashboardUseCase {
  const financialDataReader = input.financialDataReader ?? new DefaultFinancialDataReader()
  const insightEngine = input.insightEngine ?? createFinancialInsightEngine()
  const planningRunner = input.planningRunner
    ?? new DefaultPlanningRunner(createFinancialPlanningEngine())
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const now = input.now ?? (() => new Date().toISOString())
  const mapper = createInsightDashboardMapper()

  return {
    async execute(): Promise<InsightDashboardUseCaseResult> {
      const requestedAt = now()
      const sessionId = `insight-dashboard:${requestedAt}`

      let financialData: InsightDashboardFinancialData
      try {
        financialData = await withTimeout({
          promise: financialDataReader.read(),
          timeoutMs,
        })
      } catch (error) {
        return {
          kind: 'error',
          error: normalizeUseCaseError(error),
        }
      }

      const executionPlan = createExecutionPlan({
        periodStart: financialData.periodStart,
        periodEnd: financialData.periodEnd,
      })

      let insights: readonly FinancialInsight[]
      try {
        insights = await withTimeout({
          promise: insightEngine.evaluate({
            sessionId,
            userMessage: 'Evaluar insights financieros para dashboard runtime',
            requestedAt,
            plan: executionPlan,
            snapshot: null,
          }),
          timeoutMs,
        })
      } catch {
        return {
          kind: 'error',
          error: {
            code: 'INSIGHT_DASHBOARD_INSIGHT_ENGINE_FAILED',
            message: 'No fue posible ejecutar el motor de insights financieros.',
          },
        }
      }

      let actionPlan: FinancialActionPlan | null = null
      const warnings: string[] = []
      let isPartial = false

      if (insights.length > 0) {
        try {
          actionPlan = planningRunner.run({
            sessionId,
            requestedAt,
            insights,
            periodStart: financialData.periodStart,
            periodEnd: financialData.periodEnd,
          })
        } catch {
          isPartial = true
          warnings.push('No fue posible generar el plan de accion; se muestran insights parciales.')
        }
      }

      const snapshot: InsightDashboardSnapshot = {
        generatedAt: requestedAt,
        financialSummary: {
          currency: financialData.currency,
          usageMode: financialData.usageMode,
          incomeTotal: financialData.incomeTotal,
          expenseTotal: financialData.expenseTotal,
          adjustmentTotal: financialData.adjustmentTotal,
          netBalance: financialData.netBalance,
          incomeCount: financialData.incomeCount,
          expenseCount: financialData.expenseCount,
          adjustmentCount: financialData.adjustmentCount,
          hasData: financialData.hasData,
        },
        insights,
        actionPlan,
        dataSources: {
          incomes: 'incomeService.listServiceIncomes -> db.services',
          expenses: 'expenseService.listExpenses -> db.expenses',
          settings: 'settingsService.getSettings -> db.settings',
          activePeriod: 'earningPeriodService.getActiveEarningPeriod -> db.earningPeriods',
          insightEngine: 'createFinancialInsightEngine',
          planningEngine: 'createFinancialPlanningEngine',
        },
        isPartial,
        warnings,
      }

      const snapshotValidation = validateInsightDashboardSnapshot(snapshot)
      if (snapshotValidation !== null) {
        return {
          kind: 'error',
          error: snapshotValidation,
        }
      }

      const viewModel = mapper.map({ snapshot })
      const viewModelValidation = validateInsightDashboardViewModel(viewModel)
      if (viewModelValidation !== null) {
        return {
          kind: 'error',
          error: viewModelValidation,
        }
      }

      if (!financialData.hasData || insights.length === 0) {
        return {
          kind: 'empty',
          snapshot,
          viewModel,
        }
      }

      if (snapshot.isPartial) {
        return {
          kind: 'partial',
          snapshot,
          viewModel,
        }
      }

      return {
        kind: 'success',
        snapshot,
        viewModel,
      }
    },
  }
}

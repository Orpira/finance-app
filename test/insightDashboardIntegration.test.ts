import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import {
  createInsightDashboardController,
  type InsightDashboardControllerDependencies,
} from '../src/pages/Insights/insightDashboardController'
import {
  createInsightDashboardUseCase,
} from '../src/pages/Insights/insightDashboardUseCase'
import type {
  InsightDashboardFinancialData,
  InsightDashboardUseCaseResult,
  InsightDashboardViewModel,
} from '../src/pages/Insights/insightDashboardContracts'

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return {
    promise,
    resolve,
    reject,
  }
}

function createViewModel(overrides: Partial<InsightDashboardViewModel> = {}): InsightDashboardViewModel {
  return {
    title: 'Análisis financiero',
    subtitle: 'Proyeccion read-only sobre motores financieros certificados.',
    generatedAt: '2026-07-24T00:00:00.000Z',
    generatedAtLabel: '24 jul 2026, 00:00',
    dataStatus: 'complete',
    warnings: [],
    summary: {
      currency: 'COP',
      usageMode: 'professional',
      incomeTotal: 1000,
      expenseTotal: 500,
      adjustmentTotal: 50,
      netBalance: 550,
      incomeCount: 2,
      expenseCount: 1,
      adjustmentCount: 1,
      hasData: true,
    },
    insights: [
      {
        id: 'insight:1',
        category: 'budget',
        priority: 'HIGH',
        severity: 'HIGH',
        title: 'Gasto alto en presupuesto',
        description: 'Tus egresos crecieron sobre el objetivo.',
        recommendation: 'Reduce gastos variables esta semana.',
        generatedAt: '2026-07-24T00:00:00.000Z',
      },
    ],
    actionPlan: {
      planId: 'plan:1',
      title: 'Plan financiero inteligente',
      summary: 'Plan de accion de prueba',
      objective: 'Recuperar margen operativo',
      priority: 'HIGH',
      estimatedImpact: 'MEDIUM',
      relatedInsights: ['insight:1'],
      warnings: [],
    },
    recommendedActions: [
      {
        id: 'action:1',
        type: 'expense_reduction',
        description: 'Reducir compras no esenciales',
        expectedBenefit: 'Mejorar flujo de caja',
        effort: 'LOW',
        priority: 'HIGH',
        requiresConfirmation: true,
      },
    ],
    ...overrides,
  }
}

function createController(
  execute: () => Promise<InsightDashboardUseCaseResult>,
) {
  const dependencies: InsightDashboardControllerDependencies = {
    useCase: {
      execute,
    },
  }

  return {
    controller: createInsightDashboardController(dependencies),
    dependencies,
  }
}

function createUseCaseResult(kind: 'success' | 'empty' | 'partial'): InsightDashboardUseCaseResult {
  const viewModel = createViewModel({
    dataStatus: kind === 'partial' ? 'partial' : 'complete',
    warnings: kind === 'partial'
      ? ['No fue posible generar el plan de accion.']
      : [],
    ...(kind === 'empty' ? { insights: [], recommendedActions: [], actionPlan: null } : {}),
  })

  return {
    kind,
    snapshot: {
      generatedAt: viewModel.generatedAt,
      financialSummary: viewModel.summary,
      insights: [],
      actionPlan: null,
      dataSources: {
        incomes: 'incomeService.listServiceIncomes -> db.services',
        expenses: 'expenseService.listExpenses -> db.expenses',
        settings: 'settingsService.getSettings -> db.settings',
        activePeriod: 'earningPeriodService.getActiveEarningPeriod -> db.earningPeriods',
        insightEngine: 'createFinancialInsightEngine',
        planningEngine: 'createFinancialPlanningEngine',
      },
      isPartial: kind === 'partial',
      warnings: [...viewModel.warnings],
    },
    viewModel,
  }
}

describe('Insight Dashboard runtime controller (PB-IS-015.6)', () => {
  it('estado inicial y transicion a loading', async () => {
    const pending = deferred<InsightDashboardUseCaseResult>()
    const { controller } = createController(async () => pending.promise)

    const statuses: string[] = []
    controller.subscribe((state) => {
      statuses.push(state.status)
    })

    const loadingPromise = controller.load()
    expect(controller.getState().status).toBe('loading')

    pending.resolve(createUseCaseResult('success'))
    await loadingPromise

    expect(statuses).toContain('loading')
    expect(controller.getState().status).toBe('success')
  })

  it('loading termina en success', async () => {
    const { controller } = createController(async () => createUseCaseResult('success'))

    await controller.load()

    const state = controller.getState()
    expect(state.status).toBe('success')
    if (state.status === 'success') {
      expect(state.data.insights.length).toBeGreaterThan(0)
      expect(state.data.recommendedActions.length).toBeGreaterThan(0)
    }
  })

  it('loading termina en empty', async () => {
    const { controller } = createController(async () => createUseCaseResult('empty'))

    await controller.load()

    const state = controller.getState()
    expect(state.status).toBe('empty')
  })

  it('loading termina en partial cuando hay warning no bloqueante', async () => {
    const { controller } = createController(async () => createUseCaseResult('partial'))

    await controller.load()

    const state = controller.getState()
    expect(state.status).toBe('partial')
    if (state.status === 'partial') {
      expect(state.data.warnings.length).toBeGreaterThan(0)
    }
  })

  it('loading termina en error cuando use case falla', async () => {
    const { controller } = createController(async () => ({
      kind: 'error',
      error: {
        code: 'INSIGHT_DASHBOARD_READ_FAILED',
        message: 'fallo controlado',
      },
    }))

    await controller.load()

    const state = controller.getState()
    expect(state.status).toBe('error')
    if (state.status === 'error') {
      expect(state.error.code).toBe('INSIGHT_DASHBOARD_READ_FAILED')
    }
  })

  it('retry manual: error inicial y luego success', async () => {
    const execute = vi
      .fn<() => Promise<InsightDashboardUseCaseResult>>()
      .mockResolvedValueOnce({
        kind: 'error',
        error: {
          code: 'INSIGHT_DASHBOARD_READ_FAILED',
          message: 'fallo',
        },
      })
      .mockResolvedValueOnce(createUseCaseResult('success'))

    const { controller } = createController(execute)

    await controller.load()
    expect(controller.getState().status).toBe('error')

    await controller.load({ force: true })
    expect(controller.getState().status).toBe('success')
  })

  it('no duplica ejecucion durante loading', async () => {
    const pending = deferred<InsightDashboardUseCaseResult>()
    const execute = vi.fn(async () => pending.promise)
    const { controller } = createController(execute)

    const firstLoad = controller.load()
    const secondLoad = controller.load()

    expect(execute).toHaveBeenCalledTimes(1)

    pending.resolve(createUseCaseResult('success'))
    await firstLoad
    await secondLoad
  })

  it('ignora resultados obsoletos y mantiene el mas reciente', async () => {
    const first = deferred<InsightDashboardUseCaseResult>()
    const second = deferred<InsightDashboardUseCaseResult>()

    const execute = vi
      .fn<() => Promise<InsightDashboardUseCaseResult>>()
      .mockImplementationOnce(async () => first.promise)
      .mockImplementationOnce(async () => second.promise)

    const { controller } = createController(execute)

    const firstLoad = controller.load()
    const secondLoad = controller.load({ force: true })

    second.resolve(createUseCaseResult('success'))
    await secondLoad

    first.resolve(createUseCaseResult('empty'))
    await firstLoad

    expect(controller.getState().status).toBe('success')
  })

  it('no actualiza estado despues de dispose', async () => {
    const pending = deferred<InsightDashboardUseCaseResult>()
    const { controller } = createController(async () => pending.promise)

    const transitions: string[] = []
    controller.subscribe((state) => {
      transitions.push(state.status)
    })

    const loadingPromise = controller.load()
    controller.dispose()

    pending.resolve(createUseCaseResult('success'))
    await loadingPromise

    expect(transitions).toEqual(['idle', 'loading'])
  })
})

describe('Insight Dashboard runtime use case (PB-IS-015.6)', () => {
  function financialData(input: Partial<InsightDashboardFinancialData> = {}): InsightDashboardFinancialData {
    return {
      usageMode: 'professional',
      currency: 'COP',
      incomeTotal: 1000,
      expenseTotal: 500,
      adjustmentTotal: 50,
      netBalance: 550,
      incomeCount: 2,
      expenseCount: 1,
      adjustmentCount: 1,
      hasData: true,
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      ...input,
    }
  }

  function insightFixture() {
    return {
      protocolVersion: 1 as const,
      insightId: 'insight:1',
      category: 'budget' as const,
      severity: 'HIGH' as const,
      priority: 'HIGH' as const,
      title: 'Gasto alto',
      description: 'Se detecto crecimiento de gasto',
      recommendation: 'Reducir gastos no esenciales',
      sourceTool: 'financial_insights',
      generatedAt: '2026-07-24T00:00:00.000Z',
    }
  }

  function actionPlanFixture() {
    return {
      planId: 'plan:1',
      createdAt: '2026-07-24T00:00:00.000Z',
      title: 'Plan financiero inteligente',
      summary: 'Resumen del plan',
      objective: 'Mejorar balance',
      priority: 'HIGH' as const,
      estimatedImpact: 'MEDIUM' as const,
      recommendedActions: [
        {
          actionId: 'action:1',
          type: 'expense_reduction',
          description: 'Reducir gasto variable',
          expectedBenefit: 'Aumentar margen',
          effort: 'LOW' as const,
          priority: 'HIGH' as const,
          affectedCategory: 'expense',
          relatedGoal: null,
          requiresConfirmation: true,
        },
      ],
      relatedInsights: ['insight:1'],
      assumptions: [],
      warnings: [],
    }
  }

  it('retorna empty cuando no hay datos o no hay insights', async () => {
    const useCase = createInsightDashboardUseCase({
      financialDataReader: {
        read: vi.fn(async () => financialData({ hasData: false })),
      },
      insightEngine: {
        evaluate: vi.fn(async () => []),
      },
      planningRunner: {
        run: vi.fn(() => null),
      },
      now: () => '2026-07-24T00:00:00.000Z',
    })

    const result = await useCase.execute()
    expect(result.kind).toBe('empty')
  })

  it('retorna partial cuando planning falla y conserva insights', async () => {
    const useCase = createInsightDashboardUseCase({
      financialDataReader: {
        read: vi.fn(async () => financialData()),
      },
      insightEngine: {
        evaluate: vi.fn(async () => [insightFixture()]),
      },
      planningRunner: {
        run: vi.fn(() => {
          throw new Error('planning failed')
        }),
      },
      now: () => '2026-07-24T00:00:00.000Z',
    })

    const result = await useCase.execute()
    expect(result.kind).toBe('partial')
    if (result.kind === 'partial') {
      expect(result.viewModel.insights.length).toBe(1)
      expect(result.viewModel.warnings.length).toBeGreaterThan(0)
    }
  })

  it('retorna success con action plan cuando todo sale bien', async () => {
    const useCase = createInsightDashboardUseCase({
      financialDataReader: {
        read: vi.fn(async () => financialData()),
      },
      insightEngine: {
        evaluate: vi.fn(async () => [insightFixture()]),
      },
      planningRunner: {
        run: vi.fn(() => actionPlanFixture()),
      },
      now: () => '2026-07-24T00:00:00.000Z',
    })

    const result = await useCase.execute()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.viewModel.actionPlan?.planId).toBe('plan:1')
      expect(result.viewModel.recommendedActions.length).toBe(1)
    }
  })

  it('retorna error de timeout cuando la lectura no resuelve', async () => {
    const pending = deferred<InsightDashboardFinancialData>()
    const useCase = createInsightDashboardUseCase({
      financialDataReader: {
        read: vi.fn(async () => pending.promise),
      },
      insightEngine: {
        evaluate: vi.fn(async () => [insightFixture()]),
      },
      planningRunner: {
        run: vi.fn(() => actionPlanFixture()),
      },
      timeoutMs: 1,
      now: () => '2026-07-24T00:00:00.000Z',
    })

    const result = await useCase.execute()
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.error.code).toBe('INSIGHT_DASHBOARD_TIMEOUT')
    }
  })
})

describe('Insight Dashboard runtime static constraints (PB-IS-015.6)', () => {
  it('la composicion del dashboard no depende de snapshots sellados ni openai', () => {
    const source = readFileSync(
      new URL('../src/pages/Insights/insightDashboardComposition.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('FinancialSnapshotRepository')).toBe(false)
    expect(source.includes('snapshot')).toBe(false)
    expect(source.includes('openai')).toBe(false)
    expect(source.includes('createInsightDashboardUseCase')).toBe(true)
  })

  it('el use case declara fuentes runtime compartidas de ingresos y egresos', () => {
    const source = readFileSync(
      new URL('../src/pages/Insights/insightDashboardUseCase.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('listServiceIncomes')).toBe(true)
    expect(source.includes('listExpenses')).toBe(true)
    expect(source.includes('createFinancialInsightEngine')).toBe(true)
    expect(source.includes('createFinancialPlanningEngine')).toBe(true)
  })

  it('el hook no crea el controller fuera del useEffect (regresion de loading infinito bajo StrictMode)', () => {
    const source = readFileSync(
      new URL('../src/pages/Insights/useInsightDashboard.ts', import.meta.url),
      'utf8',
    )

    const effectIndex = source.indexOf('useEffect(')
    const controllerCreationIndex = source.indexOf('createInsightDashboardController(')

    expect(effectIndex).toBeGreaterThan(-1)
    expect(controllerCreationIndex).toBeGreaterThan(effectIndex)
    expect(source.includes('useMemo')).toBe(false)
  })
})

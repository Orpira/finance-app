import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import type { InsightRuntimeSuccess } from '../src/insight/runtimeResponse'
import { createValidationReport } from '../src/insight/validationReport'
import {
  createInsightDashboardController,
  type InsightDashboardControllerDependencies,
} from '../src/pages/Insights/insightDashboardController'
import { createInsightReadModels } from '../src/services/insightReadModels'
import type { InsightExecutionRequest } from '../src/services/insightExecutionResult'
import type {
  InsightReadModelProjection,
  InsightReadModels,
} from '../src/services/readModelInterfaces'

function brand<T>(value: string | number): T {
  return value as T
}

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

function createRuntimeSuccessResponse(
  insightIds: readonly string[],
  executionId = 'runtime-exec:insights',
): InsightRuntimeSuccess {
  return {
    ok: true,
    status: 'success',
    executionId,
    deterministic: true,
    failClosed: true,
    repositoryUpdated: true,
    collection: {
      protocolVersion: 1,
      sourceKnowledgeCollectionId: brand('knowledge-collection:fixture'),
      sourceSnapshotId: brand('financial-snapshot:fixture'),
      sourceSnapshotKey: brand('snapshot-key:fixture'),
      sourceSnapshotRevision: 1,
      deterministicOutput: true,
      failClosed: true,
      insights: insightIds.map((id) => ({
        insightId: brand(`insight:${id}`),
        rule: {
          ruleId: brand(`insight-rule.${id}`),
          ruleVersion: brand('1.0.0'),
          protocolVersion: 1,
        },
        outputKind: 'observation',
        category: 'cash-flow',
        severity: 'warning',
        titleCode: brand(`insight.title.${id}`),
        messageCode: brand(`insight.message.${id}`),
        confidence: {
          mode: 'fixed-score',
          scoreUnit: 'percent-0-100',
          score: 80,
        },
        evidence: {
          evidenceType: 'knowledge-fact-set',
          summaryCode: brand(`insight.summary.${id}`),
          source: 'knowledge',
          traceabilityRequired: true,
          requiredFacts: [brand(`fact:${id}`)],
          matchedFacts: [],
          missingFacts: [brand(`fact:${id}`)],
        },
        traceability: {
          knowledgeCollectionId: brand('knowledge-collection:fixture'),
          sourceSnapshotId: brand('financial-snapshot:fixture'),
          sourceSnapshotKey: brand('snapshot-key:fixture'),
          sourceSnapshotRevision: 1,
          rule: {
            ruleId: brand(`insight-rule.${id}`),
            ruleVersion: brand('1.0.0'),
            protocolVersion: 1,
          },
          factIds: [brand(`fact:${id}`)],
        },
      })),
      executions: insightIds.map((id) => ({
        rule: {
          ruleId: brand(`insight-rule.${id}`),
          ruleVersion: brand('1.0.0'),
          protocolVersion: 1,
        },
        enabled: true,
        status: 'generated',
        compatibilityChecks: [],
        generatedInsightId: brand(`insight:${id}`),
      })),
    },
    assessment: {
      status: 'ok',
      failures: [],
      generatedInsights: insightIds.length,
      skippedRules: 0,
    },
    validationReport: createValidationReport([]),
  }
}

function createRequestFixture(
  executionId = 'execution:insights:1',
): InsightExecutionRequest {
  return {
    executionId,
    snapshotIntegrationId: `snapshot-integration:${executionId}`,
    knowledgeIntegrationId: `knowledge-integration:${executionId}`,
    snapshot: {
      identity: {
        snapshotId: brand('financial-snapshot:fixture'),
        snapshotKey: brand('snapshot-key:fixture'),
      },
      revision: { revision: 1 },
      snapshotVersion: 'financial-snapshot/1.0.0',
      canonicalizationVersion: 'financial-snapshot-c14n/1.0.0',
    } as unknown as InsightExecutionRequest['snapshot'],
    rules: [],
    versions: {
      knowledgeVersion: brand('knowledge/1.0.0'),
      builderVersion: brand('knowledge-builder/1.0.0'),
      rulesVersion: brand('knowledge-rules/1.0.0'),
      projectionVersion: brand('knowledge-projection/1.0.0'),
    },
    protocolVersion: 1,
  }
}

function createProjectionFixture(
  insightIds: readonly string[],
): InsightReadModelProjection {
  const readModels = createInsightReadModels()
  const result = readModels.project(createRuntimeSuccessResponse(insightIds))

  if (!result.ok) {
    throw new Error('expected valid read model projection fixture')
  }

  return result
}

function createController(
  input: {
    readonly requestFactory?: InsightDashboardControllerDependencies['requestFactory']
    readonly readModels?: InsightReadModels
    readonly executionService?: InsightDashboardControllerDependencies['executionService']
  } = {},
) {
  const defaultExecutionResult = {
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    stage: 'pipeline',
    executionId: 'execution:insights:1',
    completedStages: ['snapshot-integration', 'knowledge-integration'],
    traceability: {
      executionId: 'execution:insights:1',
      snapshotIntegrationId: 'snapshot-integration:execution:insights:1',
      knowledgeIntegrationId: 'knowledge-integration:execution:insights:1',
      completedStages: ['snapshot-integration', 'knowledge-integration'],
    },
    snapshotIntegration: {},
    knowledgeIntegration: {},
    runtimeResponse: createRuntimeSuccessResponse(['one']),
  }

  const dependencies: InsightDashboardControllerDependencies = {
    executionService:
      input.executionService ??
      {
        execute: vi.fn(() => defaultExecutionResult as never),
      },
    readModels: input.readModels ?? createInsightReadModels(),
    requestFactory:
      input.requestFactory ??
      {
        createRequest: vi.fn(async () => createRequestFixture()),
      },
  }

  return {
    controller: createInsightDashboardController(dependencies),
    dependencies,
  }
}

describe('Insight Dashboard Integration controller (Milestone 7F)', () => {
  it('estado inicial', () => {
    const { controller } = createController()

    expect(controller.getState()).toEqual({ status: 'idle' })
  })

  it('transicion idle -> loading', async () => {
    const pending = deferred<InsightExecutionRequest | null>()
    const { controller } = createController({
      requestFactory: {
        createRequest: vi.fn(async () => pending.promise),
      },
    })

    const statuses: string[] = []
    controller.subscribe((state) => {
      statuses.push(state.status)
    })

    const loadPromise = controller.load()
    expect(controller.getState().status).toBe('loading')

    pending.resolve(createRequestFixture())
    await loadPromise

    expect(statuses).toContain('loading')
  })

  it('ejecucion exitosa', async () => {
    const runtimeSuccess = createRuntimeSuccessResponse(['one'])
    const { controller } = createController({
      executionService: {
        execute: vi.fn(() => ({
          ok: true,
          status: 'success',
          deterministic: true,
          failClosed: true,
          stage: 'pipeline',
          executionId: 'execution:insights:success',
          completedStages: ['snapshot-integration', 'knowledge-integration'],
          traceability: {
            executionId: 'execution:insights:success',
            snapshotIntegrationId: 'snapshot-integration:success',
            knowledgeIntegrationId: 'knowledge-integration:success',
            completedStages: ['snapshot-integration', 'knowledge-integration'],
          },
          snapshotIntegration: {},
          knowledgeIntegration: {},
          runtimeResponse: runtimeSuccess,
        })),
      },
    })

    await controller.load()

    const state = controller.getState()
    expect(state.status).toBe('success')
    if (state.status === 'success') {
      expect(state.projection.insights).toHaveLength(1)
    }
  })

  it('exito proyectado exclusivamente mediante 7E', async () => {
    const projection = createProjectionFixture(['one'])
    const runtimeSuccess = createRuntimeSuccessResponse(['one'])
    const readModels: InsightReadModels = {
      project: vi.fn(() => projection),
    }

    const executionService = {
      execute: vi.fn(() => ({
        ok: true,
        status: 'success',
        deterministic: true,
        failClosed: true,
        stage: 'pipeline',
        executionId: 'execution:insights:projection',
        completedStages: ['snapshot-integration', 'knowledge-integration'],
        traceability: {
          executionId: 'execution:insights:projection',
          snapshotIntegrationId: 'snapshot-integration:projection',
          knowledgeIntegrationId: 'knowledge-integration:projection',
          completedStages: ['snapshot-integration', 'knowledge-integration'],
        },
        snapshotIntegration: {},
        knowledgeIntegration: {},
        runtimeResponse: runtimeSuccess,
      })),
    }

    const { controller } = createController({
      readModels,
      executionService,
    })

    await controller.load()

    expect(readModels.project).toHaveBeenCalledTimes(1)
    expect((readModels.project as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual(
      runtimeSuccess,
    )

    const state = controller.getState()
    expect(state.status).toBe('success')
    if (state.status === 'success') {
      expect(state.projection).toBe(projection)
    }
  })

  it('estado empty', async () => {
    const readModels: InsightReadModels = {
      project: vi.fn(() => createProjectionFixture([])),
    }

    const { controller } = createController({ readModels })

    await controller.load()

    const state = controller.getState()
    expect(state.status).toBe('empty')
    if (state.status === 'empty') {
      expect(state.projection.insights).toEqual([])
    }
  })

  it('rechazo de 7D convertido en rejected', async () => {
    const readModels: InsightReadModels = {
      project: vi.fn(() => createProjectionFixture(['one'])),
    }

    const { controller } = createController({
      readModels,
      executionService: {
        execute: vi.fn(() => ({
          ok: false,
          status: 'failure',
          deterministic: true,
          failClosed: true,
          stage: 'knowledge-integration',
          executionId: 'execution:rejected',
          code: 'INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED',
          message: 'rejected',
          traceability: {
            executionId: 'execution:rejected',
            snapshotIntegrationId: 'snapshot-integration:rejected',
            knowledgeIntegrationId: 'knowledge-integration:rejected',
            completedStages: ['snapshot-integration'],
          },
        })),
      },
    })

    await controller.load()

    const state = controller.getState()
    expect(state.status).toBe('rejected')
    if (state.status === 'rejected') {
      expect(state.code).toBe('INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED')
    }
    expect(readModels.project).toHaveBeenCalledTimes(0)
  })

  it('excepcion controlable convertida en error', async () => {
    const { controller } = createController({
      requestFactory: {
        createRequest: vi.fn(async () => {
          throw new Error('request failed')
        }),
      },
    })

    await controller.load()

    expect(controller.getState()).toEqual({
      status: 'error',
      code: 'INSIGHT_DASHBOARD_UNEXPECTED_ERROR',
      message:
        'No fue posible cargar el dashboard de insights por un error inesperado.',
    })
  })

  it('respuesta inconsistente convertida en error', async () => {
    const readModels: InsightReadModels = {
      project: vi.fn(() => ({
        ok: false,
        status: 'failure',
        deterministic: true,
        failClosed: true,
        code: 'READ_MODEL_INVALID_RUNTIME_RESPONSE',
        message: 'invalid read model',
      })),
    }

    const { controller } = createController({ readModels })

    await controller.load()

    expect(controller.getState()).toEqual({
      status: 'error',
      code: 'INSIGHT_DASHBOARD_INVALID_READ_MODEL',
      message: 'La proyeccion de lectura de insights fue inconsistente.',
    })
  })

  it('no ejecucion duplicada durante loading', async () => {
    const pending = deferred<InsightExecutionRequest | null>()
    const requestFactory = {
      createRequest: vi.fn(async () => pending.promise),
    }

    const { controller } = createController({ requestFactory })

    const firstLoad = controller.load()
    const secondLoad = controller.load()

    expect(requestFactory.createRequest).toHaveBeenCalledTimes(1)

    pending.resolve(createRequestFixture())
    await firstLoad
    await secondLoad
  })

  it('ausencia de actualizaciones despues de dispose', async () => {
    const pending = deferred<InsightExecutionRequest | null>()
    const requestFactory = {
      createRequest: vi.fn(async () => pending.promise),
    }

    const { controller } = createController({ requestFactory })
    const transitions: string[] = []

    controller.subscribe((state) => {
      transitions.push(state.status)
    })

    const loadingPromise = controller.load()
    controller.dispose()

    pending.resolve(createRequestFixture())
    await loadingPromise

    expect(transitions).toEqual(['idle', 'loading'])
  })

  it('resultado obsoleto no reemplaza uno mas reciente', async () => {
    const first = deferred<InsightExecutionRequest | null>()
    const second = deferred<InsightExecutionRequest | null>()

    const requestFactory = {
      createRequest: vi
        .fn<() => Promise<InsightExecutionRequest | null>>()
        .mockImplementationOnce(async () => first.promise)
        .mockImplementationOnce(async () => second.promise),
    }

    const executionService = {
      execute: vi.fn((request: InsightExecutionRequest) => {
        const runtimeResponse =
          request.executionId === 'execution:new'
            ? createRuntimeSuccessResponse(['new'], 'runtime:new')
            : createRuntimeSuccessResponse(['old'], 'runtime:old')

        return {
          ok: true,
          status: 'success',
          deterministic: true,
          failClosed: true,
          stage: 'pipeline',
          executionId: request.executionId,
          completedStages: ['snapshot-integration', 'knowledge-integration'],
          traceability: {
            executionId: request.executionId,
            snapshotIntegrationId: 'snapshot-integration',
            knowledgeIntegrationId: 'knowledge-integration',
            completedStages: ['snapshot-integration', 'knowledge-integration'],
          },
          snapshotIntegration: {},
          knowledgeIntegration: {},
          runtimeResponse,
        }
      }),
    }

    const { controller } = createController({
      requestFactory,
      executionService,
    })

    const firstLoad = controller.load()
    const secondLoad = controller.load({ force: true })

    second.resolve(createRequestFixture('execution:new'))
    await secondLoad

    first.resolve(createRequestFixture('execution:old'))
    await firstLoad

    const state = controller.getState()
    expect(state.status).toBe('success')
    if (state.status === 'success') {
      expect(state.projection.updateMetadata.executionId).toBe('runtime:new')
      expect(state.projection.insights[0]?.insightId).toBe('insight:new')
    }

    expect(executionService.execute).toHaveBeenCalledTimes(1)
  })

  it('determinismo de transformaciones', async () => {
    const projection = createProjectionFixture(['one'])
    const readModels: InsightReadModels = {
      project: vi.fn(() => projection),
    }

    const { controller } = createController({ readModels })

    await controller.load()
    const firstState = controller.getState()

    await controller.load({ force: true })
    const secondState = controller.getState()

    expect(firstState).toEqual(secondState)
  })

  it('input y read models no mutados', async () => {
    const request = createRequestFixture('execution:immutability')
    const requestBefore = JSON.stringify(request)
    const projection = createProjectionFixture(['one'])
    const projectionBefore = JSON.stringify(projection)

    const { controller } = createController({
      requestFactory: {
        createRequest: vi.fn(async () => request),
      },
      readModels: {
        project: vi.fn(() => projection),
      },
    })

    await controller.load()

    expect(JSON.stringify(request)).toBe(requestBefore)
    expect(JSON.stringify(projection)).toBe(projectionBefore)
  })
})

describe('Insight Dashboard Integration static constraints (Milestone 7F)', () => {
  it('componentes reciben solo read models y no invocan execution service', () => {
    const dashboardSource = readFileSync(
      new URL('../src/pages/Insights/InsightDashboard.tsx', import.meta.url),
      'utf8',
    )
    const summarySource = readFileSync(
      new URL('../src/pages/Insights/InsightSummary.tsx', import.meta.url),
      'utf8',
    )
    const listSource = readFileSync(
      new URL('../src/pages/Insights/InsightList.tsx', import.meta.url),
      'utf8',
    )

    expect(summarySource.includes('InsightReadModelProjection')).toBe(true)
    expect(listSource.includes('InsightReadModelProjection')).toBe(true)
    expect(dashboardSource.includes('execute(')).toBe(false)
    expect(summarySource.includes('execute(')).toBe(false)
    expect(listSource.includes('execute(')).toBe(false)
  })

  it('componentes no importan runtime ni repository internos', () => {
    const files = [
      '../src/pages/Insights/InsightDashboard.tsx',
      '../src/pages/Insights/InsightSummary.tsx',
      '../src/pages/Insights/InsightList.tsx',
      '../src/pages/Insights/InsightStateViews.tsx',
      '../src/pages/Insights/InsightDashboardPage.tsx',
    ]

    for (const file of files) {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8')

      expect(source.includes('createInsightRuntime')).toBe(false)
      expect(source.includes('InsightRuntime')).toBe(false)
      expect(source.includes('createInsightRepository')).toBe(false)
      expect(source.includes('InsightRepository')).toBe(false)
      expect(source.includes('buildInsightCollection')).toBe(false)
      expect(source.includes('validateInsightCollection')).toBe(false)
      expect(source.includes('createInsightEngine')).toBe(false)
      expect(source.includes('Dexie')).toBe(false)
      expect(source.includes('indexedDB')).toBe(false)
      expect(source.includes('IndexedDB')).toBe(false)
    }
  })

  it('loading, empty, rejected y error son accesibles', () => {
    const source = readFileSync(
      new URL('../src/pages/Insights/InsightStateViews.tsx', import.meta.url),
      'utf8',
    )

    expect(source.includes('role="status"')).toBe(true)
    expect(source.includes('role="alert"')).toBe(true)
    expect(source.includes('aria-live="polite"')).toBe(true)
    expect(source.includes('aria-live="assertive"')).toBe(true)
  })

  it('lista semantica y severidad no solo por color', () => {
    const source = readFileSync(
      new URL('../src/pages/Insights/InsightList.tsx', import.meta.url),
      'utf8',
    )

    expect(source.includes('<ul')).toBe(true)
    expect(source.includes('<li')).toBe(true)
    expect(source.includes('Severidad:')).toBe(true)
    expect(source.includes('Estado:')).toBe(true)
  })

  it('sin logica de dominio en componentes y sin IA/persistencia', () => {
    const summarySource = readFileSync(
      new URL('../src/pages/Insights/InsightSummary.tsx', import.meta.url),
      'utf8',
    )
    const listSource = readFileSync(
      new URL('../src/pages/Insights/InsightList.tsx', import.meta.url),
      'utf8',
    )

    expect(summarySource.includes('.reduce(')).toBe(false)
    expect(listSource.includes('.reduce(')).toBe(false)
    expect(summarySource.includes('generalBalance')).toBe(false)
    expect(listSource.includes('generalBalance')).toBe(false)
    expect(summarySource.includes('LLM')).toBe(false)
    expect(listSource.includes('LLM')).toBe(false)
    expect(summarySource.includes('persist')).toBe(false)
    expect(listSource.includes('persist')).toBe(false)
  })
})

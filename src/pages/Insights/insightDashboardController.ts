import type {
  InsightExecutionService,
} from '../../services/insightExecutionInterfaces'
import type {
  InsightExecutionRequest,
} from '../../services/insightExecutionResult'
import type {
  InsightReadModels,
} from '../../services/readModelInterfaces'
import type {
  InsightDashboardErrorCode,
  InsightDashboardRejectedCode,
  InsightDashboardState,
} from './insightDashboardState'

const REJECTED_MESSAGE_BY_CODE: Readonly<
  Record<InsightDashboardRejectedCode, string>
> = {
  INSIGHT_DASHBOARD_SNAPSHOT_UNAVAILABLE:
    'Aun no hay un snapshot sellado disponible para generar insights.',
  INSIGHT_EXECUTION_INVALID_REQUEST:
    'La solicitud de insights no es valida para el pipeline actual.',
  INSIGHT_EXECUTION_MISSING_SNAPSHOT:
    'No se encontro un snapshot compatible para ejecutar insights.',
  INSIGHT_EXECUTION_MISSING_RULE_CATALOG:
    'No hay un catalogo de reglas disponible para ejecutar insights.',
  INSIGHT_EXECUTION_MISSING_DEPENDENCY:
    'La integracion de insights no esta disponible en este momento.',
  INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_REJECTED:
    'El snapshot fue rechazado por la frontera de integracion.',
  INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED:
    'La integracion de conocimiento rechazo la ejecucion de insights.',
  INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_EXCEPTION:
    'Ocurrio un error controlado durante la integracion del snapshot.',
  INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_EXCEPTION:
    'Ocurrio un error controlado durante la integracion de conocimiento.',
  INSIGHT_EXECUTION_INCONSISTENT_SNAPSHOT_RESULT:
    'El resultado de snapshot no fue consistente para continuar.',
  INSIGHT_EXECUTION_INCONSISTENT_KNOWLEDGE_RESULT:
    'El resultado de conocimiento no fue consistente para continuar.',
  INSIGHT_EXECUTION_TRACEABILITY_MISMATCH:
    'La trazabilidad del pipeline de insights no fue consistente.',
  INSIGHT_EXECUTION_PIPELINE_FAILURE:
    'El pipeline de insights fallo por una condicion no recuperable.',
}

const ERROR_MESSAGE_BY_CODE: Readonly<Record<InsightDashboardErrorCode, string>> = {
  INSIGHT_DASHBOARD_UNEXPECTED_ERROR:
    'No fue posible cargar el dashboard de insights por un error inesperado.',
  INSIGHT_DASHBOARD_INVALID_READ_MODEL:
    'La proyeccion de lectura de insights fue inconsistente.',
}

export interface InsightDashboardRequestFactory {
  createRequest(): Promise<InsightExecutionRequest | null>
}

export interface InsightDashboardControllerDependencies {
  readonly executionService: InsightExecutionService
  readonly readModels: InsightReadModels
  readonly requestFactory: InsightDashboardRequestFactory
}

export interface InsightDashboardController {
  getState(): InsightDashboardState
  subscribe(listener: (state: InsightDashboardState) => void): () => void
  load(options?: { readonly force?: boolean }): Promise<void>
  dispose(): void
}

function mapRejectedMessage(code: InsightDashboardRejectedCode): string {
  return REJECTED_MESSAGE_BY_CODE[code]
}

function mapErrorMessage(code: InsightDashboardErrorCode): string {
  return ERROR_MESSAGE_BY_CODE[code]
}

export function createInsightDashboardController(
  dependencies: InsightDashboardControllerDependencies,
): InsightDashboardController {
  let state: InsightDashboardState = { status: 'idle' }
  let disposed = false
  let requestSequence = 0

  const listeners = new Set<(state: InsightDashboardState) => void>()

  function emit(nextState: InsightDashboardState): void {
    if (disposed) {
      return
    }

    state = nextState
    for (const listener of listeners) {
      listener(state)
    }
  }

  function reject(input: {
    readonly code: InsightDashboardRejectedCode
    readonly executionId: string | null
  }): void {
    emit({
      status: 'rejected',
      code: input.code,
      executionId: input.executionId,
      message: mapRejectedMessage(input.code),
    })
  }

  function fail(code: InsightDashboardErrorCode): void {
    emit({
      status: 'error',
      code,
      message: mapErrorMessage(code),
    })
  }

  return {
    getState() {
      return state
    },

    subscribe(listener) {
      listeners.add(listener)
      listener(state)

      return () => {
        listeners.delete(listener)
      }
    },

    async load(options = {}) {
      const isLoading = state.status === 'loading'
      if (isLoading && options.force !== true) {
        return
      }

      requestSequence += 1
      const currentSequence = requestSequence
      emit({ status: 'loading' })

      try {
        const request = await dependencies.requestFactory.createRequest()
        if (disposed || currentSequence !== requestSequence) {
          return
        }

        if (request === null) {
          reject({
            code: 'INSIGHT_DASHBOARD_SNAPSHOT_UNAVAILABLE',
            executionId: null,
          })
          return
        }

        const executionResult = dependencies.executionService.execute(request)
        if (disposed || currentSequence !== requestSequence) {
          return
        }

        if (!executionResult.ok) {
          reject({
            code: executionResult.code,
            executionId: executionResult.executionId,
          })
          return
        }

        const projectionResult = dependencies.readModels.project(
          executionResult.runtimeResponse,
        )
        if (disposed || currentSequence !== requestSequence) {
          return
        }

        if (!projectionResult.ok) {
          fail('INSIGHT_DASHBOARD_INVALID_READ_MODEL')
          return
        }

        if (projectionResult.insights.length === 0) {
          emit({
            status: 'empty',
            projection: projectionResult,
          })
          return
        }

        emit({
          status: 'success',
          projection: projectionResult,
        })
      } catch {
        if (disposed || currentSequence !== requestSequence) {
          return
        }

        fail('INSIGHT_DASHBOARD_UNEXPECTED_ERROR')
      }
    },

    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}

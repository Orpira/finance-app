import type {
  InsightDashboardUseCase,
  InsightDashboardUseCaseResult,
} from './insightDashboardContracts'
import type { InsightDashboardState } from './insightDashboardState'

export interface InsightDashboardControllerDependencies {
  readonly useCase: InsightDashboardUseCase
}

export interface InsightDashboardController {
  getState(): InsightDashboardState
  subscribe(listener: (state: InsightDashboardState) => void): () => void
  load(options?: { readonly force?: boolean }): Promise<void>
  dispose(): void
}

function applyResult(result: InsightDashboardUseCaseResult): InsightDashboardState {
  if (result.kind === 'error') {
    return {
      status: 'error',
      error: result.error,
    }
  }

  if (result.kind === 'empty') {
    return {
      status: 'empty',
      data: result.viewModel,
    }
  }

  if (result.kind === 'partial') {
    return {
      status: 'partial',
      data: result.viewModel,
    }
  }

  return {
    status: 'success',
    data: result.viewModel,
  }
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
        const result = await dependencies.useCase.execute()
        if (disposed || currentSequence !== requestSequence) {
          return
        }

        emit(applyResult(result))
      } catch {
        if (disposed || currentSequence !== requestSequence) {
          return
        }

        emit({
          status: 'error',
          error: {
            code: 'INSIGHT_DASHBOARD_READ_FAILED',
            message: 'No fue posible cargar el análisis. Inténtalo de nuevo.',
          },
        })
      }
    },

    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}

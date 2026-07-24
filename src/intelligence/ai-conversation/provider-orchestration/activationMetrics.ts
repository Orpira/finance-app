import type {
  ActivationMetricsRecorder,
} from './activationContracts'

export function createNoopActivationMetricsRecorder(): ActivationMetricsRecorder {
  return {
    record() {
      return
    },
  }
}

export function createInMemoryActivationMetricsRecorder(): {
  readonly recorder: ActivationMetricsRecorder
  readonly entries: Array<{
    readonly activationType: 'DIRECT_TOOL' | 'DIRECT_AI' | 'TOOL_WITH_AI' | 'FALLBACK' | 'INVALID_REQUEST'
    readonly provider: string
    readonly toolId: string | null
    readonly confidence: number
    readonly decisionDurationMs: number
    readonly fallbackUsed: boolean
    readonly success: boolean
    readonly errorCode?: string
  }>
} {
  const entries: Array<{
    readonly activationType: 'DIRECT_TOOL' | 'DIRECT_AI' | 'TOOL_WITH_AI' | 'FALLBACK' | 'INVALID_REQUEST'
    readonly provider: string
    readonly toolId: string | null
    readonly confidence: number
    readonly decisionDurationMs: number
    readonly fallbackUsed: boolean
    readonly success: boolean
    readonly errorCode?: string
  }> = []

  return {
    entries,
    recorder: {
      record(entry) {
        entries.push({ ...entry })
      },
    },
  }
}

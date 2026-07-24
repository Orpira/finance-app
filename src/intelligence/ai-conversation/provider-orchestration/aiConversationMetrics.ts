export interface AIConversationMetricEntry {
  readonly provider: string
  readonly durationMs: number
  readonly operation: string
  readonly fallbackUsed: boolean
  readonly success: boolean
  readonly errorCode?: string
}

export interface AIConversationMetricsRecorder {
  record(entry: AIConversationMetricEntry): void
}

export function createNoopAIConversationMetricsRecorder(): AIConversationMetricsRecorder {
  return {
    record() {
      return
    },
  }
}

export function createInMemoryAIConversationMetricsRecorder(): {
  readonly recorder: AIConversationMetricsRecorder
  readonly entries: AIConversationMetricEntry[]
} {
  const entries: AIConversationMetricEntry[] = []

  return {
    entries,
    recorder: {
      record(entry) {
        entries.push({ ...entry })
      },
    },
  }
}

export interface CopilotRuntimeMetricEntry {
  readonly timestamp: string
  readonly intent: string
  readonly candidateToolIds: readonly string[]
  readonly chosenToolId: string
  readonly originalArguments: Readonly<Record<string, unknown>>
  readonly repairedArguments: Readonly<Record<string, unknown>> | null
  readonly retries: number
  readonly durationMs: number
  readonly confidence: number
  readonly success: boolean
  readonly generatedByOpenAI: boolean
}

export interface CopilotTelemetrySnapshot {
  readonly totalExecutions: number
  readonly successRate: number
  readonly autoRepairRate: number
  readonly mostUsedTools: readonly { readonly toolId: string; readonly count: number }[]
  readonly averageDurationMs: number
  readonly deterministicResponseRate: number
  readonly aiGeneratedResponseRate: number
}

const MAX_ENTRIES = 200
const entries: CopilotRuntimeMetricEntry[] = []

export function recordCopilotRuntimeMetric(entry: CopilotRuntimeMetricEntry): void {
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.shift()
  }
}

export function getCopilotRuntimeMetricsSnapshot(): readonly CopilotRuntimeMetricEntry[] {
  return entries.slice()
}

export function clearCopilotRuntimeMetrics(): void {
  entries.length = 0
}

/**
 * Aggregates the raw metric entries into the telemetry percentages required
 * by the certification: success rate, auto-repair rate, most-used tools,
 * average duration and the split between deterministic and AI-generated
 * responses.
 */
export function getCopilotTelemetrySnapshot(): CopilotTelemetrySnapshot {
  const total = entries.length

  if (total === 0) {
    return {
      totalExecutions: 0,
      successRate: 0,
      autoRepairRate: 0,
      mostUsedTools: [],
      averageDurationMs: 0,
      deterministicResponseRate: 0,
      aiGeneratedResponseRate: 0,
    }
  }

  const successCount = entries.filter((entry) => entry.success).length
  const repairedCount = entries.filter((entry) => entry.repairedArguments !== null).length
  const aiGeneratedCount = entries.filter((entry) => entry.generatedByOpenAI).length
  const totalDurationMs = entries.reduce((sum, entry) => sum + entry.durationMs, 0)

  const toolCounts = new Map<string, number>()
  for (const entry of entries) {
    toolCounts.set(entry.chosenToolId, (toolCounts.get(entry.chosenToolId) ?? 0) + 1)
  }

  const mostUsedTools = [...toolCounts.entries()]
    .map(([toolId, count]) => ({ toolId, count }))
    .sort((left, right) => right.count - left.count)

  return {
    totalExecutions: total,
    successRate: successCount / total,
    autoRepairRate: repairedCount / total,
    mostUsedTools,
    averageDurationMs: totalDurationMs / total,
    deterministicResponseRate: (total - aiGeneratedCount) / total,
    aiGeneratedResponseRate: aiGeneratedCount / total,
  }
}

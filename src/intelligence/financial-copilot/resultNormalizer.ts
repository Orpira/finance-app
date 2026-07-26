import type { AIToolExecutionResult, AIToolJsonValue } from '../ai-tools'

export interface ToolResult {
  readonly toolId: string
  readonly kind: 'success' | 'failure'
  readonly confidence: number
  readonly source: string
  readonly timestamp: string
  readonly payload: AIToolJsonValue | null
  readonly errorCode?: string
  readonly errorMessage?: string
}

export interface NormalizeToolResultInput {
  readonly toolId: string
  readonly execution: AIToolExecutionResult
  readonly now?: () => string
}

/**
 * Wraps a raw `AIToolExecutionResult` into a common `ToolResult` envelope so
 * the Copilot Orchestrator (and multi-tool aggregation) never has to branch
 * on tool-specific output shapes to know whether/how a step succeeded.
 */
export function normalizeToolResult(input: NormalizeToolResultInput): ToolResult {
  const timestamp = (input.now ?? (() => new Date().toISOString()))()

  if (input.execution.kind === 'failure') {
    return {
      toolId: input.toolId,
      kind: 'failure',
      confidence: 0,
      source: input.toolId,
      timestamp,
      payload: null,
      errorCode: input.execution.code,
      errorMessage: input.execution.safeMessage,
    }
  }

  return {
    toolId: input.toolId,
    kind: 'success',
    confidence: 1,
    source: input.execution.value.toolName,
    timestamp,
    payload: input.execution.value.output,
  }
}

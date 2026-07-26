import type { AIToolJsonValue } from '../ai-tools'
import type { IntentResolutionToolSelection } from '../intent-resolver/intentResolverContracts'

export interface ExecutionPlanStep {
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly arguments: Readonly<Record<string, AIToolJsonValue>>
}

export interface ExecutionPlan {
  readonly executionId: string
  readonly steps: readonly ExecutionPlanStep[]
  readonly isMultiTool: boolean
}

/**
 * Turns the tool selections already present on an `IntentResolutionResult`
 * into an ordered execution plan. Preserves the order the Intent Resolver
 * produced them in (it already reasons about dependency order, e.g. reports
 * before insights before planning for a compound question) rather than
 * re-deciding sequencing here.
 */
export function createExecutionPlan(input: {
  readonly executionId: string
  readonly toolSelections: readonly IntentResolutionToolSelection[]
}): ExecutionPlan {
  const steps = input.toolSelections.map((selection, index) => ({
    stepId: `${input.executionId}:step:${index + 1}`,
    order: index + 1,
    toolId: selection.toolId,
    arguments: selection.arguments,
  }))

  return {
    executionId: input.executionId,
    steps,
    isMultiTool: steps.length > 1,
  }
}

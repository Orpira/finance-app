import type {
  FinancialMappedToolResult,
  FinancialToolResultMapper,
  FinancialToolResultMapperInput,
} from './financialConversationContext'

function mapStep(
  step: FinancialToolResultMapperInput['steps'][number],
): FinancialMappedToolResult {
  if (step.kind === 'success') {
    return {
      stepId: step.stepId,
      order: step.order,
      toolId: step.toolId,
      kind: 'success',
      durationMs: step.durationMs,
      permission: step.permission,
      output: structuredClone(step.output),
      error: null,
    }
  }

  return {
    stepId: step.stepId,
    order: step.order,
    toolId: step.toolId,
    kind: 'failure',
    durationMs: null,
    permission: null,
    output: null,
    error: {
      code: step.error.code,
      safeMessage: step.error.safeMessage,
    },
  }
}

export function createDefaultFinancialToolResultMapper(): FinancialToolResultMapper {
  return {
    mapperId: 'financial-tool-result-mapper',
    map(input) {
      return input.steps
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((step) => mapStep(step))
    },
  }
}

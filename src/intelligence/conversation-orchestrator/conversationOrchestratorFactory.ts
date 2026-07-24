import {
  createToolFailure,
  type AIToolFailure,
} from '../ai-tools'
import {
  AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
  type AIConversationExecutionResult,
  type AIConversationOrchestratorRequest,
  type AIConversationOrchestratorResult,
  type AIConversationOrchestratorStepResult,
  type CreateAIConversationOrchestratorRequestInput,
} from './conversationOrchestratorContracts'
import {
  validateConversationExecutionResult,
  validateConversationOrchestratorRequest,
} from './conversationOrchestratorValidator'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function normalizeSteps(
  inputSteps: CreateAIConversationOrchestratorRequestInput['steps'],
): AIConversationOrchestratorRequest['steps'] {
  return inputSteps.map((step) => ({
    stepId: step.stepId,
    order: step.order,
    toolId: step.toolId,
    arguments: structuredClone(step.arguments),
    ...(step.timeoutMs === undefined ? {} : { timeoutMs: step.timeoutMs }),
  }))
}

export function createConversationOrchestratorRequest(
  input: CreateAIConversationOrchestratorRequestInput,
): { readonly kind: 'success'; readonly request: AIConversationOrchestratorRequest } | AIToolFailure {
  const request: AIConversationOrchestratorRequest = {
    protocolVersion: input.protocolVersion ?? AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
    executionId: input.executionId.trim() as AIConversationOrchestratorRequest['executionId'],
    context: structuredClone(input.context),
    steps: normalizeSteps(input.steps),
  }

  const validation = validateConversationOrchestratorRequest(request)
  if (validation) {
    return validation
  }

  return {
    kind: 'success',
    request: deepFreeze(request),
  }
}

export function createConversationExecutionResult(input: {
  readonly executionId: AIConversationOrchestratorRequest['executionId']
  readonly startedAt: string
  readonly finishedAt: string
  readonly steps: readonly AIConversationOrchestratorStepResult[]
}): AIConversationOrchestratorResult {
  const successfulSteps = input.steps.filter((step) => step.kind === 'success').length
  const failedSteps = input.steps.filter((step) => step.kind === 'failure').length

  const result: AIConversationExecutionResult = {
    executionId: input.executionId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    status: failedSteps === 0 ? 'success' : 'partial-failure',
    summary: {
      totalSteps: input.steps.length,
      successfulSteps,
      failedSteps,
    },
    steps: input.steps.map((step) => structuredClone(step)),
  }

  const validation = validateConversationExecutionResult(result)
  if (validation) {
    return createToolFailure(
      'INVALID_RESULT',
      validation.safeMessage,
      validation.retryable,
    )
  }

  return {
    kind: 'success',
    result: deepFreeze(result),
  }
}

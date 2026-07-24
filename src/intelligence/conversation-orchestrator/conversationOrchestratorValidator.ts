import {
  createToolFailure,
  type AIToolFailure,
  type AIToolJsonValue,
  validateToolContext,
} from '../ai-tools'
import {
  AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
  type AIConversationExecutionResult,
  type AIConversationOrchestratorExecutionId,
  type AIConversationOrchestratorRequest,
} from './conversationOrchestratorContracts'

const EXECUTION_ID_PATTERN = /^conversation-orchestration:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isJsonValue(value: unknown, seen: ReadonlySet<object>): value is AIToolJsonValue {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (value instanceof Date || seen.has(value)) {
    return false
  }

  const nextSeen = new Set(seen)
  nextSeen.add(value)

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item, nextSeen))
  }

  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return false
  }

  return Object.values(value).every((item) => isJsonValue(item, nextSeen))
}

function isValidExecutionId(value: string): value is AIConversationOrchestratorExecutionId {
  return EXECUTION_ID_PATTERN.test(value)
}

export function validateConversationOrchestratorRequest(
  request: AIConversationOrchestratorRequest,
): AIToolFailure | null {
  if (request.protocolVersion !== AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION) {
    return createToolFailure('INVALID_ARGUMENTS', 'The conversation orchestrator protocol version is invalid.')
  }

  if (!isValidExecutionId(request.executionId)) {
    return createToolFailure('INVALID_ARGUMENTS', 'The conversation orchestration execution id is invalid.')
  }

  const contextValidation = validateToolContext(request.context)
  if (contextValidation) {
    return contextValidation
  }

  if (!Array.isArray(request.steps) || request.steps.length === 0) {
    return createToolFailure('INVALID_ARGUMENTS', 'The conversation orchestrator request must include at least one step.')
  }

  const stepIds = new Set<string>()
  const orders = new Set<number>()
  for (const step of request.steps) {
    if (!isNonEmpty(step.stepId)) {
      return createToolFailure('INVALID_ARGUMENTS', 'Each conversation orchestration step must include a valid stepId.')
    }

    if (stepIds.has(step.stepId)) {
      return createToolFailure('INVALID_ARGUMENTS', `The step id '${step.stepId}' is duplicated.`)
    }
    stepIds.add(step.stepId)

    if (!Number.isSafeInteger(step.order) || step.order <= 0) {
      return createToolFailure('INVALID_ARGUMENTS', `The step '${step.stepId}' has an invalid execution order.`)
    }

    if (orders.has(step.order)) {
      return createToolFailure('INVALID_ARGUMENTS', `The execution order '${step.order}' is duplicated.`)
    }
    orders.add(step.order)

    if (!isNonEmpty(step.toolId)) {
      return createToolFailure('INVALID_ARGUMENTS', `The step '${step.stepId}' must include a valid toolId.`)
    }

    if (!isRecord(step.arguments) || !isJsonValue(step.arguments, new Set())) {
      return createToolFailure('INVALID_ARGUMENTS', `The step '${step.stepId}' contains non JSON-safe arguments.`)
    }

    if (
      step.timeoutMs !== undefined
      && (!Number.isSafeInteger(step.timeoutMs) || step.timeoutMs <= 0)
    ) {
      return createToolFailure('INVALID_ARGUMENTS', `The step '${step.stepId}' has an invalid timeout.`)
    }
  }

  const sortedOrders = [...orders].sort((left, right) => left - right)
  for (let index = 0; index < sortedOrders.length; index += 1) {
    if (sortedOrders[index] !== index + 1) {
      return createToolFailure('INVALID_ARGUMENTS', 'Conversation orchestration step order must be contiguous starting at 1.')
    }
  }

  return null
}

export function validateConversationExecutionResult(
  result: AIConversationExecutionResult,
): AIToolFailure | null {
  if (!isValidExecutionId(result.executionId)) {
    return createToolFailure('INVALID_RESULT', 'The conversation orchestration result execution id is invalid.')
  }

  if (typeof result.startedAt !== 'string' || typeof result.finishedAt !== 'string') {
    return createToolFailure('INVALID_RESULT', 'The conversation orchestration result timestamps are invalid.')
  }

  if (result.status !== 'success' && result.status !== 'partial-failure') {
    return createToolFailure('INVALID_RESULT', 'The conversation orchestration result status is invalid.')
  }

  if (!Array.isArray(result.steps) || result.steps.length !== result.summary.totalSteps) {
    return createToolFailure('INVALID_RESULT', 'The conversation orchestration result has an inconsistent number of steps.')
  }

  const successfulSteps = result.steps.filter((step) => step.kind === 'success').length
  const failedSteps = result.steps.filter((step) => step.kind === 'failure').length

  if (successfulSteps !== result.summary.successfulSteps || failedSteps !== result.summary.failedSteps) {
    return createToolFailure('INVALID_RESULT', 'The conversation orchestration result summary is inconsistent.')
  }

  const expectedStatus = failedSteps === 0 ? 'success' : 'partial-failure'
  if (result.status !== expectedStatus) {
    return createToolFailure('INVALID_RESULT', 'The conversation orchestration final status is inconsistent with step outcomes.')
  }

  for (let index = 0; index < result.steps.length; index += 1) {
    if (result.steps[index]?.order !== index + 1) {
      return createToolFailure('INVALID_RESULT', 'The conversation orchestration result order is inconsistent.')
    }
  }

  return null
}

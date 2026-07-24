import { AI_TOOL_FAILURE_CODES, type AIToolJsonValue } from '../ai-tools'
import {
  validateConversationExecutionResult,
  type AIConversationExecutionResult,
} from '../conversation-orchestrator'
import {
  AI_PROMPT_CONTEXT_PROTOCOL_VERSION,
  PROMPT_CONTEXT_FAILURE_CODES,
  type PromptContext,
  type PromptContextFailureCode,
  type PromptContextResult,
} from './promptContextContracts'

const TOOL_FAILURE_CODE_SET = new Set<string>(AI_TOOL_FAILURE_CODES)
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const CONTEXT_ID_PATTERN = /^prompt-context:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/

function createError(
  code: PromptContextFailureCode,
  safeMessage: string,
  details?: Readonly<Record<string, AIToolJsonValue>>,
) {
  return {
    kind: 'failure' as const,
    code,
    retryable: false as const,
    safeMessage,
    ...(details === undefined ? {} : { details }),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidJsonValue(value: unknown, seen: ReadonlySet<object>): value is AIToolJsonValue {
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
    return value.every((item) => isValidJsonValue(item, nextSeen))
  }

  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return false
  }

  return Object.values(value).every((item) => isValidJsonValue(item, nextSeen))
}

function isValidCode(value: unknown): boolean {
  return typeof value === 'string' && TOOL_FAILURE_CODE_SET.has(value)
}

function validateStepOrder(orders: readonly number[]): boolean {
  const sorted = [...orders].sort((left, right) => left - right)
  for (let index = 0; index < sorted.length; index += 1) {
    if (sorted[index] !== index + 1) {
      return false
    }
  }
  return true
}

export function validatePromptContextInput(input: {
  readonly executionResult: AIConversationExecutionResult
}) {
  const executionValidation = validateConversationExecutionResult(input.executionResult)
  if (executionValidation) {
    return createError(
      'INVALID_PROMPT_CONTEXT_EXECUTION',
      executionValidation.safeMessage,
      { sourceErrorCode: executionValidation.code },
    )
  }

  return null
}

export function validatePromptContext(context: PromptContext): ReturnType<typeof createError> | null {
  if (context.protocolVersion !== AI_PROMPT_CONTEXT_PROTOCOL_VERSION) {
    return createError('INVALID_PROMPT_CONTEXT', 'The prompt context protocol version is invalid.')
  }

  if (!CONTEXT_ID_PATTERN.test(context.contextId)) {
    return createError('INVALID_PROMPT_CONTEXT_ID', 'The prompt context identifier is invalid.')
  }

  if (!isRecord(context.execution)) {
    return createError('INVALID_PROMPT_CONTEXT_EXECUTION', 'The prompt context execution block is invalid.')
  }

  if (!isNonEmpty(context.execution.executionId)) {
    return createError('INVALID_PROMPT_CONTEXT_EXECUTION', 'The prompt context execution identifier is invalid.')
  }

  if (!isNonEmpty(context.execution.startedAt) || !UTC_INSTANT_PATTERN.test(context.execution.startedAt)) {
    return createError('INVALID_PROMPT_CONTEXT_EXECUTION', 'The prompt context execution start time is invalid.')
  }

  if (!isNonEmpty(context.execution.finishedAt) || !UTC_INSTANT_PATTERN.test(context.execution.finishedAt)) {
    return createError('INVALID_PROMPT_CONTEXT_EXECUTION', 'The prompt context execution finish time is invalid.')
  }

  if (context.execution.startedAt > context.execution.finishedAt) {
    return createError('INVALID_PROMPT_CONTEXT_EXECUTION', 'The prompt context execution timestamps are inconsistent.')
  }

  if (context.execution.status !== 'success' && context.execution.status !== 'partial-failure') {
    return createError('INVALID_PROMPT_CONTEXT_EXECUTION', 'The prompt context execution status is invalid.')
  }

  if (context.metadata.protocolVersion !== AI_PROMPT_CONTEXT_PROTOCOL_VERSION) {
    return createError('INVALID_PROMPT_CONTEXT_METADATA', 'The prompt context metadata protocol version is invalid.')
  }

  if (!isNonEmpty(context.metadata.createdAt) || !UTC_INSTANT_PATTERN.test(context.metadata.createdAt)) {
    return createError('INVALID_PROMPT_CONTEXT_METADATA', 'The prompt context metadata creation time is invalid.')
  }

  if (context.metadata.createdAt !== context.execution.finishedAt) {
    return createError('INVALID_PROMPT_CONTEXT_METADATA', 'The prompt context metadata createdAt must match the execution finish time.')
  }

  if (context.metadata.source !== 'APPLICATION' && context.metadata.source !== 'CONVERSATION' && context.metadata.source !== 'SYSTEM') {
    return createError('INVALID_PROMPT_CONTEXT_METADATA', 'The prompt context metadata source is invalid.')
  }

  if (context.metadata.deterministic !== true || context.metadata.failClosed !== true) {
    return createError('INVALID_PROMPT_CONTEXT_METADATA', 'The prompt context metadata must be deterministic and fail-closed.')
  }

  if (context.metadata.tags !== undefined && !context.metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError('INVALID_PROMPT_CONTEXT_METADATA', 'The prompt context metadata tags are invalid.')
  }

  if (context.metadata.attributes !== undefined && !isValidJsonValue(context.metadata.attributes, new Set())) {
    return createError('INVALID_PROMPT_CONTEXT_METADATA', 'The prompt context metadata attributes are invalid.')
  }

  if (!Array.isArray(context.steps) || context.steps.length === 0) {
    return createError('INVALID_PROMPT_CONTEXT_STEPS', 'The prompt context must include at least one step.')
  }

  const seenStepIds = new Set<string>()
  const orders: number[] = []
  let failureCount = 0
  let successCount = 0

  for (const step of context.steps) {
    if (!isRecord(step)) {
      return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context contains an invalid step.')
    }

    const stepRecord = step as Record<string, unknown>

    if (!isNonEmpty(stepRecord.stepId)) {
      return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step identifier is invalid.')
    }

    if (seenStepIds.has(stepRecord.stepId)) {
      return createError('INVALID_PROMPT_CONTEXT_STEPS', 'The prompt context contains duplicated step identifiers.')
    }

    seenStepIds.add(stepRecord.stepId)

    if (typeof stepRecord.order !== 'number' || !Number.isSafeInteger(stepRecord.order) || stepRecord.order <= 0) {
      return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step order is invalid.')
    }

    orders.push(stepRecord.order)

    if (!isNonEmpty(stepRecord.toolId)) {
      return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step tool id is invalid.')
    }

    if (stepRecord.kind === 'success') {
      successCount += 1
      if (!isNonEmpty(stepRecord.resolvedToolName)) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step tool name is invalid.')
      }

      if (!isNonEmpty(stepRecord.permission)) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step permission is invalid.')
      }

      if (typeof stepRecord.durationMs !== 'number' || !Number.isFinite(stepRecord.durationMs) || stepRecord.durationMs < 0) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step duration is invalid.')
      }

      if (!isValidJsonValue(stepRecord.output, new Set())) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step output is invalid.')
      }
    } else {
      failureCount += 1
      if (!isRecord(stepRecord.error)) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step error is invalid.')
      }

      if (!isValidCode(stepRecord.error.code)) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step error code is invalid.')
      }

      if (!isNonEmpty(stepRecord.error.safeMessage)) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step error message is invalid.')
      }

      if (stepRecord.error.details !== undefined && !isValidJsonValue(stepRecord.error.details, new Set())) {
        return createError('INVALID_PROMPT_CONTEXT_STEP', 'The prompt context step error details are invalid.')
      }
    }
  }

  if (!validateStepOrder(orders)) {
    return createError('INVALID_PROMPT_CONTEXT_STEPS', 'The prompt context step order is inconsistent.')
  }

  const expectedStatus = failureCount === 0 ? 'success' : 'partial-failure'
  if (context.execution.status !== expectedStatus) {
    return createError('INVALID_PROMPT_CONTEXT_EXECUTION', 'The prompt context execution status is inconsistent with the steps.')
  }

  if (successCount + failureCount !== context.steps.length) {
    return createError('INVALID_PROMPT_CONTEXT_STEPS', 'The prompt context step counts are inconsistent.')
  }

  return null
}

export function validatePromptContextResult(result: PromptContextResult) {
  if (result.kind === 'failure') {
    if (!PROMPT_CONTEXT_FAILURE_CODES.includes(result.code)) {
      return createError('INVALID_PROMPT_CONTEXT', 'The prompt context failure code is invalid.')
    }

    return null
  }

  return validatePromptContext(result.context)
}

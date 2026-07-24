import { AI_TOOL_FAILURE_CODES, type AIToolJsonValue } from '../ai-tools'
import { validatePromptContext, type PromptContext } from '../prompt-context-builder'
import {
  AI_RESPONSE_COMPOSER_PROTOCOL_VERSION,
  CONVERSATION_RESPONSE_FAILURE_CODES,
  type ConversationResponse,
  type ConversationResponseBlock,
  type ConversationResponseFailureCode,
  type ConversationResponseResult,
} from './responseComposerContracts'

const TOOL_FAILURE_CODE_SET = new Set<string>(AI_TOOL_FAILURE_CODES)
const RESPONSE_ID_PATTERN = /^conversation-response:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function createError(
  code: ConversationResponseFailureCode,
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

function validateBlocks(blocks: readonly ConversationResponseBlock[], context: PromptContext) {
  if (!Array.isArray(blocks) || blocks.length !== context.steps.length + 1) {
    return createError('INVALID_CONVERSATION_RESPONSE_BLOCKS', 'The conversation response blocks are inconsistent.')
  }

  const summary = blocks[0]
  if (!summary || summary.kind !== 'summary') {
    return createError('INVALID_CONVERSATION_RESPONSE_BLOCKS', 'The conversation response summary block is missing.')
  }

  if (summary.promptContextId !== context.contextId) {
    return createError('INVALID_CONVERSATION_RESPONSE_BLOCKS', 'The conversation response summary block context is invalid.')
  }

  if (summary.executionId !== context.execution.executionId) {
    return createError('INVALID_CONVERSATION_RESPONSE_BLOCKS', 'The conversation response summary block execution is invalid.')
  }

  if (summary.stepCount !== context.steps.length) {
    return createError('INVALID_CONVERSATION_RESPONSE_BLOCKS', 'The conversation response summary block step count is invalid.')
  }

  if (summary.successCount + summary.failureCount !== context.steps.length) {
    return createError('INVALID_CONVERSATION_RESPONSE_BLOCKS', 'The conversation response summary block counts are invalid.')
  }

  for (let index = 0; index < context.steps.length; index += 1) {
    const block = blocks[index + 1]
    const step = context.steps[index]

    if (!block) {
      return createError('INVALID_CONVERSATION_RESPONSE_BLOCKS', 'The conversation response is missing a step block.')
    }

    if (block.kind === 'step-success') {
      if (step.kind !== 'success') {
        return createError('INVALID_CONVERSATION_RESPONSE_BLOCK', 'A step success block does not match the prompt context.')
      }

      if (
        block.stepId !== step.stepId ||
        block.order !== step.order ||
        block.toolId !== step.toolId ||
        block.resolvedToolName !== step.resolvedToolName ||
        block.permission !== step.permission ||
        block.durationMs !== step.durationMs ||
        !isValidJsonValue(block.output, new Set())
      ) {
        return createError('INVALID_CONVERSATION_RESPONSE_BLOCK', 'A step success block is inconsistent with the prompt context.')
      }
    } else if (block.kind === 'step-failure') {
      if (step.kind !== 'failure') {
        return createError('INVALID_CONVERSATION_RESPONSE_BLOCK', 'A step failure block does not match the prompt context.')
      }

      if (
        block.stepId !== step.stepId ||
        block.order !== step.order ||
        block.toolId !== step.toolId ||
        !isRecord(block.error) ||
        !isValidCode(block.error.code) ||
        !isNonEmpty(block.error.safeMessage) ||
        (block.error.details !== undefined && !isValidJsonValue(block.error.details, new Set()))
      ) {
        return createError('INVALID_CONVERSATION_RESPONSE_BLOCK', 'A step failure block is inconsistent with the prompt context.')
      }
    } else {
      return createError('INVALID_CONVERSATION_RESPONSE_BLOCK', 'The conversation response contains an invalid step block.')
    }
  }

  return null
}

export function validateConversationResponse(context: ConversationResponse): ReturnType<typeof createError> | null {
  if (context.protocolVersion !== AI_RESPONSE_COMPOSER_PROTOCOL_VERSION) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response protocol version is invalid.')
  }

  if (!RESPONSE_ID_PATTERN.test(context.responseId)) {
    return createError('INVALID_CONVERSATION_RESPONSE_ID', 'The conversation response identifier is invalid.')
  }

  const promptContextValidation = validatePromptContext(context.promptContext)
  if (promptContextValidation) {
    return createError('INVALID_CONVERSATION_RESPONSE_PROMPT_CONTEXT', promptContextValidation.safeMessage)
  }

  if (!isRecord(context.execution)) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution block is invalid.')
  }

  if (context.execution.promptContextId !== context.promptContext.contextId) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution prompt context id is invalid.')
  }

  if (context.execution.executionId !== context.promptContext.execution.executionId) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution id is invalid.')
  }

  if (!isNonEmpty(context.execution.startedAt) || !UTC_INSTANT_PATTERN.test(context.execution.startedAt)) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution start time is invalid.')
  }

  if (!isNonEmpty(context.execution.finishedAt) || !UTC_INSTANT_PATTERN.test(context.execution.finishedAt)) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution finish time is invalid.')
  }

  if (context.execution.startedAt !== context.promptContext.execution.startedAt || context.execution.finishedAt !== context.promptContext.execution.finishedAt) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution timestamps are inconsistent.')
  }

  if (context.execution.status !== context.promptContext.execution.status) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution status is inconsistent.')
  }

  if (context.execution.blockCount !== context.blocks.length) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution block count is invalid.')
  }

  if (context.execution.stepCount !== context.promptContext.steps.length) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution step count is invalid.')
  }

  if (context.execution.successCount + context.execution.failureCount !== context.execution.stepCount) {
    return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response execution counts are invalid.')
  }

  if (context.metadata.protocolVersion !== AI_RESPONSE_COMPOSER_PROTOCOL_VERSION) {
    return createError('INVALID_CONVERSATION_RESPONSE_METADATA', 'The conversation response metadata protocol version is invalid.')
  }

  if (!isNonEmpty(context.metadata.createdAt) || !UTC_INSTANT_PATTERN.test(context.metadata.createdAt)) {
    return createError('INVALID_CONVERSATION_RESPONSE_METADATA', 'The conversation response metadata createdAt is invalid.')
  }

  if (context.metadata.createdAt !== context.promptContext.execution.finishedAt) {
    return createError('INVALID_CONVERSATION_RESPONSE_METADATA', 'The conversation response metadata createdAt must match prompt context finish time.')
  }

  if (context.metadata.source !== 'APPLICATION' && context.metadata.source !== 'CONVERSATION' && context.metadata.source !== 'SYSTEM') {
    return createError('INVALID_CONVERSATION_RESPONSE_METADATA', 'The conversation response metadata source is invalid.')
  }

  if (context.metadata.deterministic !== true || context.metadata.failClosed !== true) {
    return createError('INVALID_CONVERSATION_RESPONSE_METADATA', 'The conversation response metadata must be deterministic and fail-closed.')
  }

  if (context.metadata.tags !== undefined && !context.metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError('INVALID_CONVERSATION_RESPONSE_METADATA', 'The conversation response metadata tags are invalid.')
  }

  if (context.metadata.attributes !== undefined && !isValidJsonValue(context.metadata.attributes, new Set())) {
    return createError('INVALID_CONVERSATION_RESPONSE_METADATA', 'The conversation response metadata attributes are invalid.')
  }

  return validateBlocks(context.blocks, context.promptContext)
}

export function validateConversationResponseResult(result: ConversationResponseResult) {
  if (result.kind === 'failure') {
    if (!CONVERSATION_RESPONSE_FAILURE_CODES.includes(result.code)) {
      return createError('INVALID_CONVERSATION_RESPONSE', 'The conversation response failure code is invalid.')
    }

    return null
  }

  return validateConversationResponse(result.response)
}

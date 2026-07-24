import { validatePromptContext, type PromptContext } from '../prompt-context-builder'
import {
  AI_RESPONSE_COMPOSER_PROTOCOL_VERSION,
  type ConversationResponse,
  type ConversationResponseFailure,
  type ConversationResponseId,
  type ConversationResponseResult,
  type ConversationResponseBlock,
  type ConversationResponseStepFailureBlock,
  type ConversationResponseStepSuccessBlock,
  type CreateConversationResponseInput,
} from './responseComposerContracts'
import {
  validateConversationResponse,
} from './responseComposerValidator'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function createFailure(
  code: ConversationResponseFailure['code'],
  safeMessage: string,
  details?: ConversationResponseFailure['details'],
): ConversationResponseResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
    ...(details === undefined ? {} : { details }),
  }
}

function normalizeResponseId(promptContext: PromptContext): ConversationResponseId {
  return `conversation-response:${promptContext.execution.executionId}` as ConversationResponseId
}

function summaryBlockId(responseId: ConversationResponseId): string {
  return `${responseId}:summary`
}

function stepBlockId(responseId: ConversationResponseId, stepId: string): string {
  return `${responseId}:step:${stepId}`
}

function mapStepBlock(
  responseId: ConversationResponseId,
  step: PromptContext['steps'][number],
): ConversationResponseBlock {
  if (step.kind === 'success') {
    const block: ConversationResponseStepSuccessBlock = {
      kind: 'step-success',
      blockId: stepBlockId(responseId, step.stepId),
      stepId: step.stepId,
      order: step.order,
      toolId: step.toolId,
      resolvedToolName: step.resolvedToolName,
      permission: step.permission,
      durationMs: step.durationMs,
      output: structuredClone(step.output),
    }

    return block
  }

  const block: ConversationResponseStepFailureBlock = {
    kind: 'step-failure',
    blockId: stepBlockId(responseId, step.stepId),
    stepId: step.stepId,
    order: step.order,
    toolId: step.toolId,
    error: {
      ...step.error,
      ...(step.error.details === undefined
        ? {}
        : { details: structuredClone(step.error.details) }),
    },
  }

  return block
}

function createBlocks(responseId: ConversationResponseId, promptContext: PromptContext): readonly ConversationResponseBlock[] {
  const successCount = promptContext.steps.filter((step) => step.kind === 'success').length
  const failureCount = promptContext.steps.length - successCount

  return [
    {
      kind: 'summary',
      blockId: summaryBlockId(responseId),
      promptContextId: promptContext.contextId,
      executionId: promptContext.execution.executionId,
      status: promptContext.execution.status,
      stepCount: promptContext.steps.length,
      successCount,
      failureCount,
    },
    ...promptContext.steps.map((step) => mapStepBlock(responseId, step)),
  ]
}

export interface ConversationResponseComposer {
  build(input: CreateConversationResponseInput): ConversationResponseResult
}

export function createConversationResponseComposer(): ConversationResponseComposer {
  return {
    build(input) {
      const promptContextValidation = validatePromptContext(input.promptContext)
      if (promptContextValidation) {
        return createFailure(
          'INVALID_CONVERSATION_RESPONSE_PROMPT_CONTEXT',
          promptContextValidation.safeMessage,
        )
      }

      const promptContext = input.promptContext
      const responseId = normalizeResponseId(promptContext)

      const response: ConversationResponse = {
        protocolVersion: AI_RESPONSE_COMPOSER_PROTOCOL_VERSION,
        responseId,
        promptContext: structuredClone(promptContext),
        execution: {
          promptContextId: promptContext.contextId,
          executionId: promptContext.execution.executionId,
          startedAt: promptContext.execution.startedAt,
          finishedAt: promptContext.execution.finishedAt,
          status: promptContext.execution.status,
          blockCount: promptContext.steps.length + 1,
          stepCount: promptContext.steps.length,
          successCount: promptContext.steps.filter((step) => step.kind === 'success').length,
          failureCount: promptContext.steps.filter((step) => step.kind === 'failure').length,
        },
        metadata: {
          protocolVersion: AI_RESPONSE_COMPOSER_PROTOCOL_VERSION,
          createdAt: input.createdAt ?? promptContext.execution.finishedAt,
          source: input.source ?? 'APPLICATION',
          deterministic: true,
          failClosed: true,
          ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
          ...(input.attributes === undefined
            ? {}
            : { attributes: structuredClone(input.attributes) }),
        },
        blocks: createBlocks(responseId, promptContext),
      }

      const validation = validateConversationResponse(response)
      if (validation) {
        return createFailure(
          'INVALID_CONVERSATION_RESPONSE',
          validation.safeMessage,
          validation.details,
        )
      }

      return {
        kind: 'success',
        response: deepFreeze(response),
      }
    },
  }
}

export function buildConversationResponse(input: CreateConversationResponseInput): ConversationResponseResult {
  return createConversationResponseComposer().build(input)
}

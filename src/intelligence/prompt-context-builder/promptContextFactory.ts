import type {
  AIConversationExecutionResult,
  AIConversationOrchestratorExecutionFailure,
  AIConversationOrchestratorExecutionSuccess,
} from '../conversation-orchestrator'
import {
  AI_PROMPT_CONTEXT_PROTOCOL_VERSION,
  type PromptContext,
  type PromptContextFailure,
  type PromptContextId,
  type PromptContextResult,
  type PromptContextStep,
  type PromptContextStepFailure,
  type CreatePromptContextInput,
} from './promptContextContracts'
import {
  validatePromptContext,
  validatePromptContextInput,
} from './promptContextValidator'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function cloneError(error: PromptContextStepFailure['error']) {
  return {
    ...error,
    ...(error.details === undefined ? {} : { details: structuredClone(error.details) }),
  }
}

function mapExecutionSuccess(
  step: AIConversationOrchestratorExecutionSuccess,
): PromptContextStep {
  return {
    kind: 'success',
    stepId: step.stepId,
    order: step.order,
    toolId: step.toolId,
    resolvedToolName: step.resolvedToolName,
    permission: step.execution.permission,
    durationMs: step.execution.durationMs,
    output: structuredClone(step.execution.output),
  }
}

function mapExecutionFailure(
  step: AIConversationOrchestratorExecutionFailure,
): PromptContextStep {
  return {
    kind: 'failure',
    stepId: step.stepId,
    order: step.order,
    toolId: step.toolId,
    error: cloneError(step.error),
  }
}

function mapStep(step: AIConversationOrchestratorExecutionSuccess | AIConversationOrchestratorExecutionFailure): PromptContextStep {
  if (step.kind === 'success') {
    return mapExecutionSuccess(step)
  }

  return mapExecutionFailure(step)
}

function createFailure(
  code: PromptContextFailure['code'],
  safeMessage: string,
  details?: PromptContextFailure['details'],
): PromptContextResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
    ...(details === undefined ? {} : { details }),
  }
}

function normalizeContextId(executionId: AIConversationExecutionResult['executionId']): PromptContextId {
  return `prompt-context:${executionId}` as PromptContextId
}

function normalizeExecutionSteps(
  steps: AIConversationExecutionResult['steps'],
): readonly PromptContextStep[] {
  return [...steps]
    .sort((left, right) => left.order - right.order)
    .map((step) => mapStep(step))
}

export interface PromptContextBuilder {
  build(input: CreatePromptContextInput): PromptContextResult
}

export function createPromptContextBuilder(): PromptContextBuilder {
  return {
    build(input) {
      const inputValidation = validatePromptContextInput(input)
      if (inputValidation) {
        return inputValidation
      }

      const context: PromptContext = {
        protocolVersion: AI_PROMPT_CONTEXT_PROTOCOL_VERSION,
        contextId: normalizeContextId(input.executionResult.executionId),
        execution: {
          executionId: input.executionResult.executionId,
          startedAt: input.executionResult.startedAt,
          finishedAt: input.executionResult.finishedAt,
          status: input.executionResult.status,
        },
        metadata: {
          protocolVersion: AI_PROMPT_CONTEXT_PROTOCOL_VERSION,
          createdAt: input.createdAt ?? input.executionResult.finishedAt,
          source: input.source ?? 'APPLICATION',
          deterministic: true,
          failClosed: true,
          ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
          ...(input.attributes === undefined
            ? {}
            : { attributes: structuredClone(input.attributes) }),
        },
        steps: normalizeExecutionSteps(input.executionResult.steps),
      }

      const validation = validatePromptContext(context)
      if (validation) {
        return createFailure(
          'INVALID_PROMPT_CONTEXT',
          validation.safeMessage,
          validation.details,
        )
      }

      return {
        kind: 'success',
        context: deepFreeze(context),
      }
    },
  }
}

export function buildPromptContext(input: CreatePromptContextInput): PromptContextResult {
  return createPromptContextBuilder().build(input)
}

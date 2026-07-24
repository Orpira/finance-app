import type {
  AIConversationExecutionResult,
  AIConversationOrchestratorRequest,
} from '../conversation-orchestrator'
import {
  validateConversationExecutionResult,
  validateConversationOrchestratorRequest,
} from '../conversation-orchestrator'
import type { PromptContext } from '../prompt-context-builder'
import { validatePromptContext } from '../prompt-context-builder'
import type { ConversationResponse } from '../response-composer'
import { validateConversationResponse } from '../response-composer'
import {
  AI_CONVERSATION_FACADE_FAILURE_CODES,
  type AIConversationFacadeFailure,
  type AIConversationFacadeFailureCode,
  type AIConversationFacadeResult,
} from './aiConversationFacadeContracts'

function createFailure(
  code: AIConversationFacadeFailureCode,
  safeMessage: string,
  details?: AIConversationFacadeFailure['details'],
): AIConversationFacadeFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
    ...(details === undefined ? {} : { details }),
  }
}

function mapValidationFailure(
  code: AIConversationFacadeFailureCode,
  safeMessage: string,
  sourceErrorCode: string,
) {
  return createFailure(code, safeMessage, { sourceErrorCode })
}

export function validateAIConversationRequest(
  request: AIConversationOrchestratorRequest,
): AIConversationFacadeFailure | null {
  const validation = validateConversationOrchestratorRequest(request)
  if (validation) {
    return mapValidationFailure(
      'INVALID_CONVERSATION_REQUEST',
      validation.safeMessage,
      validation.code,
    )
  }

  return null
}

export function validateAIConversationExecutionResult(
  executionResult: AIConversationExecutionResult,
): AIConversationFacadeFailure | null {
  const validation = validateConversationExecutionResult(executionResult)
  if (validation) {
    return mapValidationFailure(
      'INVALID_CONVERSATION_EXECUTION_RESULT',
      validation.safeMessage,
      validation.code,
    )
  }

  return null
}

export function validateAIConversationPromptContext(
  promptContext: PromptContext,
): AIConversationFacadeFailure | null {
  const validation = validatePromptContext(promptContext)
  if (validation) {
    return mapValidationFailure(
      'INVALID_PROMPT_CONTEXT',
      validation.safeMessage,
      validation.code,
    )
  }

  return null
}

export function validateAIConversationResponse(
  response: ConversationResponse,
): AIConversationFacadeFailure | null {
  const validation = validateConversationResponse(response)
  if (validation) {
    return mapValidationFailure(
      'INVALID_CONVERSATION_RESPONSE',
      validation.safeMessage,
      validation.code,
    )
  }

  return null
}

export function validateAIConversationFacadeResult(
  result: AIConversationFacadeResult,
): AIConversationFacadeFailure | null {
  if (result.kind === 'failure') {
    if (!AI_CONVERSATION_FACADE_FAILURE_CODES.includes(result.code)) {
      return createFailure('INVALID_CONVERSATION_RESPONSE', 'The AI conversation facade result failure code is invalid.')
    }

    return null
  }

  return validateAIConversationResponse(result.response)
}

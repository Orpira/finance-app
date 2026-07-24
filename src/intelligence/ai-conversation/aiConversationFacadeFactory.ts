import type {
  AIConversationFacade,
  AIConversationFacadeFailure,
  AIConversationFacadeResult,
  CreateAIConversationFacadeInput,
} from './aiConversationFacadeContracts'
import {
  validateAIConversationExecutionResult,
  validateAIConversationPromptContext,
  validateAIConversationRequest,
  validateAIConversationResponse,
} from './aiConversationFacadeValidator'

function createFailure(
  code: AIConversationFacadeFailure['code'],
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

function ensureDependency(name: string, value: unknown): void {
  if (value === null || value === undefined || typeof value !== 'object') {
    throw new Error(`The AI conversation facade requires a valid ${name}.`)
  }
}

export function createAIConversationFacade(
  input: CreateAIConversationFacadeInput,
): AIConversationFacade {
  ensureDependency('orchestrator', input.orchestrator)
  ensureDependency('prompt context builder', input.promptContextBuilder)
  ensureDependency('response composer', input.responseComposer)

  if (typeof input.orchestrator.execute !== 'function') {
    throw new Error('The AI conversation facade requires an orchestrator with an execute method.')
  }

  if (typeof input.promptContextBuilder.build !== 'function') {
    throw new Error('The AI conversation facade requires a prompt context builder with a build method.')
  }

  if (typeof input.responseComposer.build !== 'function') {
    throw new Error('The AI conversation facade requires a response composer with a build method.')
  }

  return {
    async execute(request): Promise<AIConversationFacadeResult> {
      const requestValidation = validateAIConversationRequest(request)
      if (requestValidation) {
        return requestValidation
      }

      const executionResult = await input.orchestrator.execute(request)
      if (executionResult.kind === 'failure') {
        return createFailure(
          'CONVERSATION_ORCHESTRATION_FAILED',
          executionResult.safeMessage,
          { sourceErrorCode: executionResult.code },
        )
      }

      const executionValidation = validateAIConversationExecutionResult(executionResult.result)
      if (executionValidation) {
        return executionValidation
      }

      const promptContextResult = input.promptContextBuilder.build({
        executionResult: executionResult.result,
      })
      if (promptContextResult.kind === 'failure') {
        return createFailure(
          'PROMPT_CONTEXT_BUILD_FAILED',
          promptContextResult.safeMessage,
          { sourceErrorCode: promptContextResult.code },
        )
      }

      const promptContextValidation = validateAIConversationPromptContext(promptContextResult.context)
      if (promptContextValidation) {
        return promptContextValidation
      }

      const responseResult = input.responseComposer.build({
        promptContext: promptContextResult.context,
      })
      if (responseResult.kind === 'failure') {
        return createFailure(
          'CONVERSATION_RESPONSE_BUILD_FAILED',
          responseResult.safeMessage,
          { sourceErrorCode: responseResult.code },
        )
      }

      const responseValidation = validateAIConversationResponse(responseResult.response)
      if (responseValidation) {
        return responseValidation
      }

      return {
        kind: 'success',
        response: responseResult.response,
      }
    },
  }
}

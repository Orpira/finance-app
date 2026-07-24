import {
  INTENT_RESOLVER_PROTOCOL_VERSION,
} from '../../intent-resolver/intentResolver'
import {
  validateAIProviderConversationGenerationResult,
  validateAIProviderIntentResolutionResult,
} from '../../ai-provider/aiProviderValidator'
import {
  validateAIConversationRequest,
} from '../aiConversationFacadeValidator'
import type {
  AIConversationService,
  AIConversationServiceDependencies,
  AIConversationServiceFailure,
  AIConversationServiceInput,
  AIConversationServiceResult,
} from './aiConversationContracts'
import {
  AI_CONVERSATION_SERVICE_PROTOCOL_VERSION,
} from './aiConversationContracts'
import {
  createNoopAIConversationMetricsRecorder,
} from './aiConversationMetrics'
import {
  validateAIConversationConfidencePolicy,
  validateAIConversationExecution,
  validateAIConversationFallback,
  validateAIConversationProviderIdentifier,
} from './aiConversationValidator'

function createFailure(
  code: AIConversationServiceFailure['code'],
  safeMessage: string,
): AIConversationServiceFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

export function createAIConversationService(
  dependencies: AIConversationServiceDependencies,
): AIConversationService {
  const clock = dependencies.clock ?? (() => Date.now())
  const now = dependencies.now ?? (() => new Date().toISOString())
  const metrics = dependencies.metrics ?? createNoopAIConversationMetricsRecorder()

  const policyValidation = validateAIConversationConfidencePolicy(dependencies.confidencePolicy)
  if (policyValidation !== null) {
    throw new Error(policyValidation.safeMessage)
  }

  return {
    async processConversation(
      input: AIConversationServiceInput,
    ): Promise<AIConversationServiceResult> {
      const startedAt = clock()
      const requestedAt = input.requestedAt ?? now()

      const requestValidation = validateAIConversationRequest(input.conversationRequest)
      if (requestValidation !== null) {
        metrics.record({
          provider: dependencies.provider.metadata.providerId,
          durationMs: clock() - startedAt,
          operation: 'process-conversation',
          fallbackUsed: false,
          success: false,
          errorCode: requestValidation.code,
        })

        return createFailure('INVALID_SERVICE_INPUT', requestValidation.safeMessage)
      }

      const primaryResolve = dependencies.provider.resolveIntent
      if (primaryResolve === undefined) {
        return createFailure('PROVIDER_UNAVAILABLE', 'Primary AI provider does not implement intent resolution.')
      }

      const fallbackResolve = dependencies.fallbackProvider.resolveIntent
      if (fallbackResolve === undefined) {
        return createFailure('PROVIDER_UNAVAILABLE', 'Fallback AI provider does not implement intent resolution.')
      }

      const primaryIntent = await primaryResolve({
        protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
        conversationRequest: input.conversationRequest,
        metadata: {
          userMessage: input.userMessage,
          turn: input.turn,
          requestedAt,
        },
      }).catch(() => {
        return {
          kind: 'failure',
          code: 'INTENT_RESOLUTION_FAILED',
          retryable: false,
          safeMessage: 'Primary intent resolution failed.',
        } as const
      })

      let fallbackUsed = false
      let providerUsed = dependencies.provider
      let providerId = dependencies.provider.metadata.providerId
      let intentResult = primaryIntent

      const primaryIntentValidation = validateAIProviderIntentResolutionResult(primaryIntent)
      const primaryLowConfidence =
        primaryIntent.kind === 'success'
        && primaryIntent.resolution.confidence < dependencies.confidencePolicy.confidenceThreshold

      if (primaryIntentValidation !== null || primaryIntent.kind === 'failure' || primaryLowConfidence) {
        fallbackUsed = true
        providerUsed = dependencies.fallbackProvider
        providerId = dependencies.fallbackProvider.metadata.providerId

        const fallbackIntent = await fallbackResolve({
          protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
          conversationRequest: input.conversationRequest,
          metadata: {
            userMessage: input.userMessage,
            turn: input.turn,
            requestedAt,
          },
        }).catch(() => {
          return {
            kind: 'failure',
            code: 'INTENT_RESOLUTION_FAILED',
            retryable: false,
            safeMessage: 'Fallback intent resolution failed.',
          } as const
        })

        const fallbackIntentValidation = validateAIProviderIntentResolutionResult(fallbackIntent)
        if (fallbackIntentValidation !== null || fallbackIntent.kind === 'failure') {
          const errorCode = fallbackIntentValidation?.code
            ?? (fallbackIntent.kind === 'failure' ? fallbackIntent.code : 'INTENT_RESOLUTION_FAILED')

          metrics.record({
            provider: providerId,
            durationMs: clock() - startedAt,
            operation: 'resolve-intent',
            fallbackUsed: true,
            success: false,
            errorCode,
          })

          return createFailure('INTENT_RESOLUTION_FAILED', fallbackIntentValidation?.safeMessage
            ?? (fallbackIntent.kind === 'failure'
              ? fallbackIntent.safeMessage
              : 'Fallback intent resolution failed.'))
        }

        intentResult = fallbackIntent
      }

      if (intentResult.kind !== 'success') {
        metrics.record({
          provider: providerId,
          durationMs: clock() - startedAt,
          operation: 'resolve-intent',
          fallbackUsed,
          success: false,
          errorCode: intentResult.code,
        })

        return createFailure('INTENT_RESOLUTION_FAILED', intentResult.safeMessage)
      }

      const providerValidation = validateAIConversationProviderIdentifier(providerId)
      if (providerValidation !== null) {
        return createFailure('PROVIDER_UNAVAILABLE', providerValidation.safeMessage)
      }

      const fallbackValidation = validateAIConversationFallback(providerId, fallbackUsed)
      if (fallbackValidation !== null) {
        return createFailure('PROVIDER_UNAVAILABLE', fallbackValidation.safeMessage)
      }

      const requestFromResolution = {
        ...input.conversationRequest,
        steps: intentResult.resolution.tools.map((tool, index) => ({
          stepId: `step:${input.turn}:${index + 1}`,
          order: index + 1,
          toolId: tool.toolId,
          arguments: structuredClone(tool.arguments),
        })),
      }

      const resolvedRequestValidation = validateAIConversationRequest(requestFromResolution)
      if (resolvedRequestValidation !== null) {
        metrics.record({
          provider: providerId,
          durationMs: clock() - startedAt,
          operation: 'facade-execute',
          fallbackUsed,
          success: false,
          errorCode: resolvedRequestValidation.code,
        })

        return createFailure('FACADE_EXECUTION_FAILED', resolvedRequestValidation.safeMessage)
      }

      const execution = await dependencies.facade.execute(requestFromResolution).catch(() => {
        return {
          kind: 'failure',
          code: 'CONVERSATION_ORCHESTRATION_FAILED',
          retryable: false,
          safeMessage: 'AI conversation facade execution failed.',
        } as const
      })
      if (execution.kind === 'failure') {
        metrics.record({
          provider: providerId,
          durationMs: clock() - startedAt,
          operation: 'facade-execute',
          fallbackUsed,
          success: false,
          errorCode: execution.code,
        })

        return createFailure('FACADE_EXECUTION_FAILED', execution.safeMessage)
      }

      const generateConversation = providerUsed.generateConversation
      if (generateConversation === undefined) {
        return createFailure('PROVIDER_UNAVAILABLE', 'Selected AI provider does not implement conversation generation.')
      }

      const rendered = await generateConversation(execution.response).catch(() => {
        return {
          kind: 'failure',
          code: 'CONVERSATION_GENERATION_FAILED',
          retryable: false,
          safeMessage: 'Conversation generation failed.',
        } as const
      })
      const renderValidation = validateAIProviderConversationGenerationResult(rendered)
      if (renderValidation !== null || rendered.kind === 'failure') {
        const safeMessage = renderValidation?.safeMessage
          ?? (rendered.kind === 'failure'
            ? rendered.safeMessage
            : 'Conversation generation failed.')
        const errorCode = renderValidation?.code
          ?? (rendered.kind === 'failure'
            ? rendered.code
            : 'CONVERSATION_GENERATION_FAILED')

        metrics.record({
          provider: providerId,
          durationMs: clock() - startedAt,
          operation: 'generate-conversation',
          fallbackUsed,
          success: false,
          errorCode,
        })

        return createFailure('CONVERSATION_GENERATION_FAILED', safeMessage)
      }

      const executionPayload = {
        protocolVersion: AI_CONVERSATION_SERVICE_PROTOCOL_VERSION,
        provider: providerId,
        intent: intentResult.resolution.detectedIntent,
        confidence: intentResult.resolution.confidence,
        conversationGenerated: true,
        executionTime: clock() - startedAt,
        fallbackUsed,
        success: true,
        error: null,
      }

      const executionValidation = validateAIConversationExecution(executionPayload)
      if (executionValidation !== null) {
        metrics.record({
          provider: providerId,
          durationMs: clock() - startedAt,
          operation: 'execution-validation',
          fallbackUsed,
          success: false,
          errorCode: executionValidation.code,
        })

        return createFailure('CONVERSATION_GENERATION_FAILED', executionValidation.safeMessage)
      }

      metrics.record({
        provider: providerId,
        durationMs: executionPayload.executionTime,
        operation: 'process-conversation',
        fallbackUsed,
        success: true,
      })

      return {
        kind: 'success',
        message: rendered.message,
        execution: executionPayload,
      }
    },
  }
}

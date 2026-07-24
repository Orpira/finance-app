import {
  validateAIProviderConversationGenerationResult,
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
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'
import {
  AI_CONVERSATION_SERVICE_PROTOCOL_VERSION,
} from './aiConversationContracts'
import {
  createNoopAIConversationMetricsRecorder,
} from './aiConversationMetrics'
import {
  createActivationEngine,
} from './activationEngine'
import {
  createFinancialConversationSkillModule,
} from './financialConversationFactory'
import {
  createConversationContextResolver,
  createConversationMemory,
} from './conversationMemoryFactory'
import {
  createFinancialInsightEngine,
} from './financialInsightFactory'
import type {
  ActivationDecision,
  ActivationEngine,
} from './activationContracts'
import type {
  FinancialConversationSkillResolver,
} from './financialConversationSkillResolver'
import type {
  ConversationContextEnrichment,
  ConversationContextResolver,
  ConversationMemory,
} from './conversationMemoryContracts'
import type {
  FinancialInsight,
  FinancialInsightEngine,
} from './financialInsightContracts'
import {
  validateActivationDecision,
} from './activationValidator'
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

function createDirectToolMessageText(
  decision: ActivationDecision,
): string {
  if (decision.toolId === null) {
    return 'Se ejecuto la herramienta solicitada de forma determinista.'
  }

  if (decision.toolId === 'financial_transactions') {
    return 'Se ejecutaron tus transacciones de forma determinista sin usar IA.'
  }

  if (decision.toolId === 'financial_balance') {
    return 'Se calculo tu balance de forma determinista sin usar IA.'
  }

  return `Se ejecuto ${decision.toolId} de forma determinista sin usar IA.`
}

function mergeExecutionPlanWithContext(
  executionPlan: FinancialConversationExecutionPlan,
  enrichment: ConversationContextEnrichment,
): FinancialConversationExecutionPlan {
  if (enrichment.toolArgumentsPatch === null) {
    return executionPlan
  }

  return {
    ...executionPlan,
    activationDecision: {
      ...executionPlan.activationDecision,
      toolArguments: structuredClone(enrichment.toolArgumentsPatch),
    },
    context: {
      ...executionPlan.context,
      enrichment: structuredClone(enrichment),
    },
  }
}

function mergeExecutionPlanInsights(
  executionPlan: FinancialConversationExecutionPlan,
  insights: readonly FinancialInsight[],
): FinancialConversationExecutionPlan {
  if (insights.length === 0) {
    return executionPlan
  }

  return {
    ...executionPlan,
    context: {
      ...executionPlan.context,
      insights: structuredClone(insights),
    },
  }
}

function formatInsightText(insight: FinancialInsight): string {
  return `${insight.title}: ${insight.recommendation}`
}

function appendInsightsToMessage(
  text: string,
  insights: readonly FinancialInsight[],
): string {
  if (insights.length === 0) {
    return text
  }

  const summary = insights.slice(0, 3).map(formatInsightText).join(' ')
  return `${text}\n\nRecomendaciones proactivas: ${summary}`
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

  const injectedActivationEngine = (
    dependencies as AIConversationServiceDependencies & {
      readonly activationEngine?: ActivationEngine
    }
  ).activationEngine

  const injectedSkillResolver = (
    dependencies as AIConversationServiceDependencies & {
      readonly skillResolver?: FinancialConversationSkillResolver
    }
  ).skillResolver

  const activationEngine = injectedActivationEngine ?? createActivationEngine({
    primaryProviderId: dependencies.provider.metadata.providerId,
    fallbackProviderId: dependencies.fallbackProvider.metadata.providerId,
    primaryIntentResolver: dependencies.provider.resolveIntent,
    fallbackIntentResolver: dependencies.fallbackProvider.resolveIntent,
    routingStrategy: {
      exists() {
        return true
      },
    },
    policy: {
      minimumConfidence: dependencies.confidencePolicy.confidenceThreshold,
      enableFallback: true,
      enableAIExplanation: true,
      enableDirectTools: true,
    },
    clock,
    now,
  })

  const skillResolver = injectedSkillResolver
    ?? createFinancialConversationSkillModule().resolver

  const memory = (
    dependencies as AIConversationServiceDependencies & {
      readonly conversationMemory?: ConversationMemory
    }
  ).conversationMemory ?? createConversationMemory()

  const insightEngine = (
    dependencies as AIConversationServiceDependencies & {
      readonly financialInsightEngine?: FinancialInsightEngine
    }
  ).financialInsightEngine ?? createFinancialInsightEngine()

  const contextResolver = (
    dependencies as AIConversationServiceDependencies & {
      readonly conversationContextResolver?: ConversationContextResolver
    }
  ).conversationContextResolver ?? createConversationContextResolver()

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

      const decision = await activationEngine.decide({
        conversationRequest: input.conversationRequest,
        userMessage: input.userMessage,
        turn: input.turn,
        requestedAt,
      })

      const decisionValidation = validateActivationDecision(decision)
      if (decisionValidation !== null) {
        metrics.record({
          provider: dependencies.provider.metadata.providerId,
          durationMs: clock() - startedAt,
          operation: 'activation-decision',
          fallbackUsed: false,
          success: false,
          errorCode: decisionValidation.code,
        })

        return createFailure('INVALID_SERVICE_INPUT', decisionValidation.safeMessage)
      }

      if (decision.activationType === 'INVALID_REQUEST') {
        metrics.record({
          provider: decision.provider,
          durationMs: clock() - startedAt,
          operation: 'activation-decision',
          fallbackUsed: decision.fallback.used,
          success: false,
          errorCode: 'INVALID_REQUEST',
        })

        return createFailure('INVALID_SERVICE_INPUT', decision.reason)
      }

      const skillResolution = skillResolver.resolve({
        activationDecision: decision,
        userMessage: input.userMessage,
      })

      if (skillResolution.kind === 'failure') {
        metrics.record({
          provider: decision.provider,
          durationMs: clock() - startedAt,
          operation: 'skill-resolution',
          fallbackUsed: decision.fallback.used,
          success: false,
          errorCode: skillResolution.code,
        })

        return createFailure('FACADE_EXECUTION_FAILED', skillResolution.safeMessage)
      }

      const snapshot = memory.getSnapshot(
        input.conversationRequest.context.sessionId,
        requestedAt,
      )

      const planEnrichment = contextResolver.enrich({
        request: input.conversationRequest,
        userMessage: input.userMessage,
        plan: skillResolution.plan,
        snapshot,
      })

      const executionPlan = mergeExecutionPlanWithContext(skillResolution.plan, planEnrichment)
      const insights = await insightEngine.evaluate({
        sessionId: input.conversationRequest.context.sessionId,
        userMessage: input.userMessage,
        requestedAt,
        plan: executionPlan,
        snapshot,
      })
      const executionPlanWithInsights = mergeExecutionPlanInsights(executionPlan, insights)
      const requiredToolId = executionPlanWithInsights.requiredTools[0] ?? null
      const requiresAIConversation = decision.requiresAI || executionPlanWithInsights.requiresAIExplanation

      const providerUsed = decision.provider === dependencies.fallbackProvider.metadata.providerId
        ? dependencies.fallbackProvider
        : dependencies.provider
      const providerId = providerUsed.metadata.providerId

      const providerValidation = validateAIConversationProviderIdentifier(providerId)
      if (providerValidation !== null) {
        return createFailure('PROVIDER_UNAVAILABLE', providerValidation.safeMessage)
      }

      const fallbackValidation = validateAIConversationFallback(providerId, decision.fallback.used)
      if (fallbackValidation !== null) {
        return createFailure('PROVIDER_UNAVAILABLE', fallbackValidation.safeMessage)
      }

      const requestFromDecision = requiredToolId !== null
        ? {
            ...input.conversationRequest,
            steps: [
              {
                stepId: `step:${input.turn}:activation:1`,
                order: 1,
                toolId: requiredToolId,
                arguments: structuredClone(executionPlanWithInsights.activationDecision.toolArguments ?? {}),
              },
            ],
          }
        : input.conversationRequest

      const resolvedRequestValidation = validateAIConversationRequest(requestFromDecision)
      if (resolvedRequestValidation !== null) {
        metrics.record({
          provider: providerId,
          durationMs: clock() - startedAt,
          operation: 'facade-execute',
          fallbackUsed: decision.fallback.used,
          success: false,
          errorCode: resolvedRequestValidation.code,
        })

        return createFailure('FACADE_EXECUTION_FAILED', resolvedRequestValidation.safeMessage)
      }

      const execution = await dependencies.facade.execute(requestFromDecision).catch(() => {
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
          fallbackUsed: decision.fallback.used,
          success: false,
          errorCode: execution.code,
        })

        return createFailure('FACADE_EXECUTION_FAILED', execution.safeMessage)
      }

      let message
      if (!requiresAIConversation && decision.activationType === 'DIRECT_TOOL') {
        message = {
          protocolVersion: 1,
          messageId: `${execution.response.responseId}:direct-tool`,
          type: 'assistant',
          origin: 'MOCK_RENDERER',
          timestamp: now(),
          text: appendInsightsToMessage(createDirectToolMessageText(decision), insights),
          responseId: execution.response.responseId,
          conversationResponse: execution.response,
          traceability: {
            executionId: execution.response.execution.executionId,
            promptContextId: execution.response.execution.promptContextId,
          },
        } as const
      } else {
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
            fallbackUsed: decision.fallback.used,
            success: false,
            errorCode,
          })

          return createFailure('CONVERSATION_GENERATION_FAILED', safeMessage)
        }

        message = {
          ...rendered.message,
          text: appendInsightsToMessage(rendered.message.text, insights),
        }
      }

      const executionPayload = {
        protocolVersion: AI_CONVERSATION_SERVICE_PROTOCOL_VERSION,
        provider: providerId,
        intent: decision.intent,
        confidence: decision.confidence,
        conversationGenerated: requiresAIConversation,
        executionTime: clock() - startedAt,
        fallbackUsed: decision.fallback.used,
        success: true,
        error: null,
      }

      const executionValidation = validateAIConversationExecution(executionPayload)
      if (executionValidation !== null) {
        metrics.record({
          provider: providerId,
          durationMs: clock() - startedAt,
          operation: 'execution-validation',
          fallbackUsed: decision.fallback.used,
          success: false,
          errorCode: executionValidation.code,
        })

        return createFailure('CONVERSATION_GENERATION_FAILED', executionValidation.safeMessage)
      }

      metrics.record({
        provider: providerId,
        durationMs: executionPayload.executionTime,
        operation: 'process-conversation',
        fallbackUsed: decision.fallback.used,
        success: true,
      })

      memory.remember({
        sessionId: input.conversationRequest.context.sessionId,
        userMessage: input.userMessage,
        requestedAt,
        plan: executionPlan,
      })

      return {
        kind: 'success',
        message,
        execution: executionPayload,
      }
    },
  }
}

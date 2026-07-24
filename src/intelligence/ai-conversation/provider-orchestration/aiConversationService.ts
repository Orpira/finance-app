import {
  validateAIProviderConversationGenerationResult,
} from '../../ai-provider/aiProviderValidator'
import type {
  AIToolJsonValue,
} from '../../ai-tools'
import {
  validateAIConversationRequest,
} from '../aiConversationFacadeValidator'
import type {
  AIConversationExecutionResult,
} from '../../conversation-orchestrator'
import {
  createPromptContextBuilder,
} from '../../prompt-context-builder'
import {
  createConversationResponseComposer,
  type ConversationResponse,
} from '../../response-composer'
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
import {
  createFinancialPlanningEngine,
} from './financialPlanningFactory'
import {
  createFinancialConversationContext,
  createFinancialToolResultMapper,
} from './financialConversationContextFactory'
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
import type {
  FinancialActionPlan,
  FinancialPlanningEngine,
} from './financialPlanningContracts'
import type {
  FinancialConversationContext,
} from './financialConversationContext'
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

function mergeExecutionPlanActionPlan(
  executionPlan: FinancialConversationExecutionPlan,
  actionPlan: FinancialActionPlan | null,
): FinancialConversationExecutionPlan {
  if (actionPlan === null) {
    return executionPlan
  }

  return {
    ...executionPlan,
    context: {
      ...executionPlan.context,
      actionPlan: structuredClone(actionPlan),
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

function formatActionSummary(
  actionPlan: FinancialActionPlan,
): string {
  return actionPlan.recommendedActions
    .slice(0, 3)
    .map((action) => action.description)
    .join(' ')
}

function appendActionPlanToMessage(
  text: string,
  actionPlan: FinancialActionPlan | null,
): string {
  if (actionPlan === null) {
    return text
  }

  const actionSummary = formatActionSummary(actionPlan)
  return `${text}\n\nPlan financiero inteligente: ${actionPlan.summary} Acciones sugeridas: ${actionSummary}`
}

function estimateTokensFromText(text: string): number {
  if (text.trim().length === 0) {
    return 0
  }

  return Math.ceil(text.length / 4)
}

function createResponseWithFinancialContext(
  response: ConversationResponse,
  financialContext: FinancialConversationContext,
): { readonly kind: 'success'; readonly response: ConversationResponse } | { readonly kind: 'failure'; readonly safeMessage: string } {
  const promptContextBuilder = createPromptContextBuilder()
  const responseComposer = createConversationResponseComposer()

  const executionResult: AIConversationExecutionResult = {
    executionId: response.execution.executionId,
    startedAt: response.execution.startedAt,
    finishedAt: response.execution.finishedAt,
    status: response.execution.status,
    summary: {
      totalSteps: response.execution.stepCount,
      successfulSteps: response.execution.successCount,
      failedSteps: response.execution.failureCount,
    },
    steps: response.promptContext.steps.map((step) => {
      if (step.kind === 'success') {
        return {
          kind: 'success' as const,
          stepId: step.stepId,
          order: step.order,
          toolId: step.toolId,
          resolvedToolName: step.resolvedToolName,
          execution: {
            toolName: step.resolvedToolName,
            output: structuredClone(step.output),
            permission: step.permission,
            durationMs: step.durationMs,
          },
        }
      }

      return {
        kind: 'failure' as const,
        stepId: step.stepId,
        order: step.order,
        toolId: step.toolId,
        error: {
          kind: 'failure' as const,
          code: step.error.code,
          retryable: step.error.retryable,
          safeMessage: step.error.safeMessage,
          ...(step.error.details === undefined
            ? {}
            : { details: structuredClone(step.error.details) }),
        },
      }
    }),
  }

  const rebuiltPromptContext = promptContextBuilder.build({
    executionResult,
    attributes: {
      ...(response.promptContext.metadata.attributes === undefined
        ? {}
        : structuredClone(response.promptContext.metadata.attributes)),
      financialConversationContext: structuredClone(financialContext) as unknown as AIToolJsonValue,
    },
  })

  if (rebuiltPromptContext.kind === 'failure') {
    return {
      kind: 'failure',
      safeMessage: rebuiltPromptContext.safeMessage,
    }
  }

  const rebuiltResponse = responseComposer.build({
    promptContext: rebuiltPromptContext.context,
  })

  if (rebuiltResponse.kind === 'failure') {
    return {
      kind: 'failure',
      safeMessage: rebuiltResponse.safeMessage,
    }
  }

  return {
    kind: 'success',
    response: rebuiltResponse.response,
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

  const planningEngine = (
    dependencies as AIConversationServiceDependencies & {
      readonly financialPlanningEngine?: FinancialPlanningEngine
    }
  ).financialPlanningEngine ?? createFinancialPlanningEngine()

  const contextResolver = (
    dependencies as AIConversationServiceDependencies & {
      readonly conversationContextResolver?: ConversationContextResolver
    }
  ).conversationContextResolver ?? createConversationContextResolver()

  const toolResultMapper = createFinancialToolResultMapper()

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
      const actionPlan = planningEngine.build({
        sessionId: input.conversationRequest.context.sessionId,
        userMessage: input.userMessage,
        requestedAt,
        executionPlan: executionPlanWithInsights,
        insights,
      })
      const executionPlanWithPlanning = mergeExecutionPlanActionPlan(executionPlanWithInsights, actionPlan)
      const requiredToolId = executionPlanWithPlanning.requiredTools[0] ?? null
      const requiresAIConversation = decision.requiresAI || executionPlanWithPlanning.requiresAIExplanation

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
                arguments: structuredClone(executionPlanWithPlanning.activationDecision.toolArguments ?? {}),
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

      const mappedToolResults = toolResultMapper.map({
        steps: execution.response.promptContext.steps,
      })

      const financialContext = createFinancialConversationContext({
        createdAt: requestedAt,
        toolResults: mappedToolResults,
        memory: snapshot === null ? null : structuredClone(snapshot),
        insights,
        actionPlan,
        userIntent: decision.intent,
        executionPlan: executionPlanWithPlanning,
        activationDecision: decision,
      })

      const responseWithFinancialContext = createResponseWithFinancialContext(
        execution.response,
        financialContext,
      )

      if (responseWithFinancialContext.kind === 'failure') {
        return createFailure('FACADE_EXECUTION_FAILED', responseWithFinancialContext.safeMessage)
      }

      const providerPromptPayload = JSON.stringify({
        promptContext: responseWithFinancialContext.response.promptContext,
        blocks: responseWithFinancialContext.response.blocks,
      })
      const promptTokenEstimate = estimateTokensFromText(providerPromptPayload)

      let message
      if (!requiresAIConversation && decision.activationType === 'DIRECT_TOOL') {
        message = {
          protocolVersion: 1,
          messageId: `${execution.response.responseId}:direct-tool`,
          type: 'assistant',
          origin: 'MOCK_RENDERER',
          timestamp: now(),
          text: appendActionPlanToMessage(
            appendInsightsToMessage(createDirectToolMessageText(decision), insights),
            actionPlan,
          ),
          responseId: execution.response.responseId,
          conversationResponse: responseWithFinancialContext.response,
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

        const rendered = await generateConversation(responseWithFinancialContext.response).catch(() => {
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
          text: appendActionPlanToMessage(
            appendInsightsToMessage(rendered.message.text, insights),
            actionPlan,
          ),
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

      const completionTokenEstimate = estimateTokensFromText(message.text)

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

      metrics.record({
        provider: providerId,
        durationMs: executionPayload.executionTime,
        operation: 'financial-context',
        fallbackUsed: decision.fallback.used,
        success: true,
        errorCode: `tool:${requiredToolId ?? 'none'};contextSize:${JSON.stringify(financialContext).length};promptTokens:${promptTokenEstimate};completionTokens:${completionTokenEstimate}`,
      })

      memory.remember({
        sessionId: input.conversationRequest.context.sessionId,
        userMessage: input.userMessage,
        requestedAt,
        plan: executionPlanWithPlanning,
      })

      return {
        kind: 'success',
        message,
        execution: executionPayload,
      }
    },
  }
}

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
  buildFinancialDirectResponseText,
} from './financialDirectResponseBuilder'
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
import {
  recordRuntimePromptAudit,
  recordRuntimeProviderAudit,
  recordRuntimeResponseAudit,
} from './runtimeConversationAudit'
import {
  createDeterministicIntentResolver,
} from '../../intent-resolver/deterministicIntentResolver'
import {
  INTENT_RESOLVER_PROTOCOL_VERSION,
} from '../../intent-resolver/intentResolverContracts'
import type {
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

// --- Relevance Policy (PB-IS-016.2 sección 10) ---
// Insights y Planning solo aportan valor cuando el usuario pregunta por su
// situacion financiera en general (riesgos, recomendaciones, ahorro). Para
// consultas deterministas puntuales (montos, conteos, un periodo concreto)
// no se anexan, para no diluir la respuesta con informacion no solicitada
// (DA-0162-03).
const FINANCIAL_ADVICE_RELEVANCE_PATTERN = /situacion financiera|salud financiera|riesgo|recom\w*|consejo|ahorr\w*|como (voy|estoy|ando|puedo)|plan financiero|mejorar (mi|la)/

function isFinancialAdviceRelevant(userMessage: string): boolean {
  const normalized = userMessage
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

  return FINANCIAL_ADVICE_RELEVANCE_PATTERN.test(normalized)
}

function estimateTokensFromText(text: string): number {
  if (text.trim().length === 0) {
    return 0
  }

  return Math.ceil(text.length / 4)
}

function detectCompareLatestIncomeIntent(userMessage: string): boolean {
  const normalized = userMessage.toLowerCase()
  const hasComparisonVerb = /compara|comparar|compare|versus|vs/.test(normalized)
  const hasIncomeSignal = /ingreso|income/.test(normalized)
  const hasLatestSignal = /ultimo|ultimos|último|últimos|reciente/.test(normalized)
  return hasComparisonVerb && hasIncomeSignal && hasLatestSignal
}

function applyTransactionsComparisonArguments(
  executionPlan: FinancialConversationExecutionPlan,
  userMessage: string,
): FinancialConversationExecutionPlan {
  if (
    executionPlan.activationDecision.intent !== 'transactions'
    || !detectCompareLatestIncomeIntent(userMessage)
  ) {
    return executionPlan
  }

  const currentArguments = executionPlan.activationDecision.toolArguments ?? {}

  return {
    ...executionPlan,
    activationDecision: {
      ...executionPlan.activationDecision,
      toolArguments: {
        ...structuredClone(currentArguments),
        filters: {
          kinds: ['income'],
        },
        sort: {
          field: 'date',
          direction: 'desc',
        },
        limit: 2,
      },
    },
  }
}

function isJsonRecord(value: AIToolJsonValue | undefined): value is Record<string, AIToolJsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

const TOOLS_WITH_PERIOD_FILTER = new Set(['financial_transactions', 'financial_balance'])

const deterministicTemporalResolver = createDeterministicIntentResolver()

/**
 * PB-IS-016.2-R3: cuando el mensaje del usuario contiene una expresion
 * temporal explicita (hoy, ayer, una fecha, etc.), el `filters.period` que
 * llega a la Tool debe venir SIEMPRE del Deterministic Intent Resolver ya
 * certificado (016.2/R2), nunca del proveedor primario. Root cause real
 * (demostrado con runtime en un dispositivo con OpenAI real activo, no en
 * fixtures): cuando `VITE_AI_PROVIDER=openai`, el resolver primario de
 * intencion es OpenAI (`conversationComposition.ts`), y OpenAI puede generar
 * un `filters.period` con una fecha alucinada (estructuralmente valida
 * contra el schema, por lo que `toolArgumentValidator`/`toolArgumentRepair`
 * de PB-IS-016.1 no la detectan como error) que no corresponde a "ayer"/"hoy"
 * reales, devolviendo 0 resultados aunque la UI muestre datos reales para
 * esa fecha. El Resolver determinista nunca inventa fechas: si detecta una
 * expresion temporal, su cálculo es la unica fuente de verdad para el rango
 * de fechas; el resto de los argumentos (kinds, sort, limit, etc.) que haya
 * resuelto el proveedor primario se conservan sin tocar.
 */
async function enforceDeterministicTemporalPeriod(
  executionPlan: FinancialConversationExecutionPlan,
  input: {
    readonly conversationRequest: AIConversationServiceInput['conversationRequest']
    readonly userMessage: string
    readonly turn: number
    readonly requestedAt: string
  },
): Promise<FinancialConversationExecutionPlan> {
  const toolId = executionPlan.activationDecision.toolId
  if (toolId === null || !TOOLS_WITH_PERIOD_FILTER.has(toolId)) {
    return executionPlan
  }

  const deterministicResult = await deterministicTemporalResolver.resolve({
    protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
    conversationRequest: input.conversationRequest,
    metadata: {
      userMessage: input.userMessage,
      turn: input.turn,
      requestedAt: input.requestedAt,
    },
  })

  if (deterministicResult.kind !== 'success') {
    return executionPlan
  }

  const deterministicArguments = deterministicResult.resolution.tools[0]?.arguments
  const deterministicFilters = isJsonRecord(deterministicArguments)
    ? deterministicArguments.filters
    : undefined
  const deterministicPeriod = isJsonRecord(deterministicFilters)
    ? deterministicFilters.period
    : undefined

  if (!isJsonRecord(deterministicPeriod)) {
    return executionPlan
  }

  const currentArguments = executionPlan.activationDecision.toolArguments ?? {}
  const currentFilters = isJsonRecord(currentArguments.filters) ? currentArguments.filters : {}

  return {
    ...executionPlan,
    activationDecision: {
      ...executionPlan.activationDecision,
      toolArguments: {
        ...structuredClone(currentArguments),
        filters: {
          ...structuredClone(currentFilters),
          period: structuredClone(deterministicPeriod),
        },
      },
    },
  }
}

function shouldForceAIConversation(
  input: {
    readonly userMessage: string
    readonly intent: string
    readonly providerId: string
  },
): boolean {
  return input.providerId === 'openai-provider'
    && input.intent === 'transactions'
    && detectCompareLatestIncomeIntent(input.userMessage)
}

function extractLatestIncomeAmountsFromResponse(
  response: ConversationResponse,
): readonly number[] {
  for (const step of response.promptContext.steps) {
    if (step.kind !== 'success' || step.toolId !== 'financial_transactions') {
      continue
    }

    const output = step.output
    if (output === null || typeof output !== 'object' || Array.isArray(output)) {
      continue
    }

    const items = (output as { readonly items?: unknown }).items
    if (!Array.isArray(items)) {
      continue
    }

    const incomeAmounts = items
      .map((item) => {
        if (item === null || typeof item !== 'object' || Array.isArray(item)) {
          return null
        }
        const amount = (item as { readonly amount?: unknown }).amount
        return typeof amount === 'number' && Number.isFinite(amount)
          ? amount
          : null
      })
      .filter((amount): amount is number => amount !== null)

    if (incomeAmounts.length > 0) {
      return incomeAmounts.slice(0, 2)
    }
  }

  return []
}

function createIncomeComparisonMessage(
  response: ConversationResponse,
): string | null {
  const amounts = extractLatestIncomeAmountsFromResponse(response)
  if (amounts.length < 2) {
    return null
  }

  const latest = amounts[0] ?? 0
  const previous = amounts[1] ?? 0
  const difference = latest - previous
  const trend = difference >= 0 ? 'subió' : 'bajó'

  return `Comparación de tus dos últimos ingresos: ${latest} vs ${previous}. La variación fue de ${Math.abs(difference)} y ${trend} en ${difference >= 0 ? 'positivo' : 'negativo'}.`
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
      const executionPlanWithTemporalPeriod = await enforceDeterministicTemporalPeriod(executionPlan, {
        conversationRequest: input.conversationRequest,
        userMessage: input.userMessage,
        turn: input.turn,
        requestedAt,
      })
      const executionPlanForRequest = applyTransactionsComparisonArguments(executionPlanWithTemporalPeriod, input.userMessage)
      const insights = await insightEngine.evaluate({
        sessionId: input.conversationRequest.context.sessionId,
        userMessage: input.userMessage,
        requestedAt,
        plan: executionPlanForRequest,
        snapshot,
      })
      const executionPlanWithInsights = mergeExecutionPlanInsights(executionPlanForRequest, insights)
      const actionPlan = planningEngine.build({
        sessionId: input.conversationRequest.context.sessionId,
        userMessage: input.userMessage,
        requestedAt,
        executionPlan: executionPlanWithInsights,
        insights,
      })
      const executionPlanWithPlanning = mergeExecutionPlanActionPlan(executionPlanWithInsights, actionPlan)
      const requiredToolId = executionPlanWithPlanning.requiredTools[0] ?? null

      // PB-IS-016.2 sección 10-11-12: Insights/Planning solo se anexan al
      // mensaje final cuando la consulta del usuario es de indole asesora
      // (situacion financiera, riesgos, recomendaciones, ahorro). El resto
      // del pipeline (financialContext, memoria) sigue viendo el insight y
      // el plan completos; solo se filtra lo que se anexa a `message.text`.
      const adviceRelevant = isFinancialAdviceRelevant(input.userMessage)
      const insightsToAppend = adviceRelevant ? insights : []
      const actionPlanToAppend = adviceRelevant ? actionPlan : null

      const providerUsed = decision.provider === dependencies.fallbackProvider.metadata.providerId
        ? dependencies.fallbackProvider
        : dependencies.provider
      const providerId = providerUsed.metadata.providerId

      const forcedAIConversation = shouldForceAIConversation({
        userMessage: input.userMessage,
        intent: decision.intent,
        providerId,
      })
      const requiresAIConversation = decision.requiresAI || executionPlanWithPlanning.requiresAIExplanation || forcedAIConversation

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
        const directToolStartedAt = clock()
        // PB-IS-016.2-R3: solo usar la comparacion de "dos ultimos ingresos"
        // cuando el propio mensaje del usuario la pidio (mismo detector que
        // shouldForceAIConversation/applyTransactionsComparisonArguments).
        // Sin este guard, cualquier consulta DIRECT_TOOL cuyo resultado
        // tuviera 2+ ingresos (p. ej. "cuantos ingresos obtuve ayer") era
        // secuestrada por este mensaje fijo, sin importar la pregunta real.
        const incomeComparisonMessage = detectCompareLatestIncomeIntent(input.userMessage)
          ? createIncomeComparisonMessage(responseWithFinancialContext.response)
          : null
        const directResponse = incomeComparisonMessage !== null
          ? { text: incomeComparisonMessage, builderId: 'income-comparison' as const }
          : buildFinancialDirectResponseText({
              // PB-IS-016.2-R3: usar la decision con el filters.period ya
              // corregido por enforceDeterministicTemporalPeriod, no la
              // decision original del proveedor primario -- si no, la
              // etiqueta temporal ("Ayer"/"Hoy") se calcula contra un
              // periodo alucinado y desaparece aunque la Tool ya haya
              // consultado (y sumado) la fecha real correcta.
              decision: executionPlanWithPlanning.activationDecision,
              userMessage: input.userMessage,
              response: responseWithFinancialContext.response,
              now,
            })
        const directToolText = directResponse.text

        if (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) {
          // PB-IS-016.2 sección 14: solo metadata tecnica, nunca el texto generado.
          console.debug('[financial-copilot] direct-tool-response', {
            toolId: decision.toolId,
            builderUsed: directResponse.builderId,
            durationMs: clock() - directToolStartedAt,
            payloadReceived: decision.toolId !== null,
            insightsIncluded: insightsToAppend.length > 0 ? 'SI' : 'NO',
            planningIncluded: actionPlanToAppend !== null ? 'SI' : 'NO',
          })
        }

        message = {
          protocolVersion: 1,
          messageId: `${execution.response.responseId}:direct-tool`,
          type: 'assistant',
          origin: 'MOCK_RENDERER',
          timestamp: now(),
          text: appendActionPlanToMessage(
            appendInsightsToMessage(directToolText, insightsToAppend),
            actionPlanToAppend,
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

        recordRuntimeProviderAudit({
          timestamp: requestedAt,
          strategy: providerId === 'openai-provider' ? 'openai' : 'mock',
          providerExpected: providerId,
          providerSelected: providerId,
          model: input.conversationRequest.context.model,
          openAICalled: providerId === 'openai-provider',
          fallbackUsed: decision.fallback.used,
          reasonIfNotCalled: providerId === 'openai-provider'
            ? null
            : 'Provider seleccionado no es OpenAI para esta solicitud.',
        })

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

        if (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) {
          // PB-IS-016.2 sección 14: solo metadata tecnica, nunca el texto generado.
          console.debug('[financial-copilot] ai-conversation-response', {
            intent: decision.intent,
            insightsIncluded: insightsToAppend.length > 0 ? 'SI' : 'NO',
            planningIncluded: actionPlanToAppend !== null ? 'SI' : 'NO',
          })
        }

        message = {
          ...rendered.message,
          text: appendActionPlanToMessage(
            appendInsightsToMessage(rendered.message.text, insightsToAppend),
            actionPlanToAppend,
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

      recordRuntimePromptAudit({
        timestamp: requestedAt,
        provider: providerId,
        promptSize: providerPromptPayload.length,
        contextSize: JSON.stringify(financialContext).length,
        containsFinancialData: financialContext.toolResults.length > 0,
        completionSize: message.text.length,
      })

      recordRuntimeResponseAudit({
        timestamp: requestedAt,
        provider: providerId,
        generatedByOpenAI: providerId === 'openai-provider' && requiresAIConversation,
        generatedByDeterministicComposer: providerId !== 'openai-provider' || !requiresAIConversation,
        messagePreview: message.text.slice(0, 220),
      })

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

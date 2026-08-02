import {
  createAIConversationFacade,
  type AIConversationRequest,
} from '../../intelligence/ai-conversation'
import {
  createAIToolExecutor,
  createAIToolRegistry,
} from '../../intelligence/ai-tools'
import {
  createFinancialAIToolResolver,
  registerFinancialToolsCatalog,
} from '../../intelligence/ai-tools/financial'
import {
  createCopilotAwareToolExecutor,
} from '../../intelligence/financial-copilot/financialCopilotOrchestrator'
import {
  AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
  createFinancialConversationOrchestrator,
} from '../../intelligence/conversation-orchestrator'
import {
  type ChatMessage,
} from '../../intelligence/mock-conversational-renderer/mockConversationalRenderer'
import {
  createAIProvider,
  createMockAIProvider,
  validateAIProvider,
} from '../../intelligence/ai-provider/aiProvider'
import { getSettings } from '../../services/settingsService'
import { createLocalFinancialCopilotQueryHandler } from '../../services/financialCopilotService'
import {
  createPromptContextBuilder,
} from '../../intelligence/prompt-context-builder'
import {
  createConversationResponseComposer,
} from '../../intelligence/response-composer'
import {
  createActivationEngineFromResolver,
} from '../../intelligence/ai-conversation/provider-orchestration/activationFactory'
import {
  createAIConversationService,
} from '../../intelligence/ai-conversation/provider-orchestration/aiConversationService'
import {
  createFinancialConversationSkillModule,
} from '../../intelligence/ai-conversation/provider-orchestration/financialConversationFactory'
import {
  createConversationContextResolver,
  createConversationMemory,
} from '../../intelligence/ai-conversation/provider-orchestration/conversationMemoryFactory'
import {
  createCapabilityAwareIntentResolver,
} from '../../intelligence/intent-resolver/intentResolver'
import {
  createFinancialInsightEngine,
} from '../../intelligence/ai-conversation/provider-orchestration/financialInsightFactory'
import {
  createFinancialPlanningEngine,
} from '../../intelligence/ai-conversation/provider-orchestration/financialPlanningFactory'
import {
  createConversationGoalModule,
} from '../../intelligence/ai-conversation/provider-orchestration/conversationGoalFactory'
import {
  createCoachingModule,
} from '../../intelligence/ai-conversation/provider-orchestration/coachingFactory'
import {
  validateRuntimeRepositoryComposition,
} from '../../intelligence/ai-conversation/provider-orchestration/runtimeRepositoryValidator'
import {
  validateProviderRuntime,
} from '../../intelligence/ai-conversation/provider-orchestration/providerRuntimeValidator'
import {
  validateFinancialTransactionsToolRuntime,
} from '../../intelligence/ai-conversation/provider-orchestration/financialToolRuntimeValidator'
import {
  recordRuntimeRepositoryAudit,
  recordRuntimeProviderAudit,
} from '../../intelligence/ai-conversation/provider-orchestration/runtimeConversationAudit'
import type {
  AIConversationServiceDependencies,
} from '../../intelligence/ai-conversation/provider-orchestration/aiConversationContracts'
import type { ConversationControllerDependencies } from './conversationController'

function createRequestFragment(now: string): string {
  return now
    .replace(/[-.]/g, '')
    .replace(/T/g, ':')
    .replace(/Z/g, '')
    .toLowerCase()
}

function createConversationFacadeAndRegistry() {
  const registry = createAIToolRegistry([])
  const registration = registerFinancialToolsCatalog(registry)
  if (registration.kind === 'failure') {
    throw new Error(registration.safeMessage)
  }

  const promptContextBuilder = createPromptContextBuilder()
  const responseComposer = createConversationResponseComposer()

  // El orquestador nunca recibe el `AIToolExecutor` real "crudo": lo envuelve
  // con `createCopilotAwareToolExecutor` (PB-IS-016.1) para que toda llamada
  // a una Financial Tool -- venga de donde venga -- pase primero por
  // validacion contra el schema real, autoreparacion determinista y reintento
  // (maximo 3 intentos) antes de ejecutarse. Asi se cumple el mandato
  // arquitectonico de la Fase 016: "no debe existir ningun acceso directo
  // desde OpenAI hacia una Tool".
  const copilotAwareToolExecutor = createCopilotAwareToolExecutor({
    registry,
    toolExecutor: createAIToolExecutor({ registry }),
  })

  const facade = createAIConversationFacade({
    orchestrator: createFinancialConversationOrchestrator({
      registry,
      toolExecutor: copilotAwareToolExecutor,
    }),
    promptContextBuilder: {
      build(input) {
        const result = promptContextBuilder.build(input)
        if (result.kind === 'failure') {
          return {
            kind: 'failure',
            code: 'PROMPT_CONTEXT_BUILD_FAILED' as const,
            retryable: false as const,
            safeMessage: result.safeMessage,
            ...(result.details === undefined
              ? {}
              : { details: structuredClone(result.details) }),
          }
        }

        return result
      },
    },
    responseComposer: {
      build(input) {
        const result = responseComposer.build(input)
        if (result.kind === 'failure') {
          return {
            kind: 'failure',
            code: 'CONVERSATION_RESPONSE_BUILD_FAILED' as const,
            retryable: false as const,
            safeMessage: result.safeMessage,
            ...(result.details === undefined
              ? {}
              : { details: structuredClone(result.details) }),
          }
        }

        return result
      },
    },
  })

  return {
    facade,
    registry,
  }
}

export interface CreateConversationControllerDependenciesInput {
  readonly environment?: Readonly<Record<string, unknown>>
}

export function createConversationControllerDependencies(
  input: CreateConversationControllerDependenciesInput = {},
): ConversationControllerDependencies {
  if (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) {
    const repositoryValidation = validateRuntimeRepositoryComposition()
    recordRuntimeRepositoryAudit({
      timestamp: new Date().toISOString(),
      incomeRepository: repositoryValidation.incomeRepository,
      incomeInstanceId: repositoryValidation.incomeInstanceId,
      transactionsToolRepository: repositoryValidation.transactionsToolRepository,
      transactionsToolInstanceId: repositoryValidation.transactionsToolInstanceId,
      sameInstance: repositoryValidation.sameInstance,
      hasRuntimeMocks: repositoryValidation.hasRuntimeMocks,
      detectedRuntimeMockSymbols: repositoryValidation.detectedRuntimeMockSymbols,
    })

    const providerValidation = validateProviderRuntime()
    recordRuntimeProviderAudit({
      timestamp: new Date().toISOString(),
      strategy: providerValidation.strategy,
      providerExpected: providerValidation.providerExpected,
      providerSelected: providerValidation.providerSelected,
      model: providerValidation.model,
      openAICalled: false,
      fallbackUsed: false,
      reasonIfNotCalled: providerValidation.openAIConfigurationError,
    })

    void validateFinancialTransactionsToolRuntime()
  }

  const { facade, registry } = createConversationFacadeAndRegistry()
  const provider = createAIProvider({
    ...(input.environment === undefined ? {} : { environment: input.environment }),
    // Permite que el prompt de resolucion de intencion (openAIAdapter.ts) se
    // genere desde el JSON Schema real de cada Financial Tool en lugar de una
    // descripcion escrita a mano (PB-IS-016.1: "Nunca ejemplos inventados").
    toolRegistry: registry,
  })
  const fallbackProvider = createMockAIProvider()
  const sessionCreatedAt = new Date().toISOString()
  const sessionFragment = createRequestFragment(sessionCreatedAt)
  const conversationId = `conversation:main:${sessionFragment}`
  const sessionId = `session:main:${sessionFragment}`

  const providerValidation = validateAIProvider(provider)
  if (providerValidation !== null) {
    throw new Error(providerValidation.safeMessage)
  }

  const fallbackValidation = validateAIProvider(fallbackProvider)
  if (fallbackValidation !== null) {
    throw new Error(fallbackValidation.safeMessage)
  }

  const toolResolver = createFinancialAIToolResolver({
    registry,
  })

  // Si el proveedor primario resuelve un toolId que no existe realmente en
  // el Tool Registry, esta capa falla cerrado (INVALID_INTENT_RESULT) en vez
  // de dejar que la activacion intente ejecutar una capacidad inexistente
  // (PB-IS-016.1).
  const capabilityAwareResolveIntent = provider.resolveIntent === undefined
    ? undefined
    : createCapabilityAwareIntentResolver({
        baseResolver: { resolve: provider.resolveIntent },
        toolRegistry: registry,
      }).resolve

  const activationEngine = createActivationEngineFromResolver({
    primaryProviderId: provider.metadata.providerId,
    fallbackProviderId: fallbackProvider.metadata.providerId,
    primaryIntentResolver: capabilityAwareResolveIntent,
    fallbackIntentResolver: fallbackProvider.resolveIntent,
    toolResolver,
    policy: {
      minimumConfidence: 0.7,
      enableFallback: true,
      enableAIExplanation: true,
      enableDirectTools: true,
    },
  })

  const financialSkillModule = createFinancialConversationSkillModule()
  const conversationMemory = createConversationMemory()
  const conversationContextResolver = createConversationContextResolver()
  const financialInsightEngine = createFinancialInsightEngine()
  const financialPlanningEngine = createFinancialPlanningEngine()
  // PB-IS-017.1: Goal Manager, Follow-up Engine, Recommendation Prioritizer,
  // Conversation Summary y sus runtime metrics -- todos en memoria, sin
  // acceso a Dexie ni a las Financial Tools (DA-0171-01, DA-0171-02).
  const conversationGoalModule = createConversationGoalModule()
  // PB-IS-017.2: el Coach compone el Recommendation Prioritizer ya
  // ensamblado por el modulo de Goals (DA-0172-04), no crea uno propio.
  const coachingModule = createCoachingModule({
    recommendationPrioritizer: conversationGoalModule.recommendationPrioritizer,
  })

  const conversationServiceDependencies = {
    facade,
    provider,
    fallbackProvider,
    confidencePolicy: {
      confidenceThreshold: 0.7,
    },
    activationEngine,
    skillResolver: financialSkillModule.resolver,
    conversationMemory,
    conversationContextResolver,
    financialInsightEngine,
    financialPlanningEngine,
    goalManager: conversationGoalModule.goalManager,
    followUpEngine: conversationGoalModule.followUpEngine,
    recommendationPrioritizer: conversationGoalModule.recommendationPrioritizer,
    summaryBuilder: conversationGoalModule.summaryBuilder,
    goalMetrics: conversationGoalModule.goalMetrics,
    opportunityDetector: coachingModule.opportunityDetector,
    nextBestActionGenerator: coachingModule.nextBestActionGenerator,
    coachingMetrics: coachingModule.coachingMetrics,
  } as AIConversationServiceDependencies & {
    readonly activationEngine: typeof activationEngine
    readonly skillResolver: typeof financialSkillModule.resolver
    readonly conversationMemory: typeof conversationMemory
    readonly conversationContextResolver: typeof conversationContextResolver
    readonly financialInsightEngine: typeof financialInsightEngine
    readonly financialPlanningEngine: typeof financialPlanningEngine
    readonly goalManager: typeof conversationGoalModule.goalManager
    readonly followUpEngine: typeof conversationGoalModule.followUpEngine
    readonly recommendationPrioritizer: typeof conversationGoalModule.recommendationPrioritizer
    readonly summaryBuilder: typeof conversationGoalModule.summaryBuilder
    readonly goalMetrics: typeof conversationGoalModule.goalMetrics
    readonly opportunityDetector: typeof coachingModule.opportunityDetector
    readonly nextBestActionGenerator: typeof coachingModule.nextBestActionGenerator
    readonly coachingMetrics: typeof coachingModule.coachingMetrics
  }

  const conversationService = createAIConversationService(conversationServiceDependencies)
  const localCopilot = createLocalFinancialCopilotQueryHandler()

  return {
    answerLocalQuery(message) {
      return localCopilot.answer(message)
    },
    async getAssistantContext() {
      const settings = await getSettings()
      return { defaultCurrency: settings.defaultCurrency, usageMode: settings.usageMode }
    },
    pipeline: {
      async generateAssistantMessage(input): Promise<
        | { readonly kind: 'success'; readonly message: ChatMessage }
        | { readonly kind: 'failure'; readonly code: string; readonly safeMessage: string }
      > {
        const requestedAt = new Date().toISOString()
        const fragment = createRequestFragment(requestedAt)
        const request = {
          protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
          executionId: `conversation-orchestration:conversation-page:${fragment}:${input.turn}` as AIConversationRequest['executionId'],
          context: {
            executionId: `execution:conversation-page:${fragment}:${input.turn}`,
            conversationId,
            sessionId,
            providerId: 'CONVERSATION_PAGE',
            model: 'provider-neutral',
            requestedAt,
            caller: 'SYSTEM',
          },
          steps: [
            {
              stepId: `step:${input.turn}`,
              order: 1,
              toolId: 'financial_balance',
              arguments: {},
            },
          ],
        } as AIConversationRequest

        const coordinated = await conversationService.processConversation({
          conversationRequest: request,
          userMessage: input.userMessage,
          turn: input.turn,
          requestedAt,
        })

        if (coordinated.kind === 'failure') {
          return {
            kind: 'failure',
            code: coordinated.code,
            safeMessage: coordinated.safeMessage,
          }
        }

        return {
          kind: 'success',
          message: coordinated.message,
        }
      },
    },
  }
}

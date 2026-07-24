import {
  createAIConversationFacade,
  type AIConversationRequest,
} from '../../intelligence/ai-conversation'
import {
  createAIToolRegistry,
} from '../../intelligence/ai-tools'
import {
  createFinancialAIToolResolver,
  registerFinancialToolsCatalog,
} from '../../intelligence/ai-tools/financial'
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

  const facade = createAIConversationFacade({
    orchestrator: createFinancialConversationOrchestrator({
      registry,
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

export function createConversationControllerDependencies(): ConversationControllerDependencies {
  const { facade, registry } = createConversationFacadeAndRegistry()
  const provider = createAIProvider()
  const fallbackProvider = createMockAIProvider()

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

  const activationEngine = createActivationEngineFromResolver({
    primaryProviderId: provider.metadata.providerId,
    fallbackProviderId: fallbackProvider.metadata.providerId,
    primaryIntentResolver: provider.resolveIntent,
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

  const conversationServiceDependencies = {
    facade,
    provider,
    fallbackProvider,
    confidencePolicy: {
      confidenceThreshold: 0.7,
    },
    activationEngine,
    skillResolver: financialSkillModule.resolver,
  } as AIConversationServiceDependencies & {
    readonly activationEngine: typeof activationEngine
    readonly skillResolver: typeof financialSkillModule.resolver
  }

  const conversationService = createAIConversationService(conversationServiceDependencies)

  return {
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
            conversationId: `conversation:main:${fragment}`,
            sessionId: `session:main:${fragment}`,
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

import {
  createAIConversationFacade,
  type AIConversationRequest,
} from '../../intelligence/ai-conversation'
import {
  createAIToolRegistry,
} from '../../intelligence/ai-tools'
import {
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
  createPromptContextBuilder,
} from '../../intelligence/prompt-context-builder'
import {
  createConversationResponseComposer,
} from '../../intelligence/response-composer'
import {
  createConfiguredAIConversationService,
} from '../../intelligence/ai-conversation/provider-orchestration/aiConversationFactory'
import type { ConversationControllerDependencies } from './conversationController'

function createRequestFragment(now: string): string {
  return now
    .replace(/[-.]/g, '')
    .replace(/T/g, ':')
    .replace(/Z/g, '')
    .toLowerCase()
}

function createConversationFacade() {
  const registry = createAIToolRegistry([])
  const registration = registerFinancialToolsCatalog(registry)
  if (registration.kind === 'failure') {
    throw new Error(registration.safeMessage)
  }

  const promptContextBuilder = createPromptContextBuilder()
  const responseComposer = createConversationResponseComposer()

  return createAIConversationFacade({
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
}

export function createConversationControllerDependencies(): ConversationControllerDependencies {
  const facade = createConversationFacade()
  const conversationService = createConfiguredAIConversationService({
    facade,
  })

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

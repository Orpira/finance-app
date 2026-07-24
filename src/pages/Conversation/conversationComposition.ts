import {
  createAIConversationFacade,
  type AIConversationRequest,
  validateAIConversationRequest,
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
  createAIProvider,
  validateAIProvider,
  validateAIProviderConversationGenerationResult,
  validateAIProviderIntentResolutionResult,
} from '../../intelligence/ai-provider/aiProvider'
import {
  createPromptContextBuilder,
} from '../../intelligence/prompt-context-builder'
import {
  createConversationResponseComposer,
} from '../../intelligence/response-composer'
import {
  INTENT_RESOLVER_PROTOCOL_VERSION,
} from '../../intelligence/intent-resolver/intentResolver'
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
  const provider = createAIProvider()
  const providerValidation = validateAIProvider(provider)
  if (providerValidation !== null) {
    throw new Error(providerValidation.safeMessage)
  }

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

        if (provider.resolveIntent === undefined) {
          return {
            kind: 'failure',
            code: 'INTENT_RESOLUTION_FAILED',
            safeMessage: 'El proveedor AI no implementa resolución de intención.',
          }
        }

        const resolutionResult = await provider.resolveIntent({
          protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
          conversationRequest: request,
          metadata: {
            userMessage: input.userMessage,
            turn: input.turn,
            requestedAt,
          },
        })

        const resolutionValidation = validateAIProviderIntentResolutionResult(resolutionResult)
        if (resolutionValidation !== null) {
          return {
            kind: 'failure',
            code: resolutionValidation.code,
            safeMessage: resolutionValidation.safeMessage,
          }
        }

        if (resolutionResult.kind === 'failure') {
          return {
            kind: 'failure',
            code: resolutionResult.code,
            safeMessage: resolutionResult.safeMessage,
          }
        }

        const requestFromResolution: AIConversationRequest = {
          ...request,
          steps: resolutionResult.resolution.tools.map((tool, index) => ({
            stepId: `step:${input.turn}:${index + 1}`,
            order: index + 1,
            toolId: tool.toolId,
            arguments: structuredClone(tool.arguments),
          })),
        }

        const requestValidation = validateAIConversationRequest(requestFromResolution)
        if (requestValidation !== null) {
          return {
            kind: 'failure',
            code: requestValidation.code,
            safeMessage: requestValidation.safeMessage,
          }
        }

        const execution = await facade.execute(requestFromResolution)
        if (execution.kind === 'failure') {
          return {
            kind: 'failure',
            code: execution.code,
            safeMessage: execution.safeMessage,
          }
        }

        if (provider.generateConversation === undefined) {
          return {
            kind: 'failure',
            code: 'CONVERSATION_GENERATION_FAILED',
            safeMessage: 'El proveedor AI no implementa generación conversacional.',
          }
        }

        const rendered = await provider.generateConversation(execution.response)
        const messageValidation = validateAIProviderConversationGenerationResult(rendered)
        if (messageValidation !== null) {
          return {
            kind: 'failure',
            code: messageValidation.code,
            safeMessage: messageValidation.safeMessage,
          }
        }

        if (rendered.kind === 'failure') {
          return {
            kind: 'failure',
            code: rendered.code,
            safeMessage: rendered.safeMessage,
          }
        }

        return rendered
      },
    },
  }
}

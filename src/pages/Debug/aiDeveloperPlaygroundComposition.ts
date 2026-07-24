import {
  createAIConversationFacade,
  type AIConversationFacade,
  type AIConversationRequest,
} from '../../intelligence/ai-conversation'
import {
  createAIToolRegistry,
  createPingTool,
} from '../../intelligence/ai-tools'
import {
  registerFinancialToolsCatalog,
} from '../../intelligence/ai-tools/financial'
import {
  createFinancialConversationOrchestrator,
} from '../../intelligence/conversation-orchestrator'
import {
  AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
} from '../../intelligence/conversation-orchestrator'
import { createPromptContextBuilder } from '../../intelligence/prompt-context-builder'
import { createConversationResponseComposer } from '../../intelligence/response-composer'
import {
  createMockConversationalRenderer,
  type MockConversationalRenderer,
} from '../../intelligence/mock-conversational-renderer/mockConversationalRenderer'
import {
  createAIDeveloperPlaygroundController,
  type AIDeveloperPlaygroundController,
} from './aiDeveloperPlaygroundController'

function normalizeExecutionFragment(now: Date): string {
  return now
    .toISOString()
    .replace(/[-.]/g, '')
    .replace(/T/g, ':')
    .replace(/Z/g, '')
    .toLowerCase()
}

export function createDefaultAIDeveloperPlaygroundRequest(
  now = new Date(),
): AIConversationRequest {
  const requestedAt = now.toISOString()
  const fragment = normalizeExecutionFragment(now)

  return {
    protocolVersion: AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION,
    executionId: `conversation-orchestration:playground:${fragment}` as AIConversationRequest['executionId'],
    context: {
      executionId: `execution:playground:${fragment}`,
      conversationId: `conversation:playground:${fragment}`,
      sessionId: `session:playground:${fragment}`,
      providerId: 'PLAYGROUND',
      model: 'provider-neutral',
      requestedAt,
      caller: 'SYSTEM',
    },
    steps: [
      {
        stepId: 'step-1',
        order: 1,
        toolId: 'ping',
        arguments: {},
      },
    ],
  }
}

function createAIDeveloperPlaygroundFacade(): AIConversationFacade {
  const registry = createAIToolRegistry([
    createPingTool(),
  ])

  const financialCatalogRegistration = registerFinancialToolsCatalog(registry)
  if (financialCatalogRegistration.kind === 'failure') {
    throw new Error(financialCatalogRegistration.safeMessage)
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

export interface AIDeveloperPlaygroundDependencies {
  readonly facade: AIConversationFacade
  readonly renderer: MockConversationalRenderer
  readonly controller: AIDeveloperPlaygroundController
}

export function createAIDeveloperPlaygroundDependencies(): AIDeveloperPlaygroundDependencies {
  const facade = createAIDeveloperPlaygroundFacade()
  const renderer = createMockConversationalRenderer()

  return {
    facade,
    renderer,
    controller: createAIDeveloperPlaygroundController({
      facade,
      renderer,
      createInitialDraft: () => createDefaultAIDeveloperPlaygroundRequest(),
    }),
  }
}

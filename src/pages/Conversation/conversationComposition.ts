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
  createMockConversationalRenderer,
  type ChatMessage,
  validateChatMessage,
} from '../../intelligence/mock-conversational-renderer/mockConversationalRenderer'
import {
  createPromptContextBuilder,
} from '../../intelligence/prompt-context-builder'
import {
  createConversationResponseComposer,
} from '../../intelligence/response-composer'
import type { ConversationControllerDependencies } from './conversationController'

function createRequestFragment(now: string): string {
  return now
    .replace(/[-.]/g, '')
    .replace(/T/g, ':')
    .replace(/Z/g, '')
    .toLowerCase()
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
}

function resolveToolPlan(message: string): {
  readonly toolId: string
  readonly arguments: Readonly<Record<string, unknown>>
} {
  const normalized = normalizeText(message)

  if (
    normalized.includes('transaccion')
    || normalized.includes('movimiento')
    || normalized.includes('ingreso')
    || normalized.includes('egreso')
    || normalized.includes('gasto')
  ) {
    return {
      toolId: 'financial_transactions',
      arguments: {},
    }
  }

  if (normalized.includes('presupuesto') || normalized.includes('budget')) {
    return {
      toolId: 'financial_budget',
      arguments: {},
    }
  }

  if (normalized.includes('objetivo') || normalized.includes('meta')) {
    return {
      toolId: 'financial_goals',
      arguments: {},
    }
  }

  if (normalized.includes('reporte') || normalized.includes('informe')) {
    return {
      toolId: 'financial_reports',
      arguments: {
        format: 'json',
      },
    }
  }

  if (
    normalized.includes('insight')
    || normalized.includes('resumen')
    || normalized.includes('tendencia')
  ) {
    return {
      toolId: 'financial_insights',
      arguments: {
        format: 'json',
      },
    }
  }

  return {
    toolId: 'financial_balance',
    arguments: {},
  }
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
  const renderer = createMockConversationalRenderer()

  return {
    pipeline: {
      async generateAssistantMessage(input): Promise<
        | { readonly kind: 'success'; readonly message: ChatMessage }
        | { readonly kind: 'failure'; readonly code: string; readonly safeMessage: string }
      > {
        const requestedAt = new Date().toISOString()
        const fragment = createRequestFragment(requestedAt)
        const plan = resolveToolPlan(input.userMessage)

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
              toolId: plan.toolId,
              arguments: plan.arguments,
            },
          ],
        } as AIConversationRequest

        const requestValidation = validateAIConversationRequest(request)
        if (requestValidation !== null) {
          return {
            kind: 'failure',
            code: requestValidation.code,
            safeMessage: requestValidation.safeMessage,
          }
        }

        const execution = await facade.execute(request)
        if (execution.kind === 'failure') {
          return {
            kind: 'failure',
            code: execution.code,
            safeMessage: execution.safeMessage,
          }
        }

        const rendered = renderer.render(execution.response)
        if (rendered.kind === 'failure') {
          return {
            kind: 'failure',
            code: rendered.code,
            safeMessage: rendered.safeMessage,
          }
        }

        const messageValidation = validateChatMessage(rendered.message)
        if (messageValidation !== null) {
          return {
            kind: 'failure',
            code: messageValidation.code,
            safeMessage: messageValidation.safeMessage,
          }
        }

        return rendered
      },
    },
  }
}

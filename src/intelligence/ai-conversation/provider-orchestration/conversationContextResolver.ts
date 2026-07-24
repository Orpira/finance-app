import type {
  AIToolJsonValue,
} from '../../ai-tools'
import type {
  ConversationContextResolver,
  ConversationMemorySnapshot,
} from './conversationMemoryContracts'
import {
  createConversationContextEnrichment,
} from './memory/contextEnrichment'

function cloneArguments(
  value: Readonly<Record<string, AIToolJsonValue>> | undefined,
): Readonly<Record<string, AIToolJsonValue>> | undefined {
  if (value === undefined) {
    return undefined
  }

  return structuredClone(value)
}

export function createConversationContextResolver(): ConversationContextResolver {
  return {
    enrich(input) {
      const currentArguments = cloneArguments(input.plan.activationDecision.toolArguments)
      const enrichment = createConversationContextEnrichment({
        sessionId: input.request.context.sessionId,
        userMessage: input.userMessage,
        snapshot: input.snapshot as ConversationMemorySnapshot | null,
        toolArguments: currentArguments,
      })

      return enrichment
    },
  }
}
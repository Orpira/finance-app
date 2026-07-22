import type { AIInteraction } from '../../ai-interaction/aiInteractionContracts'
import type { AIConversationMessage } from '../message'
import type { AIConversationSessionSnapshot } from '../session'

export interface AIConversationReplyProviderRequest {
  readonly interaction: AIInteraction
  readonly session: AIConversationSessionSnapshot
  readonly userMessage: AIConversationMessage
}

export interface AIConversationReplyProviderSuccess {
  readonly kind: 'success'
  readonly content: string
  readonly createdAt?: string
  readonly metadata?: {
    readonly correlationId?: string
    readonly tags?: readonly string[]
  }
}

export interface AIConversationReplyProviderFailure {
  readonly kind: 'failure'
  readonly safeMessage: string
}

export type AIConversationReplyProviderResult =
  | AIConversationReplyProviderSuccess
  | AIConversationReplyProviderFailure

export interface AIConversationReplyProvider {
  generateReply(
    request: AIConversationReplyProviderRequest,
  ): Promise<AIConversationReplyProviderResult>
}

export function createMockAIConversationReplyProvider(): AIConversationReplyProvider {
  return {
    async generateReply(request) {
      const prompt = request.userMessage.content.value.trim()

      return {
        kind: 'success',
        content: `Respuesta mock: ${prompt}`,
      }
    },
  }
}
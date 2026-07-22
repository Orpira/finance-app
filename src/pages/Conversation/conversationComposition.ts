import {
  createDefaultAIConversationApplicationService,
} from '../../application/ai-conversation'
import type { ConversationControllerDependencies } from './conversationController'

export function createConversationControllerDependencies(): ConversationControllerDependencies {
  return {
    service: createDefaultAIConversationApplicationService(),
  }
}

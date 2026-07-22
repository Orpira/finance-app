import { AIConversationSessionValidator } from '../../intelligence/ai-conversation/session'
import {
  AI_CONVERSATION_APPLICATION_STATES,
  type AIConversationApplicationFailure,
  type AIConversationApplicationSendRequest,
  type AIConversationApplicationState,
} from './aiConversationApplicationContracts'

function failure(
  code: AIConversationApplicationFailure['code'],
  safeMessage: string,
  retryable = false,
): AIConversationApplicationFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
  }
}

export function isAIConversationApplicationState(
  value: string,
): value is AIConversationApplicationState {
  return AI_CONVERSATION_APPLICATION_STATES.includes(
    value as AIConversationApplicationState,
  )
}

export function validateAIConversationApplicationSendRequest(
  input: AIConversationApplicationSendRequest,
): AIConversationApplicationFailure | null {
  if (input.session === null) {
    return failure(
      'CONVERSATION_NOT_FOUND',
      'No hay una conversacion activa para enviar mensajes.',
    )
  }

  const trimmedMessage = input.message.trim()
  if (trimmedMessage.length === 0) {
    return failure('INVALID_REQUEST', 'El mensaje no puede estar vacio.')
  }

  const validation = new AIConversationSessionValidator().validate(input.session)
  if (validation) {
    return failure('INVALID_CONVERSATION', 'La conversacion activa es invalida.')
  }

  if (input.cancellationSignal?.aborted === true) {
    return failure('SEND_MESSAGE_FAILED', 'La solicitud fue cancelada antes de enviarse.')
  }

  return null
}

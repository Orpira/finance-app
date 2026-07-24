import {
  validateConversationResponse,
  type ConversationResponse,
} from '../response-composer'
import {
  MOCK_CONVERSATIONAL_RENDERER_FAILURE_CODES,
  MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION,
  type ChatMessage,
  type MockConversationalRenderRule,
  type MockConversationalRendererFailure,
  type MockConversationalRendererResult,
} from './mockConversationalRendererContracts'

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function createFailure(
  code: MockConversationalRendererFailure['code'],
  safeMessage: string,
): MockConversationalRendererFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeToolId(value: string): string {
  return value.trim().toLowerCase()
}

export function validateMockConversationalRenderRules(
  rules: readonly MockConversationalRenderRule[],
): MockConversationalRendererFailure | null {
  if (!Array.isArray(rules) || rules.length === 0) {
    return createFailure('INVALID_RENDER_RULES', 'The mock renderer rules must include at least one rule.')
  }

  const seenRuleIds = new Set<string>()
  const seenToolIds = new Set<string>()

  for (const rule of rules) {
    if (!isNonEmpty(rule.ruleId)) {
      return createFailure('INVALID_RENDER_RULES', 'Each mock renderer rule must include a valid rule id.')
    }

    if (seenRuleIds.has(rule.ruleId)) {
      return createFailure('INVALID_RENDER_RULES', `The mock renderer rule id '${rule.ruleId}' is duplicated.`)
    }

    seenRuleIds.add(rule.ruleId)

    if (!Array.isArray(rule.toolIds) || rule.toolIds.length === 0) {
      return createFailure('INVALID_RENDER_RULES', `The mock renderer rule '${rule.ruleId}' must declare at least one tool id.`)
    }

    for (const toolId of rule.toolIds) {
      if (!isNonEmpty(toolId)) {
        return createFailure('INVALID_RENDER_RULES', `The mock renderer rule '${rule.ruleId}' contains an invalid tool id.`)
      }

      const key = normalizeToolId(toolId)
      if (seenToolIds.has(key)) {
        return createFailure('INVALID_RENDER_RULES', `The tool id '${toolId}' is declared by multiple mock renderer rules.`)
      }
      seenToolIds.add(key)
    }

    if (typeof rule.render !== 'function') {
      return createFailure('INVALID_RENDER_RULES', `The mock renderer rule '${rule.ruleId}' must expose a render function.`)
    }
  }

  return null
}

export function validateChatMessage(message: ChatMessage): MockConversationalRendererFailure | null {
  if (message.protocolVersion !== MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION) {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message protocol version is invalid.')
  }

  if (!isNonEmpty(message.messageId)) {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message identifier is invalid.')
  }

  if (message.type !== 'assistant' && message.type !== 'error') {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message type is invalid.')
  }

  if (message.origin !== 'MOCK_RENDERER') {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message origin is invalid.')
  }

  if (!isNonEmpty(message.timestamp) || !UTC_INSTANT_PATTERN.test(message.timestamp)) {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message timestamp is invalid.')
  }

  if (!isNonEmpty(message.text)) {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message text is invalid.')
  }

  if (message.responseId !== message.conversationResponse.responseId) {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message response identifier is inconsistent.')
  }

  if (message.traceability.executionId !== message.conversationResponse.execution.executionId) {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message execution traceability is inconsistent.')
  }

  if (message.traceability.promptContextId !== message.conversationResponse.execution.promptContextId) {
    return createFailure('INVALID_CHAT_MESSAGE', 'The chat message prompt context traceability is inconsistent.')
  }

  const responseValidation = validateConversationResponse(message.conversationResponse)
  if (responseValidation) {
    return createFailure('INVALID_CHAT_MESSAGE', responseValidation.safeMessage)
  }

  return null
}

export function validateMockConversationResponse(
  response: ConversationResponse,
): MockConversationalRendererFailure | null {
  const validation = validateConversationResponse(response)
  if (validation) {
    return createFailure('INVALID_CHAT_MESSAGE', validation.safeMessage)
  }

  return null
}

export function validateMockConversationalRendererResult(
  result: MockConversationalRendererResult,
): MockConversationalRendererFailure | null {
  if (result.kind === 'failure') {
    if (!MOCK_CONVERSATIONAL_RENDERER_FAILURE_CODES.includes(result.code)) {
      return createFailure('INVALID_CHAT_MESSAGE', 'The mock renderer failure code is invalid.')
    }

    return null
  }

  return validateChatMessage(result.message)
}

export const AI_CONVERSATION_SESSION_EVENTS = [
  'ACTIVATE',
  'PAUSE',
  'RESUME',
  'COMPLETE',
  'CANCEL',
] as const

export type AIConversationSessionEvent =
  (typeof AI_CONVERSATION_SESSION_EVENTS)[number]

const eventSet = new Set<string>(AI_CONVERSATION_SESSION_EVENTS)

export function isAIConversationSessionEvent(
  value: string,
): value is AIConversationSessionEvent {
  return eventSet.has(value)
}

export const AI_CONVERSATION_SESSION_STATUSES = [
  'CREATED',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
] as const

export type AIConversationSessionStatus =
  (typeof AI_CONVERSATION_SESSION_STATUSES)[number]

export const AI_CONVERSATION_SESSION_FINAL_STATUSES = [
  'COMPLETED',
  'CANCELLED',
] as const

export type AIConversationSessionFinalStatus =
  (typeof AI_CONVERSATION_SESSION_FINAL_STATUSES)[number]

const statusSet = new Set<string>(AI_CONVERSATION_SESSION_STATUSES)
const finalStatusSet = new Set<string>(AI_CONVERSATION_SESSION_FINAL_STATUSES)

export function isAIConversationSessionStatus(
  value: string,
): value is AIConversationSessionStatus {
  return statusSet.has(value)
}

export function isFinalAIConversationSessionStatus(
  value: string,
): value is AIConversationSessionFinalStatus {
  return finalStatusSet.has(value)
}

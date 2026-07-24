import type {
  AIToolJsonValue,
} from '../../ai-tools'
import {
  CONVERSATION_MEMORY_PROTOCOL_VERSION,
  type ConversationMemoryEntityReference,
  type ConversationMemorySnapshot,
} from './conversationMemoryContracts'

function cloneJsonRecord(
  value: Readonly<Record<string, AIToolJsonValue>> | null | undefined,
): Readonly<Record<string, AIToolJsonValue>> | null {
  if (value === undefined || value === null) {
    return null
  }

  return structuredClone(value)
}

function cloneEntities(
  entities: readonly ConversationMemoryEntityReference[] | undefined,
): readonly ConversationMemoryEntityReference[] {
  if (entities === undefined) {
    return []
  }

  return entities.map((entity) => ({ ...entity }))
}

export function createConversationMemorySnapshot(input: {
  readonly sessionId: string
  readonly conversationTimestamp: string
  readonly lastIntent?: string | null
  readonly lastSkill?: string | null
  readonly lastTool?: string | null
  readonly lastPeriod?: Readonly<Record<string, AIToolJsonValue>> | null
  readonly lastCategory?: string | null
  readonly lastAccount?: string | null
  readonly lastGoal?: string | null
  readonly referencedEntities?: readonly ConversationMemoryEntityReference[]
}): ConversationMemorySnapshot {
  return {
    protocolVersion: CONVERSATION_MEMORY_PROTOCOL_VERSION,
    sessionId: input.sessionId,
    lastIntent: input.lastIntent ?? null,
    lastSkill: input.lastSkill ?? null,
    lastTool: input.lastTool ?? null,
    lastPeriod: cloneJsonRecord(input.lastPeriod),
    lastCategory: input.lastCategory ?? null,
    lastAccount: input.lastAccount ?? null,
    lastGoal: input.lastGoal ?? null,
    referencedEntities: cloneEntities(input.referencedEntities),
    conversationTimestamp: input.conversationTimestamp,
  }
}
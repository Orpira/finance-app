import type {
  AIToolJsonValue,
} from '../../ai-tools'
import {
  CONVERSATION_MEMORY_PROTOCOL_VERSION,
  type ConversationContextResolver,
  type ConversationMemorySnapshot,
  type ConversationMemoryStore,
} from './conversationMemoryContracts'

export interface ConversationMemoryValidationFailure {
  readonly kind: 'failure'
  readonly code:
    | 'INVALID_MEMORY_SNAPSHOT'
    | 'INVALID_MEMORY_STORE'
    | 'INVALID_CONTEXT_RESOLVER'
  readonly retryable: false
  readonly safeMessage: string
}

function createFailure(
  code: ConversationMemoryValidationFailure['code'],
  safeMessage: string,
): ConversationMemoryValidationFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isJsonValue(value: unknown): value is AIToolJsonValue {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return true
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item))
  }

  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((item) => isJsonValue(item))
  }

  return false
}

function isJsonRecord(value: unknown): value is Readonly<Record<string, AIToolJsonValue>> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every((item) => isJsonValue(item))
}

export function validateConversationMemorySnapshot(
  snapshot: ConversationMemorySnapshot,
): ConversationMemoryValidationFailure | null {
  if (
    snapshot.protocolVersion !== CONVERSATION_MEMORY_PROTOCOL_VERSION
    || !isNonEmptyString(snapshot.sessionId)
    || !isNonEmptyString(snapshot.conversationTimestamp)
    || (snapshot.lastIntent !== null && !isNonEmptyString(snapshot.lastIntent))
    || (snapshot.lastSkill !== null && !isNonEmptyString(snapshot.lastSkill))
    || (snapshot.lastTool !== null && !isNonEmptyString(snapshot.lastTool))
    || (snapshot.lastPeriod !== null && !isJsonRecord(snapshot.lastPeriod))
    || (snapshot.lastCategory !== null && !isNonEmptyString(snapshot.lastCategory))
    || (snapshot.lastAccount !== null && !isNonEmptyString(snapshot.lastAccount))
    || (snapshot.lastGoal !== null && !isNonEmptyString(snapshot.lastGoal))
    || !Array.isArray(snapshot.referencedEntities)
  ) {
    return createFailure('INVALID_MEMORY_SNAPSHOT', 'The conversation memory snapshot is invalid.')
  }

  for (const entity of snapshot.referencedEntities) {
    if (
      typeof entity !== 'object'
      || entity === null
      || !isNonEmptyString(entity.entityType)
      || (entity.entityId !== undefined && !isNonEmptyString(entity.entityId))
      || (entity.entityLabel !== undefined && !isNonEmptyString(entity.entityLabel))
    ) {
      return createFailure('INVALID_MEMORY_SNAPSHOT', 'The conversation memory snapshot contains an invalid referenced entity.')
    }
  }

  return null
}

export function validateConversationMemoryStore(
  store: ConversationMemoryStore,
): ConversationMemoryValidationFailure | null {
  if (
    typeof store.getSnapshot !== 'function'
    || typeof store.saveSnapshot !== 'function'
    || typeof store.updateContext !== 'function'
    || typeof store.clearSession !== 'function'
  ) {
    return createFailure('INVALID_MEMORY_STORE', 'The conversation memory store contract is invalid.')
  }

  return null
}

export function validateConversationContextResolver(
  resolver: ConversationContextResolver,
): ConversationMemoryValidationFailure | null {
  if (typeof resolver.enrich !== 'function') {
    return createFailure('INVALID_CONTEXT_RESOLVER', 'The conversation context resolver contract is invalid.')
  }

  return null
}
import {
  createConversationMemorySnapshot,
} from './conversationMemorySnapshot'
import type {
  AIToolJsonValue,
} from '../../ai-tools'
import type {
  ConversationMemory,
  ConversationMemoryRememberInput,
  ConversationMemorySnapshot,
  ConversationMemoryStore,
} from './conversationMemoryContracts'
import {
  detectReferencedEntities,
} from './memory/contextEnrichment'

function coerceString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
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

function readFilters(input: ConversationMemoryRememberInput): Readonly<Record<string, unknown>> | null {
  const toolArguments = input.plan.activationDecision.toolArguments
  if (toolArguments === undefined) {
    return null
  }

  const filters = toolArguments.filters
  return typeof filters === 'object' && filters !== null && !Array.isArray(filters)
    ? (filters as Readonly<Record<string, unknown>>)
    : null
}

function nextSnapshot(
  current: ConversationMemorySnapshot | null,
  input: ConversationMemoryRememberInput,
): ConversationMemorySnapshot {
  const filters = readFilters(input)
  const period = (
    input.plan.context?.activePeriod
    ?? (isJsonRecord(filters?.period)
      ? structuredClone(filters.period)
      : null)
  )

  const category = input.plan.context?.activeCategory
    ?? coerceString(filters?.query)
    ?? current?.lastCategory
    ?? null

  const account = input.plan.context?.activeAccount
    ?? (Array.isArray(filters?.tags) && typeof filters.tags[0] === 'string' ? filters.tags[0] : null)
    ?? current?.lastAccount
    ?? null

  const goal = input.plan.context?.activeGoal
    ?? (Array.isArray(filters?.goalIds) && typeof filters.goalIds[0] === 'string' ? filters.goalIds[0] : null)
    ?? current?.lastGoal
    ?? null

  const referencedEntities = input.plan.context?.referencedEntities
    ?? detectReferencedEntities({
      userMessage: input.userMessage,
      currentTool: input.plan.activationDecision.toolId,
      currentGoal: goal,
      currentCategory: category,
      currentAccount: account,
    })

  return createConversationMemorySnapshot({
    sessionId: input.sessionId,
    conversationTimestamp: input.requestedAt,
    lastIntent: input.plan.activationDecision.intent,
    lastSkill: input.plan.skillId,
    lastTool: input.plan.activationDecision.toolId,
    lastPeriod: period,
    lastCategory: category,
    lastAccount: account,
    lastGoal: goal,
    referencedEntities,
  })
}

export function createConversationMemory(input: {
  readonly store: ConversationMemoryStore
}): ConversationMemory {
  return {
    getSnapshot(sessionId, now) {
      return input.store.getSnapshot(sessionId, now)
    },
    remember(rememberInput) {
      return input.store.updateContext(rememberInput.sessionId, (current) => nextSnapshot(current, rememberInput))
    },
    clearSession(sessionId) {
      input.store.clearSession(sessionId)
    },
  }
}
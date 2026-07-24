import type {
  AIToolJsonValue,
} from '../../../ai-tools'
import type {
  ConversationContextEnrichment,
  ConversationMemoryEntityReference,
  ConversationMemorySnapshot,
} from '../conversationMemoryContracts'

const REFERENCE_TOKENS = ['eso', 'esa', 'ese', 'aquello', 'anterior', 'anterior reporte'] as const
const CONTINUATION_TOKENS = ['compáralo', 'comparalo', 'continúa', 'continua', 'ahora', 'también', 'tambien', 'además', 'ademas'] as const
const PERIOD_TOKENS = ['hoy', 'ayer', 'esta semana', 'este mes', 'mes pasado'] as const
const ENTITY_TOKENS = ['presupuesto', 'meta', 'cuenta', 'categoría', 'categoria', 'gasto', 'ingreso'] as const

function includesAny(message: string, tokens: readonly string[]): string[] {
  return tokens.filter((token) => message.includes(token))
}

function mergeFilters(
  current: Readonly<Record<string, AIToolJsonValue>> | undefined,
  patch: Readonly<Record<string, AIToolJsonValue>>,
): Readonly<Record<string, AIToolJsonValue>> {
  const base = current === undefined ? {} : structuredClone(current)
  const baseFilters = (
    typeof base.filters === 'object'
    && base.filters !== null
    && !Array.isArray(base.filters)
  )
    ? structuredClone(base.filters as Record<string, AIToolJsonValue>)
    : undefined
  const patchFilters = (
    typeof patch.filters === 'object'
    && patch.filters !== null
    && !Array.isArray(patch.filters)
  )
    ? structuredClone(patch.filters as Record<string, AIToolJsonValue>)
    : undefined

  return {
    ...base,
    ...structuredClone(patch),
    ...((baseFilters === undefined && patchFilters === undefined)
      ? {}
      : {
          filters: {
            ...(baseFilters ?? {}),
            ...(patchFilters ?? {}),
          },
        }),
  }
}

function buildPeriodPatch(
  snapshot: ConversationMemorySnapshot | null,
  message: string,
): Readonly<Record<string, AIToolJsonValue>> | null {
  if (snapshot?.lastPeriod === null || snapshot?.lastPeriod === undefined) {
    return null
  }

  const hasReference = includesAny(message, [...REFERENCE_TOKENS, ...CONTINUATION_TOKENS, ...PERIOD_TOKENS]).length > 0
  if (!hasReference) {
    return null
  }

  return {
    filters: {
      period: structuredClone(snapshot.lastPeriod),
    },
  }
}

function buildEntityPatch(
  snapshot: ConversationMemorySnapshot | null,
  message: string,
): Readonly<Record<string, AIToolJsonValue>> | null {
  if (snapshot === null) {
    return null
  }

  const normalized = message.toLowerCase()
  const referenced = includesAny(normalized, ENTITY_TOKENS)
  const hasReferencePronoun = includesAny(normalized, REFERENCE_TOKENS).length > 0

  if (referenced.length === 0 && !hasReferencePronoun) {
    return null
  }

  const filters: Record<string, AIToolJsonValue> = {}

  if ((referenced.includes('meta') || hasReferencePronoun) && snapshot.lastGoal !== null) {
    filters.goalIds = [snapshot.lastGoal]
  }

  if ((referenced.includes('categoría') || referenced.includes('categoria') || referenced.includes('gasto') || referenced.includes('ingreso') || hasReferencePronoun) && snapshot.lastCategory !== null) {
    filters.query = snapshot.lastCategory
  }

  if ((referenced.includes('cuenta') || hasReferencePronoun) && snapshot.lastAccount !== null) {
    filters.tags = [snapshot.lastAccount]
  }

  return Object.keys(filters).length === 0
    ? null
    : { filters }
}

export function detectReferencedEntities(input: {
  readonly userMessage: string
  readonly currentTool: string | null
  readonly currentGoal: string | null
  readonly currentCategory: string | null
  readonly currentAccount: string | null
}): readonly ConversationMemoryEntityReference[] {
  const normalized = input.userMessage.toLowerCase()
  const entities: ConversationMemoryEntityReference[] = []

  if (includesAny(normalized, ['meta']).length > 0 || input.currentGoal !== null) {
    entities.push({
      entityType: 'goal',
      ...(input.currentGoal === null ? {} : { entityId: input.currentGoal, entityLabel: input.currentGoal }),
    })
  }

  if (includesAny(normalized, ['cuenta']).length > 0 || input.currentAccount !== null) {
    entities.push({
      entityType: 'account',
      ...(input.currentAccount === null ? {} : { entityId: input.currentAccount, entityLabel: input.currentAccount }),
    })
  }

  if (includesAny(normalized, ['categoría', 'categoria', 'gasto', 'ingreso', 'presupuesto']).length > 0 || input.currentCategory !== null) {
    entities.push({
      entityType: input.currentTool === 'financial_budget' ? 'budget' : 'category',
      ...(input.currentCategory === null ? {} : { entityId: input.currentCategory, entityLabel: input.currentCategory }),
    })
  }

  return entities
}

export function createConversationContextEnrichment(input: {
  readonly sessionId: string
  readonly userMessage: string
  readonly snapshot: ConversationMemorySnapshot | null
  readonly toolArguments: Readonly<Record<string, AIToolJsonValue>> | undefined
}): ConversationContextEnrichment {
  const normalized = input.userMessage.toLowerCase()
  const referencesResolved = includesAny(normalized, REFERENCE_TOKENS)
  const periodTerms = includesAny(normalized, PERIOD_TOKENS)
  const continuationTerms = includesAny(normalized, CONTINUATION_TOKENS)
  const entityTerms = includesAny(normalized, ENTITY_TOKENS)

  let patch: Readonly<Record<string, AIToolJsonValue>> | null = null
  const periodPatch = buildPeriodPatch(input.snapshot, normalized)
  const entityPatch = buildEntityPatch(input.snapshot, normalized)

  if (periodPatch !== null) {
    patch = mergeFilters(patch ?? input.toolArguments, periodPatch)
  }

  if (entityPatch !== null) {
    patch = mergeFilters(patch ?? input.toolArguments, entityPatch)
  }

  return {
    sessionId: input.sessionId,
    appliedSnapshot: input.snapshot === null ? null : structuredClone(input.snapshot),
    referencesResolved,
    periodResolved: periodPatch !== null || periodTerms.length > 0,
    entitiesResolved: entityTerms,
    continuationDetected: continuationTerms.length > 0,
    toolArgumentsPatch: patch === null ? null : structuredClone(patch),
  }
}
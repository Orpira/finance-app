import type {
  AIToolJsonValue,
} from '../../ai-tools'

export const CONVERSATION_MEMORY_PROTOCOL_VERSION = 1 as const

export interface ConversationMemoryEntityReference {
  readonly entityType: string
  readonly entityId?: string
  readonly entityLabel?: string
}

export interface ConversationMemorySnapshot {
  readonly protocolVersion: typeof CONVERSATION_MEMORY_PROTOCOL_VERSION
  readonly sessionId: string
  readonly lastIntent: string | null
  readonly lastSkill: string | null
  readonly lastTool: string | null
  readonly lastPeriod: Readonly<Record<string, AIToolJsonValue>> | null
  readonly lastCategory: string | null
  readonly lastAccount: string | null
  readonly lastGoal: string | null
  readonly referencedEntities: readonly ConversationMemoryEntityReference[]
  readonly conversationTimestamp: string
}

export interface ConversationMemoryStore {
  getSnapshot(sessionId: string, now?: string): ConversationMemorySnapshot | null
  saveSnapshot(snapshot: ConversationMemorySnapshot): ConversationMemorySnapshot
  updateContext(sessionId: string, updater: (current: ConversationMemorySnapshot | null) => ConversationMemorySnapshot): ConversationMemorySnapshot
  clearSession(sessionId: string): void
}

export interface ConversationMemory {
  getSnapshot(sessionId: string, now?: string): ConversationMemorySnapshot | null
  remember(input: ConversationMemoryRememberInput): ConversationMemorySnapshot
  clearSession(sessionId: string): void
}

export interface ConversationMemoryRememberInput {
  readonly sessionId: string
  readonly userMessage: string
  readonly requestedAt: string
  readonly plan: {
    readonly skillId: string
    readonly activationDecision: {
      readonly intent: string
      readonly toolId: string | null
      readonly toolArguments?: Readonly<Record<string, AIToolJsonValue>>
    }
    readonly context?: {
      readonly activePeriod?: Readonly<Record<string, AIToolJsonValue>>
      readonly activeCategory?: string | null
      readonly activeAccount?: string | null
      readonly activeGoal?: string | null
      readonly referencedEntities?: readonly ConversationMemoryEntityReference[]
    }
  }
}

export interface ConversationContextEnrichment {
  readonly sessionId: string
  readonly appliedSnapshot: ConversationMemorySnapshot | null
  readonly referencesResolved: readonly string[]
  readonly periodResolved: boolean
  readonly entitiesResolved: readonly string[]
  readonly continuationDetected: boolean
  readonly toolArgumentsPatch: Readonly<Record<string, AIToolJsonValue>> | null
}

export interface ConversationContextResolver {
  enrich(input: {
    readonly request: {
      readonly context: {
        readonly sessionId: string
      }
    }
    readonly userMessage: string
    readonly plan: {
      readonly skillId: string
      readonly activationDecision: {
        readonly toolId: string | null
        readonly toolArguments?: Readonly<Record<string, AIToolJsonValue>>
      }
      readonly requiredTools: readonly string[]
      readonly context?: {
        readonly activePeriod?: Readonly<Record<string, AIToolJsonValue>>
        readonly activeCategory?: string | null
        readonly activeAccount?: string | null
        readonly activeGoal?: string | null
        readonly referencedEntities?: readonly ConversationMemoryEntityReference[]
      }
    }
    readonly snapshot: ConversationMemorySnapshot | null
  }): ConversationContextEnrichment
}
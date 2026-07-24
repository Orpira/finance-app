import type {
  ConversationMemorySnapshot,
  ConversationMemoryStore,
} from './conversationMemoryContracts'

export interface ConversationMemoryStorePolicy {
  readonly expirationWindowMs: number
}

export function isConversationMemorySnapshotExpired(
  snapshot: ConversationMemorySnapshot,
  now: string,
  policy: ConversationMemoryStorePolicy,
): boolean {
  const snapshotTime = Date.parse(snapshot.conversationTimestamp)
  const nowTime = Date.parse(now)

  if (!Number.isFinite(snapshotTime) || !Number.isFinite(nowTime)) {
    return true
  }

  return nowTime - snapshotTime > policy.expirationWindowMs
}

export function createConversationMemoryStoreFacade(input: {
  readonly store: ConversationMemoryStore
  readonly policy: ConversationMemoryStorePolicy
}): ConversationMemoryStore {
  return {
    getSnapshot(sessionId, now) {
      const snapshot = input.store.getSnapshot(sessionId, now)
      if (snapshot === null || now === undefined) {
        return snapshot
      }

      if (isConversationMemorySnapshotExpired(snapshot, now, input.policy)) {
        input.store.clearSession(sessionId)
        return null
      }

      return snapshot
    },
    saveSnapshot(snapshot) {
      return input.store.saveSnapshot(snapshot)
    },
    updateContext(sessionId, updater) {
      return input.store.updateContext(sessionId, updater)
    },
    clearSession(sessionId) {
      input.store.clearSession(sessionId)
    },
  }
}
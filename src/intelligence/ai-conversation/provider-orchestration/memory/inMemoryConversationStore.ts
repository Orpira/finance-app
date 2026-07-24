import type {
  ConversationMemorySnapshot,
  ConversationMemoryStore,
} from '../conversationMemoryContracts'

export function createInMemoryConversationStore(): ConversationMemoryStore {
  const snapshots = new Map<string, ConversationMemorySnapshot>()

  return {
    getSnapshot(sessionId) {
      const snapshot = snapshots.get(sessionId)
      return snapshot === undefined ? null : structuredClone(snapshot)
    },
    saveSnapshot(snapshot) {
      const cloned = structuredClone(snapshot)
      snapshots.set(snapshot.sessionId, cloned)
      return structuredClone(cloned)
    },
    updateContext(sessionId, updater) {
      const current = snapshots.get(sessionId)
      const next = updater(current === undefined ? null : structuredClone(current))
      const cloned = structuredClone(next)
      snapshots.set(sessionId, cloned)
      return structuredClone(cloned)
    },
    clearSession(sessionId) {
      snapshots.delete(sessionId)
    },
  }
}
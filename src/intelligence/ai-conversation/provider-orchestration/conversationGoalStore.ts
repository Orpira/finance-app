import type { ConversationGoal } from './conversationGoalContracts'

export interface ConversationGoalStore {
  get(sessionId: string): ConversationGoal | null
  set(goal: ConversationGoal): ConversationGoal
  clearSession(sessionId: string): void
}

const DEFAULT_EXPIRATION_WINDOW_MS = 30 * 60 * 1000

/**
 * Almacen del Goal conversacional exclusivamente en memoria del proceso,
 * jamas en Dexie/IndexedDB (DA-0171-02, seccion 12). Mismo patron que
 * `memory/inMemoryConversationStore.ts` (Map por sessionId + expiracion),
 * implementado aqui de forma independiente para no modificar los archivos
 * de Conversation Memory (PB-IS-015.2), fuera del alcance permitido por
 * esta especificacion (seccion 17).
 */
export function createInMemoryConversationGoalStore(
  input: { readonly expirationWindowMs?: number; readonly now?: () => number } = {},
): ConversationGoalStore {
  const expirationWindowMs = input.expirationWindowMs ?? DEFAULT_EXPIRATION_WINDOW_MS
  const now = input.now ?? (() => Date.now())
  const goals = new Map<string, ConversationGoal>()

  function isExpired(goal: ConversationGoal): boolean {
    const updatedAtMs = new Date(goal.updatedAt).getTime()
    if (!Number.isFinite(updatedAtMs)) {
      return false
    }
    return now() - updatedAtMs > expirationWindowMs
  }

  return {
    get(sessionId) {
      const goal = goals.get(sessionId)
      if (goal === undefined) {
        return null
      }
      if (isExpired(goal)) {
        goals.delete(sessionId)
        return null
      }
      return structuredClone(goal)
    },
    set(goal) {
      const cloned = structuredClone(goal)
      goals.set(goal.sessionId, cloned)
      return structuredClone(cloned)
    },
    clearSession(sessionId) {
      goals.delete(sessionId)
    },
  }
}

export interface CoachingRecommendationHistory {
  /** Ids ya mostrados como Next Best Action en esta sesion, mas reciente primero. */
  getShownOpportunityIds(sessionId: string): readonly string[]
  recordShown(sessionId: string, opportunityId: string): void
  clearSession(sessionId: string): void
}

const DEFAULT_EXPIRATION_WINDOW_MS = 30 * 60 * 1000
const MAX_HISTORY_PER_SESSION = 20

interface HistoryEntry {
  readonly opportunityIds: readonly string[]
  readonly updatedAtMs: number
}

/**
 * Historial de recomendaciones (seccion 11) exclusivamente en memoria del
 * proceso -- nunca en Dexie/IndexedDB, igual que el Goal de PB-IS-017.1.
 * Se usa unicamente para evitar repetir continuamente la misma
 * recomendacion, nunca para registrar el texto de la conversacion.
 */
export function createInMemoryCoachingRecommendationHistory(
  input: { readonly expirationWindowMs?: number; readonly now?: () => number } = {},
): CoachingRecommendationHistory {
  const expirationWindowMs = input.expirationWindowMs ?? DEFAULT_EXPIRATION_WINDOW_MS
  const now = input.now ?? (() => Date.now())
  const sessions = new Map<string, HistoryEntry>()

  function readEntry(sessionId: string): HistoryEntry | null {
    const entry = sessions.get(sessionId)
    if (entry === undefined) {
      return null
    }
    if (now() - entry.updatedAtMs > expirationWindowMs) {
      sessions.delete(sessionId)
      return null
    }
    return entry
  }

  return {
    getShownOpportunityIds(sessionId) {
      return readEntry(sessionId)?.opportunityIds ?? []
    },
    recordShown(sessionId, opportunityId) {
      const existing = readEntry(sessionId)?.opportunityIds ?? []
      const next = [opportunityId, ...existing.filter((id) => id !== opportunityId)].slice(0, MAX_HISTORY_PER_SESSION)
      sessions.set(sessionId, { opportunityIds: next, updatedAtMs: now() })
    },
    clearSession(sessionId) {
      sessions.delete(sessionId)
    },
  }
}

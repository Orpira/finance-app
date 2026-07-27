export interface ConversationGoalMetricsEntry {
  readonly timestamp: string
  readonly sessionId: string
  readonly goalCreated: boolean
  readonly goalUpdated: boolean
  readonly followUpAsked: boolean
  readonly recommendationUsed: boolean
  readonly planningConsulted: boolean
  readonly insightsConsulted: boolean
}

export interface ConversationGoalMetricsRecorder {
  record(entry: ConversationGoalMetricsEntry): void
}

/**
 * Runtime metrics de la seccion 16: solo metadata tecnica agregable (goals
 * creados/actualizados, follow-ups, recomendaciones/insights/planning
 * consultados), nunca el texto de la conversacion ni el mensaje del usuario.
 * Solo se emite en DEV, igual que el resto de la observabilidad ya
 * existente en `aiConversationService.ts` (PB-IS-016.2 seccion 14).
 */
export function createConversationGoalMetricsRecorder(): ConversationGoalMetricsRecorder {
  return {
    record(entry) {
      if (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) {
        console.debug('[financial-copilot] conversation-goal-metrics', entry)
      }
    },
  }
}

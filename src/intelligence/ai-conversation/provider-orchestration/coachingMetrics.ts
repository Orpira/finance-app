export interface CoachingMetricsEntry {
  readonly timestamp: string
  readonly sessionId: string
  readonly opportunitiesDetected: number
  readonly recommendationEmitted: boolean
  /**
   * No existe todavia una interaccion de UI para aceptar/descartar una
   * Next Best Action (el chat no tiene botones de accion) -- estos campos
   * quedan registrados en el contrato tal como pide la seccion 14, pero se
   * emiten siempre en `false` hasta que exista esa señal real de UI. No se
   * inventa una fuente de datos que no existe (DA-0172-02).
   */
  readonly actionAccepted: boolean
  readonly actionDiscarded: boolean
  readonly followUpAsked: boolean
}

export interface CoachingMetricsRecorder {
  record(entry: CoachingMetricsEntry): void
}

/**
 * Runtime metrics de la seccion 14: solo metadata tecnica agregable, nunca
 * el texto de la conversacion. Mismo criterio que
 * `conversationGoalMetrics.ts` de PB-IS-017.1: solo se emite en DEV.
 */
export function createCoachingMetricsRecorder(): CoachingMetricsRecorder {
  return {
    record(entry) {
      if (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) {
        console.debug('[financial-copilot] coaching-metrics', entry)
      }
    },
  }
}

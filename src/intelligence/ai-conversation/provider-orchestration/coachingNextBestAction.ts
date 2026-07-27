import type { CoachingOpportunity, NextBestAction } from './coachingContracts'
import type { CoachingRecommendationHistory } from './coachingRecommendationHistory'

export interface NextBestActionGenerator {
  /**
   * Selecciona la unica accion prioritaria a partir de las oportunidades ya
   * ordenadas por el Opportunity Detector (DA-0172-03: solo una por
   * respuesta). Evita repetir continuamente la misma oportunidad (seccion
   * 11): si la de mayor rango ya se mostro en esta sesion, se pasa a la
   * siguiente no mostrada; si todas ya se mostraron, se vuelve a la de
   * mayor rango en vez de no responder nada.
   */
  selectNextBestAction(input: {
    readonly sessionId: string
    readonly opportunities: readonly CoachingOpportunity[]
  }): NextBestAction | null
}

export function createNextBestActionGenerator(
  input: { readonly history: CoachingRecommendationHistory },
): NextBestActionGenerator {
  return {
    selectNextBestAction({ sessionId, opportunities }) {
      if (opportunities.length === 0) {
        return null
      }

      const shownIds = new Set(input.history.getShownOpportunityIds(sessionId))
      const unseen = opportunities.find((opportunity) => !shownIds.has(opportunity.opportunityId))
      const selected = unseen ?? opportunities[0]

      input.history.recordShown(sessionId, selected.opportunityId)

      return {
        opportunityId: selected.opportunityId,
        type: selected.type,
        // Texto derivado unicamente de datos ya certificados (DA-0172-02):
        // nunca se inventa una accion nueva, solo se reutiliza el texto ya
        // generado por Insight Engine / Planning Engine.
        actionText: selected.title,
        justification: selected.recommendationText,
      }
    },
  }
}

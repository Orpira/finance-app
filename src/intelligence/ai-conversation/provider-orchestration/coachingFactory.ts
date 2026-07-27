import {
  createOpportunityDetector,
  type OpportunityDetector,
} from './coachingOpportunityDetector'
import {
  createNextBestActionGenerator,
  type NextBestActionGenerator,
} from './coachingNextBestAction'
import {
  createInMemoryCoachingRecommendationHistory,
  type CoachingRecommendationHistory,
} from './coachingRecommendationHistory'
import {
  createCoachingMetricsRecorder,
  type CoachingMetricsRecorder,
} from './coachingMetrics'
import type { RecommendationPrioritizer } from './recommendationPrioritizer'

export interface CoachingModule {
  readonly opportunityDetector: OpportunityDetector
  readonly recommendationHistory: CoachingRecommendationHistory
  readonly nextBestActionGenerator: NextBestActionGenerator
  readonly coachingMetrics: CoachingMetricsRecorder
}

/**
 * Composition root de PB-IS-017.2. Compone el `RecommendationPrioritizer`
 * ya certificado en PB-IS-017.1 (no lo duplica) para construir el
 * Opportunity Detector, y ensambla el historial de recomendaciones, el
 * generador de Next Best Action y sus runtime metrics -- todos en memoria,
 * sin acceso a Dexie ni a las Financial Tools (DA-0172-01, DA-0172-04).
 */
export function createCoachingModule(
  input: { readonly recommendationPrioritizer: RecommendationPrioritizer },
): CoachingModule {
  const recommendationHistory = createInMemoryCoachingRecommendationHistory()

  return {
    opportunityDetector: createOpportunityDetector({ recommendationPrioritizer: input.recommendationPrioritizer }),
    recommendationHistory,
    nextBestActionGenerator: createNextBestActionGenerator({ history: recommendationHistory }),
    coachingMetrics: createCoachingMetricsRecorder(),
  }
}

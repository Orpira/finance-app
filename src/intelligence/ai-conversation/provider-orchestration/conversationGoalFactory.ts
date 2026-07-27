import {
  createConversationGoalManager,
  type ConversationGoalManager,
} from './conversationGoalManager'
import {
  createConversationFollowUpEngine,
  type ConversationFollowUpEngine,
} from './conversationFollowUpEngine'
import {
  createRecommendationPrioritizer,
  type RecommendationPrioritizer,
} from './recommendationPrioritizer'
import {
  createConversationSummaryBuilder,
  type ConversationSummaryBuilder,
} from './conversationSummary'
import {
  createConversationGoalMetricsRecorder,
  type ConversationGoalMetricsRecorder,
} from './conversationGoalMetrics'

export interface ConversationGoalModule {
  readonly goalManager: ConversationGoalManager
  readonly followUpEngine: ConversationFollowUpEngine
  readonly recommendationPrioritizer: RecommendationPrioritizer
  readonly summaryBuilder: ConversationSummaryBuilder
  readonly goalMetrics: ConversationGoalMetricsRecorder
}

/**
 * Composition root de PB-IS-017.1. Ensambla el Goal Manager, el Follow-up
 * Engine, el Recommendation Prioritizer, el Conversation Summary Builder y
 * el registrador de metricas -- todos nuevos, todos en memoria, ninguno con
 * acceso a Dexie ni a las Financial Tools directamente (DA-0171-01,
 * DA-0171-02, DA-0171-04).
 */
export function createConversationGoalModule(): ConversationGoalModule {
  return {
    goalManager: createConversationGoalManager(),
    followUpEngine: createConversationFollowUpEngine(),
    recommendationPrioritizer: createRecommendationPrioritizer(),
    summaryBuilder: createConversationSummaryBuilder(),
    goalMetrics: createConversationGoalMetricsRecorder(),
  }
}

import type {
  ActivationDecision,
} from './activationContracts'
import type {
  AIToolJsonValue,
} from '../../ai-tools'
import type {
  ConversationContextEnrichment,
  ConversationMemoryEntityReference,
} from './conversationMemoryContracts'
import type {
  FinancialInsight,
} from './financialInsightContracts'
import type {
  FinancialActionPlan,
} from './financialPlanningContracts'

export type FinancialConversationExecutionPriority = 'HIGH' | 'NORMAL' | 'LOW'

export interface FinancialConversationContextPlan {
  readonly activePeriod?: Readonly<Record<string, AIToolJsonValue>>
  readonly activeCategory?: string | null
  readonly activeAccount?: string | null
  readonly activeGoal?: string | null
  readonly referencedEntities?: readonly ConversationMemoryEntityReference[]
  readonly enrichment?: ConversationContextEnrichment | null
  readonly insights?: readonly FinancialInsight[]
  readonly actionPlan?: FinancialActionPlan | null
}

export interface FinancialConversationExecutionPlan {
  readonly skillId: string
  readonly activationDecision: ActivationDecision
  readonly requiredTools: readonly string[]
  readonly requiresAIExplanation: boolean
  readonly expectedOutput: string
  readonly executionPriority: FinancialConversationExecutionPriority
  readonly context?: FinancialConversationContextPlan
}

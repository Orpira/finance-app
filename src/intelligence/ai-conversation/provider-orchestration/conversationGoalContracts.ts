export const CONVERSATION_GOAL_PROTOCOL_VERSION = 1 as const

/**
 * PB-IS-017.1: tipos de objetivo conversacional reconocidos por el Goal
 * Extractor. No son entidades financieras ni se persisten (DA-0171-02) --
 * viven exclusivamente en memoria, por sesion, mientras dura la conversacion.
 */
export const CONVERSATION_GOAL_TYPES = [
  'SAVE_MORE',
  'REDUCE_EXPENSES',
  'INCREASE_INCOME',
  'IMPROVE_FINANCES',
  'ORGANIZE_MONEY',
  'PAY_OFF_DEBT',
  'PREPARE_TAXES',
  'BUY_HOUSE',
  'BUY_VEHICLE',
  'TRAVEL',
  'RETIRE',
] as const

export type ConversationGoalType = (typeof CONVERSATION_GOAL_TYPES)[number]

/**
 * Categorias del Financial Insight Engine (`financialInsightContracts.ts`)
 * asociadas a cada tipo de objetivo, usadas unicamente para alinear la
 * prioridad de recomendaciones ya generadas -- nunca para filtrar o generar
 * nuevos insights (DA-0171-01, DA-0171-04).
 */
export const CONVERSATION_GOAL_RELATED_CATEGORIES: Readonly<Record<ConversationGoalType, readonly string[]>> = {
  SAVE_MORE: ['budget', 'goal', 'health'],
  REDUCE_EXPENSES: ['expense', 'subscription', 'budget'],
  INCREASE_INCOME: ['income'],
  IMPROVE_FINANCES: ['health', 'budget'],
  ORGANIZE_MONEY: ['budget', 'health'],
  PAY_OFF_DEBT: ['expense', 'health', 'budget'],
  PREPARE_TAXES: ['income', 'expense'],
  BUY_HOUSE: ['goal', 'budget'],
  BUY_VEHICLE: ['goal', 'budget'],
  TRAVEL: ['goal', 'budget'],
  RETIRE: ['goal', 'health'],
}

export interface ConversationGoal {
  readonly protocolVersion: typeof CONVERSATION_GOAL_PROTOCOL_VERSION
  readonly sessionId: string
  readonly type: ConversationGoalType
  readonly monthlyTargetAmount: number | null
  readonly motivation: string | null
  readonly timeHorizon: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

/**
 * Campo estructurado sobre el que el Follow-up Engine puede preguntar. No es
 * una lista cerrada por tipo -- cada estrategia de follow-up decide que
 * campos son relevantes para su tipo de objetivo (seccion 8).
 */
export type ConversationGoalField = 'monthlyTargetAmount' | 'motivation' | 'timeHorizon'

export interface ConversationGoalExtractionResult {
  readonly type: ConversationGoalType | null
  readonly monthlyTargetAmount: number | null
  readonly motivation: string | null
  readonly timeHorizon: string | null
}

export interface ConversationGoalUpdateResult {
  readonly goal: ConversationGoal | null
  readonly created: boolean
  readonly updated: boolean
  readonly changedFields: readonly ('type' | ConversationGoalField)[]
}

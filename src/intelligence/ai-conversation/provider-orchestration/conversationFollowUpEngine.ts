import type {
  ConversationGoal,
  ConversationGoalField,
  ConversationGoalType,
} from './conversationGoalContracts'

export interface ConversationFollowUpEngine {
  /**
   * Devuelve la pregunta de seguimiento para el primer campo relevante que
   * falte en el Goal activo, o `null` si no falta nada relevante para su
   * tipo (seccion 8: "Nunca preguntar informacion que ya exista.").
   */
  nextQuestion(goal: ConversationGoal): string | null
}

interface FollowUpRule {
  readonly field: ConversationGoalField
  readonly question: string
}

/**
 * Campos relevantes por tipo de objetivo, en el orden en que deben
 * preguntarse (seccion 8). No todos los tipos necesitan los mismos campos:
 * un objetivo de ahorro necesita una meta mensual; un objetivo de compra
 * necesita un horizonte temporal.
 */
const FOLLOW_UP_RULES: Readonly<Record<ConversationGoalType, readonly FollowUpRule[]>> = {
  SAVE_MORE: [{ field: 'monthlyTargetAmount', question: '¿Tienes una meta mensual de ahorro?' }],
  REDUCE_EXPENSES: [{ field: 'monthlyTargetAmount', question: '¿Cuánto te gustaría reducir tus gastos al mes?' }],
  INCREASE_INCOME: [{ field: 'monthlyTargetAmount', question: '¿Cuánto te gustaría aumentar tus ingresos al mes?' }],
  IMPROVE_FINANCES: [],
  ORGANIZE_MONEY: [],
  PAY_OFF_DEBT: [{ field: 'timeHorizon', question: '¿En cuánto tiempo te gustaría salir de tus deudas?' }],
  PREPARE_TAXES: [{ field: 'timeHorizon', question: '¿Para cuándo necesitas tener tus impuestos listos?' }],
  BUY_HOUSE: [{ field: 'timeHorizon', question: '¿Cuándo te gustaría comprarla?' }],
  BUY_VEHICLE: [{ field: 'timeHorizon', question: '¿Cuándo te gustaría comprarlo?' }],
  TRAVEL: [{ field: 'timeHorizon', question: '¿Cuándo te gustaría hacer ese viaje?' }],
  RETIRE: [{ field: 'timeHorizon', question: '¿En cuántos años te gustaría jubilarte?' }],
}

export function createConversationFollowUpEngine(): ConversationFollowUpEngine {
  return {
    nextQuestion(goal) {
      const rules = FOLLOW_UP_RULES[goal.type]
      const pendingRule = rules.find((rule) => goal[rule.field] === null)
      return pendingRule?.question ?? null
    },
  }
}

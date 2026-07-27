import {
  CONVERSATION_GOAL_PROTOCOL_VERSION,
  type ConversationGoal,
  type ConversationGoalField,
  type ConversationGoalUpdateResult,
} from './conversationGoalContracts'
import { extractConversationGoal } from './conversationGoalExtractor'
import { createInMemoryConversationGoalStore, type ConversationGoalStore } from './conversationGoalStore'

export interface ConversationGoalManager {
  getGoal(sessionId: string): ConversationGoal | null
  updateFromMessage(input: {
    readonly sessionId: string
    readonly userMessage: string
    readonly requestedAt: string
  }): ConversationGoalUpdateResult
  clearSession(sessionId: string): void
}

const ENRICHABLE_FIELDS: readonly ConversationGoalField[] = ['monthlyTargetAmount', 'motivation', 'timeHorizon']

/**
 * Mantiene el objetivo activo de cada conversacion (seccion 5-7). El objetivo
 * pertenece a la conversacion, no a la base de datos (DA-0171-02): vive
 * exclusivamente en el `ConversationGoalStore` en memoria inyectado.
 *
 * Regla de fusion: un nuevo tipo de objetivo detectado NUNCA se descarta,
 * pero tampoco reemplaza silenciosamente un objetivo ya activo salvo que el
 * mensaje lo redefina explicitamente -- en la practica, dado que
 * `extractConversationGoal` solo reconoce un tipo por mensaje, la primera
 * deteccion establece el tipo y las siguientes menciones del mismo tipo (o
 * mensajes sin tipo pero con enriquecimiento) solo completan campos vacios,
 * nunca sobrescriben un campo ya informado (seccion 7: "El Goal debera
 * enriquecerse. No reemplazarse.").
 */
export function createConversationGoalManager(
  input: { readonly store?: ConversationGoalStore } = {},
): ConversationGoalManager {
  const store = input.store ?? createInMemoryConversationGoalStore()

  return {
    getGoal(sessionId) {
      return store.get(sessionId)
    },

    updateFromMessage({ sessionId, userMessage, requestedAt }) {
      const extraction = extractConversationGoal(userMessage)
      const current = store.get(sessionId)

      if (current === null && extraction.type === null) {
        return { goal: null, created: false, updated: false, changedFields: [] }
      }

      const changedFields: ('type' | ConversationGoalField)[] = []

      if (current === null) {
        const created: ConversationGoal = {
          protocolVersion: CONVERSATION_GOAL_PROTOCOL_VERSION,
          sessionId,
          type: extraction.type as NonNullable<typeof extraction.type>,
          monthlyTargetAmount: extraction.monthlyTargetAmount,
          motivation: extraction.motivation,
          timeHorizon: extraction.timeHorizon,
          createdAt: requestedAt,
          updatedAt: requestedAt,
        }
        changedFields.push('type')
        for (const field of ENRICHABLE_FIELDS) {
          if (created[field] !== null) {
            changedFields.push(field)
          }
        }
        return { goal: store.set(created), created: true, updated: false, changedFields }
      }

      let nextType = current.type
      if (extraction.type !== null && extraction.type !== current.type) {
        nextType = extraction.type
        changedFields.push('type')
      }

      const nextValues: Record<ConversationGoalField, string | number | null> = {
        monthlyTargetAmount: current.monthlyTargetAmount,
        motivation: current.motivation,
        timeHorizon: current.timeHorizon,
      }
      for (const field of ENRICHABLE_FIELDS) {
        const extracted = extraction[field]
        if (extracted !== null && current[field] === null) {
          nextValues[field] = extracted
          changedFields.push(field)
        }
      }

      if (changedFields.length === 0) {
        return { goal: current, created: false, updated: false, changedFields: [] }
      }

      const updated: ConversationGoal = {
        ...current,
        type: nextType,
        monthlyTargetAmount: nextValues.monthlyTargetAmount as number | null,
        motivation: nextValues.motivation as string | null,
        timeHorizon: nextValues.timeHorizon as string | null,
        updatedAt: requestedAt,
      }
      return { goal: store.set(updated), created: false, updated: true, changedFields }
    },

    clearSession(sessionId) {
      store.clearSession(sessionId)
    },
  }
}

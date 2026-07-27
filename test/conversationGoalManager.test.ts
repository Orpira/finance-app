import { describe, expect, it } from 'vitest'

import { extractConversationGoal } from '../src/intelligence/ai-conversation/provider-orchestration/conversationGoalExtractor'
import { createConversationGoalManager } from '../src/intelligence/ai-conversation/provider-orchestration/conversationGoalManager'
import { createInMemoryConversationGoalStore } from '../src/intelligence/ai-conversation/provider-orchestration/conversationGoalStore'
import { createConversationFollowUpEngine } from '../src/intelligence/ai-conversation/provider-orchestration/conversationFollowUpEngine'
import { createRecommendationPrioritizer } from '../src/intelligence/ai-conversation/provider-orchestration/recommendationPrioritizer'
import { createConversationSummaryBuilder } from '../src/intelligence/ai-conversation/provider-orchestration/conversationSummary'
import type { FinancialInsight } from '../src/intelligence/ai-conversation/provider-orchestration/financialInsightContracts'
import type { FinancialActionPlan } from '../src/intelligence/ai-conversation/provider-orchestration/financialPlanningStrategy'
import type { ConversationGoal } from '../src/intelligence/ai-conversation/provider-orchestration/conversationGoalContracts'

const REQUESTED_AT_1 = '2026-07-27T10:00:00.000Z'
const REQUESTED_AT_2 = '2026-07-27T10:05:00.000Z'
const REQUESTED_AT_3 = '2026-07-27T10:10:00.000Z'

// El store en memoria expira un Goal tras 30 min de reloj real (Date.now())
// desde su updatedAt. Los fixtures anteriores usan timestamps fijos, así que
// las pruebas necesitan un reloj congelado dentro de esa ventana -- si no,
// el resultado depende de a qué hora real se ejecuten los tests.
const FIXED_NOW_MS = new Date('2026-07-27T10:15:00.000Z').getTime()

function createManager(store = createInMemoryConversationGoalStore({ now: () => FIXED_NOW_MS })) {
  return createConversationGoalManager({ store })
}

describe('PB-IS-017.1 Conversation Goal Extractor', () => {
  it('detecta "quiero ahorrar" como SAVE_MORE', () => {
    const result = extractConversationGoal('Quiero ahorrar.')
    expect(result.type).toBe('SAVE_MORE')
    expect(result.monthlyTargetAmount).toBeNull()
  })

  it('detecta "quiero comprar un coche" como BUY_VEHICLE', () => {
    const result = extractConversationGoal('Quiero comprar un coche.')
    expect(result.type).toBe('BUY_VEHICLE')
  })

  it('detecta "quiero salir de deudas" como PAY_OFF_DEBT', () => {
    const result = extractConversationGoal('Quiero salir de deudas.')
    expect(result.type).toBe('PAY_OFF_DEBT')
  })

  it('extrae una meta mensual explicita ("500 € mensuales")', () => {
    const result = extractConversationGoal('Mi meta son 500 € mensuales.')
    expect(result.monthlyTargetAmount).toBe(500)
  })

  it('extrae motivacion cuando el objetivo se detecta en el mismo mensaje ("para un viaje")', () => {
    const result = extractConversationGoal('Quiero ahorrar para un viaje.')
    expect(result.type).toBe('SAVE_MORE')
    expect(result.motivation).toBe('viaje')
  })

  it('no detecta ningun objetivo en un mensaje puramente informativo', () => {
    const result = extractConversationGoal('¿Cuánto gasté este mes?')
    expect(result.type).toBeNull()
  })
})

describe('PB-IS-017.1 Conversation Goal Manager', () => {
  it('creacion de Goal: un mensaje nuevo con objetivo crea el Goal de la sesion', () => {
    const manager = createManager()
    const result = manager.updateFromMessage({
      sessionId: 'session-1',
      userMessage: 'Quiero ahorrar.',
      requestedAt: REQUESTED_AT_1,
    })

    expect(result.created).toBe(true)
    expect(result.updated).toBe(false)
    expect(result.goal?.type).toBe('SAVE_MORE')
    expect(result.goal?.monthlyTargetAmount).toBeNull()
    expect(manager.getGoal('session-1')?.type).toBe('SAVE_MORE')
  })

  it('actualizacion de Goal: un mensaje posterior enriquece el campo faltante sin reemplazar el objetivo', () => {
    const manager = createManager()
    manager.updateFromMessage({ sessionId: 'session-2', userMessage: 'Quiero ahorrar.', requestedAt: REQUESTED_AT_1 })

    const result = manager.updateFromMessage({
      sessionId: 'session-2',
      userMessage: 'Mi objetivo son 500 € al mes.',
      requestedAt: REQUESTED_AT_2,
    })

    expect(result.created).toBe(false)
    expect(result.updated).toBe(true)
    expect(result.changedFields).toContain('monthlyTargetAmount')
    expect(result.goal?.type).toBe('SAVE_MORE')
    expect(result.goal?.monthlyTargetAmount).toBe(500)
  })

  it('enriquecimiento de Goal: no sobrescribe un campo ya informado', () => {
    const manager = createManager()
    manager.updateFromMessage({ sessionId: 'session-3', userMessage: 'Quiero ahorrar 500 € mensuales.', requestedAt: REQUESTED_AT_1 })

    const result = manager.updateFromMessage({
      sessionId: 'session-3',
      userMessage: 'Mi meta son 800 € mensuales.',
      requestedAt: REQUESTED_AT_2,
    })

    // El monto ya existia (500): el segundo mensaje no lo reemplaza.
    expect(result.updated).toBe(false)
    expect(manager.getGoal('session-3')?.monthlyTargetAmount).toBe(500)
  })

  it('multiples objetivos: sesiones distintas mantienen Goals independientes', () => {
    const manager = createManager()
    manager.updateFromMessage({ sessionId: 'session-a', userMessage: 'Quiero ahorrar.', requestedAt: REQUESTED_AT_1 })
    manager.updateFromMessage({ sessionId: 'session-b', userMessage: 'Quiero comprar una casa.', requestedAt: REQUESTED_AT_1 })

    expect(manager.getGoal('session-a')?.type).toBe('SAVE_MORE')
    expect(manager.getGoal('session-b')?.type).toBe('BUY_HOUSE')
  })

  it('un mensaje sin objetivo detectable y sin Goal previo no crea nada', () => {
    const manager = createManager()
    const result = manager.updateFromMessage({
      sessionId: 'session-4',
      userMessage: '¿Cuánto gasté este mes?',
      requestedAt: REQUESTED_AT_1,
    })

    expect(result.created).toBe(false)
    expect(result.updated).toBe(false)
    expect(result.goal).toBeNull()
    expect(manager.getGoal('session-4')).toBeNull()
  })

  it('continuidad conversacional: el Goal persiste sin cambios en un turno que no aporta informacion nueva', () => {
    const manager = createManager()
    manager.updateFromMessage({ sessionId: 'session-5', userMessage: 'Quiero ahorrar.', requestedAt: REQUESTED_AT_1 })
    manager.updateFromMessage({ sessionId: 'session-5', userMessage: 'Mi meta son 500 € al mes.', requestedAt: REQUESTED_AT_2 })

    const result = manager.updateFromMessage({
      sessionId: 'session-5',
      userMessage: '¿Qué me recomiendas?',
      requestedAt: REQUESTED_AT_3,
    })

    expect(result.created).toBe(false)
    expect(result.updated).toBe(false)
    expect(result.goal?.type).toBe('SAVE_MORE')
    expect(result.goal?.monthlyTargetAmount).toBe(500)
  })

  it('ausencia de persistencia en IndexedDB: un store nuevo (misma sesion) no ve el Goal de un store anterior', () => {
    const managerA = createManager()
    managerA.updateFromMessage({ sessionId: 'session-6', userMessage: 'Quiero ahorrar.', requestedAt: REQUESTED_AT_1 })
    expect(managerA.getGoal('session-6')).not.toBeNull()

    // Un segundo store en memoria (simula un nuevo proceso/reinicio sin
    // Dexie de por medio) parte completamente vacio para la misma sesion.
    const managerB = createManager()
    expect(managerB.getGoal('session-6')).toBeNull()
  })

  it('clearSession elimina el Goal de la sesion', () => {
    const manager = createManager()
    manager.updateFromMessage({ sessionId: 'session-7', userMessage: 'Quiero ahorrar.', requestedAt: REQUESTED_AT_1 })
    manager.clearSession('session-7')
    expect(manager.getGoal('session-7')).toBeNull()
  })
})

describe('PB-IS-017.1 Conversation Follow-up Engine', () => {
  it('pregunta por la meta mensual cuando falta en un objetivo de ahorro', () => {
    const engine = createConversationFollowUpEngine()
    const goal: ConversationGoal = {
      protocolVersion: 1,
      sessionId: 'session-1',
      type: 'SAVE_MORE',
      monthlyTargetAmount: null,
      motivation: null,
      timeHorizon: null,
      createdAt: REQUESTED_AT_1,
      updatedAt: REQUESTED_AT_1,
    }

    expect(engine.nextQuestion(goal)).toBe('¿Tienes una meta mensual de ahorro?')
  })

  it('no pregunta por informacion que ya existe (seccion 8)', () => {
    const engine = createConversationFollowUpEngine()
    const goal: ConversationGoal = {
      protocolVersion: 1,
      sessionId: 'session-1',
      type: 'SAVE_MORE',
      monthlyTargetAmount: 500,
      motivation: null,
      timeHorizon: null,
      createdAt: REQUESTED_AT_1,
      updatedAt: REQUESTED_AT_1,
    }

    expect(engine.nextQuestion(goal)).toBeNull()
  })

  it('pregunta por el horizonte temporal en un objetivo de compra', () => {
    const engine = createConversationFollowUpEngine()
    const goal: ConversationGoal = {
      protocolVersion: 1,
      sessionId: 'session-1',
      type: 'BUY_VEHICLE',
      monthlyTargetAmount: null,
      motivation: null,
      timeHorizon: null,
      createdAt: REQUESTED_AT_1,
      updatedAt: REQUESTED_AT_1,
    }

    expect(engine.nextQuestion(goal)).toBe('¿Cuándo te gustaría comprarlo?')
  })
})

function createInsightFixture(input: {
  readonly insightId: string
  readonly category: FinancialInsight['category']
  readonly priority: FinancialInsight['priority']
}): FinancialInsight {
  return {
    protocolVersion: 1,
    insightId: input.insightId,
    category: input.category,
    severity: input.priority,
    priority: input.priority,
    title: `title:${input.insightId}`,
    description: `description:${input.insightId}`,
    recommendation: `recommendation:${input.insightId}`,
    sourceTool: 'financial_insights',
    generatedAt: REQUESTED_AT_1,
  }
}

describe('PB-IS-017.1 Recommendation Prioritizer', () => {
  it('prioriza insights de mayor severidad/prioridad primero', () => {
    const prioritizer = createRecommendationPrioritizer()
    const low = createInsightFixture({ insightId: 'low', category: 'expense', priority: 'LOW' })
    const critical = createInsightFixture({ insightId: 'critical', category: 'expense', priority: 'CRITICAL' })
    const medium = createInsightFixture({ insightId: 'medium', category: 'expense', priority: 'MEDIUM' })

    const result = prioritizer.prioritizeInsights([low, critical, medium], null)
    expect(result.map((insight) => insight.insightId)).toEqual(['critical', 'medium', 'low'])
  })

  it('prioriza insights alineados con el objetivo activo por encima de otros de igual prioridad', () => {
    const prioritizer = createRecommendationPrioritizer()
    const unrelated = createInsightFixture({ insightId: 'unrelated', category: 'income', priority: 'HIGH' })
    const related = createInsightFixture({ insightId: 'related', category: 'expense', priority: 'HIGH' })
    const goal: ConversationGoal = {
      protocolVersion: 1,
      sessionId: 'session-1',
      type: 'REDUCE_EXPENSES',
      monthlyTargetAmount: null,
      motivation: null,
      timeHorizon: null,
      createdAt: REQUESTED_AT_1,
      updatedAt: REQUESTED_AT_1,
    }

    const result = prioritizer.prioritizeInsights([unrelated, related], goal)
    expect(result.map((insight) => insight.insightId)).toEqual(['related', 'unrelated'])
  })

  it('prioriza acciones del Planning Engine por prioridad y facilidad, sin recalcular el plan', () => {
    const prioritizer = createRecommendationPrioritizer()
    const actionPlan: FinancialActionPlan = {
      planId: 'plan-1',
      createdAt: REQUESTED_AT_1,
      title: 'Plan de prueba',
      summary: 'Resumen de prueba',
      objective: 'Objetivo de prueba',
      priority: 'HIGH',
      estimatedImpact: 'HIGH',
      recommendedActions: [
        {
          actionId: 'hard-high',
          type: 'expense-reduction',
          description: 'accion dificil de alta prioridad',
          expectedBenefit: 'beneficio',
          effort: 'HIGH',
          priority: 'HIGH',
          affectedCategory: 'expense',
          relatedGoal: null,
          requiresConfirmation: false,
        },
        {
          actionId: 'easy-high',
          type: 'expense-reduction',
          description: 'accion facil de alta prioridad',
          expectedBenefit: 'beneficio',
          effort: 'LOW',
          priority: 'HIGH',
          affectedCategory: 'expense',
          relatedGoal: null,
          requiresConfirmation: false,
        },
        {
          actionId: 'easy-low',
          type: 'expense-reduction',
          description: 'accion facil de baja prioridad',
          expectedBenefit: 'beneficio',
          effort: 'LOW',
          priority: 'LOW',
          affectedCategory: 'expense',
          relatedGoal: null,
          requiresConfirmation: false,
        },
      ],
      relatedInsights: [],
      assumptions: [],
      warnings: [],
    }

    const result = prioritizer.prioritizeActionPlan(actionPlan, null)
    expect(result?.recommendedActions.map((action) => action.actionId)).toEqual(['easy-high', 'hard-high', 'easy-low'])
    // El resto del plan no se recalcula ni se modifica.
    expect(result?.summary).toBe('Resumen de prueba')
    expect(result?.planId).toBe('plan-1')
  })

  it('prioritizeActionPlan devuelve null si no hay plan (no inventa uno)', () => {
    const prioritizer = createRecommendationPrioritizer()
    expect(prioritizer.prioritizeActionPlan(null, null)).toBeNull()
  })
})

describe('PB-IS-017.1 Conversation Summary', () => {
  it('construye un resumen interno con el Goal, la principal recomendacion y el follow-up pendiente', () => {
    const builder = createConversationSummaryBuilder()
    const goal: ConversationGoal = {
      protocolVersion: 1,
      sessionId: 'session-1',
      type: 'SAVE_MORE',
      monthlyTargetAmount: 500,
      motivation: 'viaje',
      timeHorizon: null,
      createdAt: REQUESTED_AT_1,
      updatedAt: REQUESTED_AT_1,
    }
    const insight = createInsightFixture({ insightId: 'top', category: 'expense', priority: 'HIGH' })

    const summary = builder.build({
      sessionId: 'session-1',
      goal,
      prioritizedInsights: [insight],
      prioritizedActionPlan: null,
      pendingFollowUpQuestion: '¿Tienes una meta mensual de ahorro?',
      requestedAt: REQUESTED_AT_1,
    })

    expect(summary.goal?.type).toBe('SAVE_MORE')
    expect(summary.mainIssue).toBe('title:top')
    expect(summary.pendingFollowUp).toBe('¿Tienes una meta mensual de ahorro?')
  })
})

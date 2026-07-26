import { describe, expect, it } from 'vitest'

import type { ActivationDecision } from '../src/intelligence/ai-conversation/provider-orchestration/activationContracts'
import {
  buildFinancialBalanceDirectResponseText,
  buildFinancialDirectResponseText,
  buildFinancialTransactionsDirectResponseText,
} from '../src/intelligence/ai-conversation/provider-orchestration/financialDirectResponseBuilder'
import { createPromptContextBuilder } from '../src/intelligence/prompt-context-builder'
import { createConversationResponseComposer, type ConversationResponse } from '../src/intelligence/response-composer'
import type { AIConversationRequest } from '../src/intelligence/ai-conversation'

const TODAY = '2026-07-25T10:00:00.000Z'
const NOT_TODAY = '2026-07-24T10:00:00.000Z'

function todayPeriod() {
  return { from: '2026-07-25T00:00:00.000Z', to: '2026-07-25T23:59:59.999Z' }
}

describe('Financial Transactions Direct Response Builder (PB-IS-016.1-R1)', () => {
  it('total de ingresos: usa el summary real y antepone "Hoy" cuando el filtro cubre el dia de hoy', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 3, incomeTotal: 1250, expenseTotal: 0, netTotal: 1250 },
        items: [],
      },
      userMessage: '¿Cuánto suman mis ingresos hoy?',
      toolArguments: { filters: { kinds: ['income'], period: todayPeriod() } },
      nowIso: TODAY,
    })

    expect(text).toBe('Hoy tus ingresos suman 1.250,00 EUR.')
  })

  it('total de egresos: usa expenseTotal, no incomeTotal', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 2, incomeTotal: 0, expenseTotal: 340, netTotal: -340 },
        items: [],
      },
      userMessage: '¿Cuánto suman mis egresos hoy?',
      toolArguments: { filters: { kinds: ['expense'], period: todayPeriod() } },
      nowIso: TODAY,
    })

    expect(text).toBe('Hoy tus egresos suman 340,00 EUR.')
  })

  it('cantidad de ingresos: responde con matchedCount, no con incomeTotal', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 4, incomeTotal: 1250, expenseTotal: 0, netTotal: 1250 },
        items: [],
      },
      userMessage: '¿Cuántos ingresos tuve hoy?',
      toolArguments: { filters: { kinds: ['income'], period: todayPeriod() } },
      nowIso: TODAY,
    })

    expect(text).toBe('Hoy registraste 4 ingresos.')
  })

  it('cantidad de egresos en singular cuando matchedCount es 1', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 1, incomeTotal: 0, expenseTotal: 50, netTotal: -50 },
        items: [],
      },
      userMessage: '¿Cuántos egresos tuve hoy?',
      toolArguments: { filters: { kinds: ['expense'], period: todayPeriod() } },
      nowIso: TODAY,
    })

    expect(text).toBe('Hoy registraste 1 egreso.')
  })

  it('cero resultados: nunca responde "0" ni "undefined"', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 0, incomeTotal: 0, expenseTotal: 0, netTotal: 0 },
        items: [],
      },
      userMessage: '¿Cuánto suman mis ingresos hoy?',
      toolArguments: { filters: { kinds: ['income'], period: todayPeriod() } },
      nowIso: TODAY,
    })

    expect(text).toBe('No encontré ingresos registrados para hoy.')
    expect(text).not.toContain('undefined')
    expect(text).not.toMatch(/^0/)
  })

  it('PB-IS-016.2: cero resultados con periodo "ayer" conserva la expresion temporal en la respuesta', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 0, incomeTotal: 0, expenseTotal: 0, netTotal: 0 },
        items: [],
      },
      userMessage: '¿Cuánto suman mis ingresos ayer?',
      toolArguments: { filters: { kinds: ['income'], period: { from: '2026-07-24', to: '2026-07-24' } } },
      // TODAY = 2026-07-25T10:00:00.000Z, por lo que 2026-07-24 es "ayer".
      nowIso: TODAY,
    })

    expect(text).toBe('No encontré ingresos registrados ayer.')
  })

  it('PB-IS-016.2-R2: la etiqueta "Ayer" se reconoce con nowIso UTC-adelantado respecto al dia local', () => {
    // nowIso es 2026-07-27T01:00:00.000Z en UTC, pero en UTC-5
    // (America/Bogota) es 2026-07-26 20:00 local. El periodo devuelto por
    // la Tool (from/to = 2026-07-25, la misma fecha local que "ayer") debe
    // seguir reconociendose como "Ayer" en la respuesta, no perderse por
    // comparar contra un "hoy" calculado en UTC.
    const originalTz = process.env.TZ
    process.env.TZ = 'America/Bogota'
    try {
      const text = buildFinancialTransactionsDirectResponseText({
        output: {
          summary: { currencyCode: 'GBP', matchedCount: 3, incomeTotal: 8834, expenseTotal: 0, netTotal: 8834 },
          items: [],
        },
        userMessage: '¿Cuántos ingresos obtuve ayer?',
        toolArguments: { filters: { kinds: ['income'], period: { from: '2026-07-25', to: '2026-07-25' } } },
        nowIso: '2026-07-27T01:00:00.000Z',
      })

      expect(text).toBe('Ayer registraste 3 ingresos.')
    } finally {
      process.env.TZ = originalTz
    }
  })

  it('PB-IS-016.2: total con periodo "este mes" antepone "Este mes"', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 5, incomeTotal: 0, expenseTotal: 780, netTotal: -780 },
        items: [],
      },
      userMessage: '¿Cuánto gasté este mes?',
      toolArguments: { filters: { kinds: ['expense'], period: { from: '2026-07-01', to: '2026-07-25' } } },
      nowIso: TODAY,
    })

    expect(text).toBe('Este mes tus egresos suman 780,00 EUR.')
  })

  it('no inventa "Hoy" cuando el filtro real de la Tool no fue por el dia de hoy', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 10, incomeTotal: 9000, expenseTotal: 0, netTotal: 9000 },
        items: [],
      },
      userMessage: '¿Cuánto suman mis ingresos hoy?',
      // Sin filters.period (caso real del resolver deterministico actual,
      // que no filtra por fecha): no se debe afirmar "Hoy" sobre un total
      // que en realidad es historico completo.
      toolArguments: { filters: { kinds: ['income'] } },
      nowIso: TODAY,
    })

    expect(text).toBe('Tus ingresos suman 9.000,00 EUR.')
    expect(text).not.toContain('Hoy')
  })

  it('multiples monedas: nunca suma monedas distintas, responde desglosado', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', matchedCount: 2, incomeTotal: 850, expenseTotal: 0, netTotal: 850 },
        items: [
          { kind: 'income', amount: 850, currencyCode: 'EUR' },
          { kind: 'income', amount: 420, currencyCode: 'GBP' },
        ],
      },
      userMessage: '¿Cuánto suman mis ingresos hoy?',
      toolArguments: { filters: { kinds: ['income'], period: todayPeriod() } },
      nowIso: TODAY,
    })

    expect(text).toContain('850,00 EUR')
    expect(text).toContain('420,00 GBP')
    expect(text?.startsWith('Hoy registraste')).toBe(true)
  })

  it('payload incompleto: si falta un campo critico del summary, no inventa y devuelve null (el llamador usa el fallback seguro)', () => {
    const text = buildFinancialTransactionsDirectResponseText({
      output: { summary: { currencyCode: 'EUR', matchedCount: 3 } },
      userMessage: '¿Cuánto suman mis ingresos hoy?',
      toolArguments: { filters: { kinds: ['income'] } },
      nowIso: TODAY,
    })

    expect(text).toBeNull()
  })
})

describe('Financial Balance Direct Response Builder (PB-IS-016.1-R1)', () => {
  it('balance: combina ingresos, egresos y neto en una sola frase natural', () => {
    const text = buildFinancialBalanceDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', incomeTotal: 1250, expenseTotal: 340, adjustmentTotal: 0, netBalance: 910, hasData: true },
        period: todayPeriod(),
      },
      nowIso: TODAY,
    })

    expect(text).toBe('Hoy registras ingresos por 1.250,00 EUR, egresos por 340,00 EUR y un balance neto de 910,00 EUR.')
  })

  it('sin datos: responde con un mensaje claro, no con ceros vacios', () => {
    const text = buildFinancialBalanceDirectResponseText({
      output: {
        summary: { currencyCode: 'EUR', incomeTotal: 0, expenseTotal: 0, adjustmentTotal: 0, netBalance: 0, hasData: false },
      },
      nowIso: NOT_TODAY,
    })

    expect(text).toBe('No encontré movimientos registrados para calcular tu balance.')
  })

  it('payload incompleto: summary sin netBalance devuelve null', () => {
    const text = buildFinancialBalanceDirectResponseText({
      output: { summary: { currencyCode: 'EUR', incomeTotal: 100 } },
      nowIso: TODAY,
    })

    expect(text).toBeNull()
  })
})

function createResponseFixture(input: {
  readonly toolId: string
  readonly output: unknown
  readonly kind?: 'success' | 'failure'
}): ConversationResponse {
  const promptContextResult = createPromptContextBuilder().build({
    executionResult: {
      executionId: 'conversation-orchestration:direct-response-builder:test:001' as AIConversationRequest['executionId'],
      startedAt: TODAY,
      finishedAt: TODAY,
      status: input.kind === 'failure' ? 'partial-failure' : 'success',
      summary: {
        totalSteps: 1,
        successfulSteps: input.kind === 'failure' ? 0 : 1,
        failedSteps: input.kind === 'failure' ? 1 : 0,
      },
      steps: [
        input.kind === 'failure'
          ? {
              kind: 'failure' as const,
              stepId: 'step-1',
              order: 1,
              toolId: input.toolId,
              error: { kind: 'failure' as const, code: 'TOOL_EXECUTION_FAILED', retryable: true, safeMessage: 'boom' },
            }
          : {
              kind: 'success' as const,
              stepId: 'step-1',
              order: 1,
              toolId: input.toolId,
              resolvedToolName: input.toolId,
              execution: {
                toolName: input.toolId,
                output: input.output,
                permission: 'read-only' as const,
                durationMs: 1,
              },
            },
      ],
    },
  })

  if (promptContextResult.kind !== 'success') {
    throw new Error('Expected prompt context fixture')
  }

  const responseResult = createConversationResponseComposer().build({ promptContext: promptContextResult.context })
  if (responseResult.kind !== 'success') {
    throw new Error('Expected response fixture')
  }

  return responseResult.response
}

function createDecision(overrides: Partial<ActivationDecision>): ActivationDecision {
  return {
    protocolVersion: 1,
    activationType: 'DIRECT_TOOL',
    provider: 'mock-ai-provider',
    toolId: 'financial_transactions',
    confidence: 0.9,
    requiresAI: false,
    requiresTool: true,
    requiresExplanation: false,
    fallback: { used: false },
    reason: 'fixture',
    intent: 'transactions',
    ...overrides,
  }
}

describe('Financial Direct Response dispatcher (PB-IS-016.1-R1)', () => {
  it('fallback: si la Tool fallo, responde con un mensaje seguro y no tecnico', () => {
    const response = createResponseFixture({ toolId: 'financial_transactions', output: null, kind: 'failure' })
    const outcome = buildFinancialDirectResponseText({
      decision: createDecision({ toolId: 'financial_transactions' }),
      userMessage: '¿Cuánto suman mis ingresos hoy?',
      response,
      now: () => TODAY,
    })

    expect(outcome.builderId).toBe('financial-direct-unavailable')
    expect(outcome.text).not.toMatch(/determinista|sin usar IA|DIRECT_TOOL|Activation Engine/i)
  })

  it('elimina el mensaje tecnico: para una tool exitosa sin builder especializado, no expone jerga interna', () => {
    const response = createResponseFixture({ toolId: 'financial_goals', output: { progress: 0.5 } })
    const outcome = buildFinancialDirectResponseText({
      decision: createDecision({ toolId: 'financial_goals', intent: 'goals' }),
      userMessage: '¿Cómo van mis metas?',
      response,
      now: () => TODAY,
    })

    expect(outcome.builderId).toBe('financial-generic-success')
    expect(outcome.text).not.toMatch(/determinista|sin usar IA|DIRECT_TOOL|Activation Engine/i)
  })

  it('financial_transactions exitosa: delega en el builder especializado', () => {
    const response = createResponseFixture({
      toolId: 'financial_transactions',
      output: { summary: { currencyCode: 'EUR', matchedCount: 3, incomeTotal: 1250, expenseTotal: 0, netTotal: 1250 }, items: [] },
    })
    const outcome = buildFinancialDirectResponseText({
      decision: createDecision({
        toolId: 'financial_transactions',
        toolArguments: { filters: { kinds: ['income'], period: todayPeriod() } },
      }),
      userMessage: '¿Cuánto suman mis ingresos hoy?',
      response,
      now: () => TODAY,
    })

    expect(outcome.builderId).toBe('financial-transactions-summary')
    expect(outcome.text).toBe('Hoy tus ingresos suman 1.250,00 EUR.')
  })
})

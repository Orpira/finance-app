import { describe, expect, it } from 'vitest'

import { applyProposalEdits, createProposalFromParsedIntent } from './assistantProposalFactory'
import type { ParsedAssistantIntent } from './assistantIntentParser'

const CONTEXT = { defaultCurrency: 'EUR' as const }

describe('createProposalFromParsedIntent', () => {
  it('devuelve null cuando no hay intención de acción', () => {
    expect(createProposalFromParsedIntent({ kind: 'none' }, CONTEXT)).toBeNull()
  })

  it('crea una propuesta de ingreso lista para confirmar cuando todos los campos están presentes', () => {
    const parsed: ParsedAssistantIntent = {
      kind: 'register_income',
      sourceText: 'Hoy recibí 120 euros por un servicio',
      fields: { amount: 120, currency: 'EUR', date: '2026-08-01', description: null },
    }

    const proposal = createProposalFromParsedIntent(parsed, CONTEXT)

    expect(proposal?.kind).toBe('register_income')
    expect(proposal?.status).toBe('awaiting_confirmation')
    expect(proposal?.missingRequiredFields).toEqual([])
  })

  it('usa la moneda por defecto del contexto cuando el mensaje no la menciona', () => {
    const parsed: ParsedAssistantIntent = {
      kind: 'register_expense',
      sourceText: 'Gasté 35 en transporte',
      fields: { amount: 35, currency: null, date: '2026-08-01', category: 'Transporte' },
    }

    const proposal = createProposalFromParsedIntent(parsed, CONTEXT)

    expect(proposal?.kind).toBe('register_expense')
    if (proposal?.kind !== 'register_expense') throw new Error('expected register_expense')
    expect(proposal.fields.currency).toBe('EUR')
    expect(proposal.missingRequiredFields).toEqual([])
  })

  it('marca amount como campo faltante cuando no se pudo extraer', () => {
    const parsed: ParsedAssistantIntent = {
      kind: 'register_income',
      sourceText: 'Hoy recibí dinero',
      fields: { amount: null, currency: 'EUR', date: '2026-08-01', description: null },
    }

    const proposal = createProposalFromParsedIntent(parsed, CONTEXT)

    expect(proposal?.missingRequiredFields).toContain('amount')
  })

  it('marca expectedAmount y time como faltantes en una cita sin esos datos', () => {
    const parsed: ParsedAssistantIntent = {
      kind: 'create_appointment',
      sourceText: 'Mañana tengo una cita',
      fields: { date: '2026-08-02', time: null, durationMinutes: 60, expectedAmount: null, currency: null },
    }

    const proposal = createProposalFromParsedIntent(parsed, CONTEXT)

    expect(proposal?.missingRequiredFields).toEqual(expect.arrayContaining(['time', 'expectedAmount']))
  })
})

describe('applyProposalEdits', () => {
  it('recalcula los campos faltantes tras completar la edición', () => {
    const parsed: ParsedAssistantIntent = {
      kind: 'register_income',
      sourceText: 'Hoy recibí dinero',
      fields: { amount: null, currency: 'EUR', date: '2026-08-01', description: null },
    }
    const proposal = createProposalFromParsedIntent(parsed, CONTEXT)
    if (!proposal) throw new Error('expected proposal')
    expect(proposal.missingRequiredFields).toContain('amount')

    const edited = applyProposalEdits(proposal, { amount: 200 })

    expect(edited.missingRequiredFields).toEqual([])
    if (edited.kind !== 'register_income') throw new Error('expected register_income')
    expect(edited.fields.amount).toBe(200)
  })

  it('no marca campos opcionales como faltantes', () => {
    const parsed: ParsedAssistantIntent = {
      kind: 'register_income',
      sourceText: 'Hoy recibí 50 euros',
      fields: { amount: 50, currency: 'EUR', date: '2026-08-01', description: null },
    }
    const proposal = createProposalFromParsedIntent(parsed, CONTEXT)
    if (!proposal) throw new Error('expected proposal')

    expect(proposal.missingRequiredFields).toEqual([])
  })
})

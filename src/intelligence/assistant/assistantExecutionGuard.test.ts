import { describe, expect, it } from 'vitest'

import { assertProposalReadyForExecution } from './assistantExecutionGuard'
import type { AssistantProposalRecord } from './assistantProposalContracts'

function incomeProposal(overrides: Partial<AssistantProposalRecord> = {}): AssistantProposalRecord {
  return {
    proposalId: 'p1',
    kind: 'register_income',
    status: 'confirmed',
    createdAt: '2026-08-01T00:00:00.000Z',
    sourceText: 'Hoy recibí 120 euros',
    missingRequiredFields: [],
    fields: { amount: 120, currency: 'EUR', date: '2026-08-01', description: null },
    ...overrides,
  } as AssistantProposalRecord
}

describe('assertProposalReadyForExecution', () => {
  it('rechaza una propuesta que no está confirmada', () => {
    const result = assertProposalReadyForExecution(incomeProposal({ status: 'awaiting_confirmation' }))
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.code).toBe('NOT_CONFIRMED')
  })

  it('rechaza una propuesta con campos faltantes aunque esté confirmada', () => {
    const result = assertProposalReadyForExecution(
      incomeProposal({ missingRequiredFields: ['amount'] }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.code).toBe('MISSING_REQUIRED_FIELDS')
  })

  it('rechaza un importe cero o negativo', () => {
    const result = assertProposalReadyForExecution(
      incomeProposal({ fields: { amount: 0, currency: 'EUR', date: '2026-08-01', description: null } }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.code).toBe('INVALID_AMOUNT')
  })

  it('rechaza una fecha con formato inválido', () => {
    const result = assertProposalReadyForExecution(
      incomeProposal({ fields: { amount: 120, currency: 'EUR', date: '01/08/2026', description: null } }),
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.code).toBe('INVALID_DATE')
  })

  it('acepta una propuesta de ingreso confirmada y válida', () => {
    expect(assertProposalReadyForExecution(incomeProposal())).toEqual({ ok: true })
  })

  it('rechaza una cita confirmada sin hora válida', () => {
    const appointment: AssistantProposalRecord = {
      proposalId: 'p2',
      kind: 'create_appointment',
      status: 'confirmed',
      createdAt: '2026-08-01T00:00:00.000Z',
      sourceText: 'Mañana tengo una cita a las 18:30',
      missingRequiredFields: [],
      fields: { date: '2026-08-02', time: null, durationMinutes: 60, expectedAmount: 80, currency: 'EUR' },
    }
    const result = assertProposalReadyForExecution(appointment)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.code).toBe('INVALID_TIME')
  })

  it('acepta una cita confirmada y completa', () => {
    const appointment: AssistantProposalRecord = {
      proposalId: 'p3',
      kind: 'create_appointment',
      status: 'confirmed',
      createdAt: '2026-08-01T00:00:00.000Z',
      sourceText: 'Mañana tengo una cita a las 18:30',
      missingRequiredFields: [],
      fields: { date: '2026-08-02', time: '18:30', durationMinutes: 60, expectedAmount: 80, currency: 'EUR' },
    }
    expect(assertProposalReadyForExecution(appointment)).toEqual({ ok: true })
  })
})

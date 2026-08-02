import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const createServiceIncomeMock = vi.fn()
vi.mock('../../services/incomeService', () => ({
  createServiceIncome: (...args: unknown[]) => createServiceIncomeMock(...args),
}))

const createExpenseMock = vi.fn()
vi.mock('../../services/expenseService', () => ({
  createExpense: (...args: unknown[]) => createExpenseMock(...args),
}))

const createAppointmentMock = vi.fn()
vi.mock('../../services/appointmentService', () => ({
  createAppointment: (...args: unknown[]) => createAppointmentMock(...args),
}))

const convertCurrencyToEurCopMock = vi.fn()
vi.mock('../../services/currencyConversionService', () => ({
  convertCurrencyToEurCop: (...args: unknown[]) => convertCurrencyToEurCopMock(...args),
}))

const getSettingsMock = vi.fn()
vi.mock('../../services/settingsService', () => ({
  getSettings: () => getSettingsMock(),
}))

const markIncomeAsReportedMock = vi.fn()
vi.mock('../../services/incomeReport.service', () => ({
  markIncomeAsReported: (...args: unknown[]) => markIncomeAsReportedMock(...args),
}))

const createFinancialGoalMock = vi.fn()
vi.mock('../../services/financialGoalService', () => ({
  financialGoalService: { create: (...args: unknown[]) => createFinancialGoalMock(...args) },
}))

const exportCopilotPeriodReportMock = vi.fn()
vi.mock('../../services/copilotReportExportService', () => ({
  exportCopilotPeriodReport: (...args: unknown[]) => exportCopilotPeriodReportMock(...args),
}))

const { executeAssistantProposal } = await import('./assistantExecutionService')
const { getAssistantAuditTrail, clearAssistantAuditTrail } = await import('./assistantAuditLog')
import type { AssistantProposalRecord } from './assistantProposalContracts'

function incomeProposal(overrides: Partial<AssistantProposalRecord> = {}): AssistantProposalRecord {
  return {
    proposalId: 'assistant-proposal:register_income:1',
    kind: 'register_income',
    status: 'confirmed',
    createdAt: '2026-08-01T00:00:00.000Z',
    sourceText: 'Hoy recibí 120 euros por un servicio',
    missingRequiredFields: [],
    fields: { amount: 120, currency: 'EUR', date: '2026-08-01', description: null },
    ...overrides,
  } as AssistantProposalRecord
}

beforeEach(() => {
  getSettingsMock.mockResolvedValue({ defaultCurrency: 'EUR', usageMode: 'professional' })
  convertCurrencyToEurCopMock.mockResolvedValue({ eurValue: 120, copValue: 550000, eurCopRate: 4583 })
  clearAssistantAuditTrail()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('executeAssistantProposal', () => {
  it('rechaza sin llamar a ningún servicio si la propuesta no está confirmada', async () => {
    const result = await executeAssistantProposal(incomeProposal({ status: 'awaiting_confirmation' }))

    expect(result.ok).toBe(false)
    expect(createServiceIncomeMock).not.toHaveBeenCalled()
  })

  it('registra un ingreso reutilizando incomeService.createServiceIncome', async () => {
    createServiceIncomeMock.mockResolvedValue(42)

    const result = await executeAssistantProposal(incomeProposal())

    expect(result).toEqual({ ok: true, recordId: 42 })
    expect(createServiceIncomeMock).toHaveBeenCalledTimes(1)
    const call = createServiceIncomeMock.mock.calls[0][0]
    expect(call.type).toBe('otro')
    expect(call.totalAmount).toBe(120)
    expect(call.currency).toBe('EUR')
    expect(call.date).toBe('2026-08-01')
    expect(call.percentage).toBe(0)
    expect(call.eurValue).toBe(120)
    expect(call.copValue).toBe(550000)
    expect(call.exchangeRateUsed).toBe(4583)
  })

  it('registra un gasto reutilizando expenseService.createExpense', async () => {
    createExpenseMock.mockResolvedValue(7)

    const proposal: AssistantProposalRecord = {
      proposalId: 'assistant-proposal:register_expense:1',
      kind: 'register_expense',
      status: 'confirmed',
      createdAt: '2026-08-01T00:00:00.000Z',
      sourceText: 'Gasté 35 euros en transporte',
      missingRequiredFields: [],
      fields: { amount: 35, currency: 'EUR', date: '2026-08-01', category: 'Transporte' },
    }

    const result = await executeAssistantProposal(proposal)

    expect(result).toEqual({ ok: true, recordId: 7 })
    expect(createExpenseMock).toHaveBeenCalledTimes(1)
    const call = createExpenseMock.mock.calls[0][0]
    expect(call.type).toBe('gasto')
    expect(call.amount).toBe(35)
    expect(call.category).toBe('Transporte')
  })

  it('crea una cita reutilizando appointmentService.createAppointment', async () => {
    createAppointmentMock.mockResolvedValue(9)

    const proposal: AssistantProposalRecord = {
      proposalId: 'assistant-proposal:create_appointment:1',
      kind: 'create_appointment',
      status: 'confirmed',
      createdAt: '2026-08-01T00:00:00.000Z',
      sourceText: 'Mañana tengo una cita a las 18:30',
      missingRequiredFields: [],
      fields: { date: '2026-08-02', time: '18:30', durationMinutes: 60, expectedAmount: 80, currency: 'EUR' },
    }

    const result = await executeAssistantProposal(proposal)

    expect(result).toEqual({ ok: true, recordId: 9 })
    const call = createAppointmentMock.mock.calls[0][0]
    expect(call.dateTime).toBe('2026-08-02T18:30')
    expect(call.duration).toBe(60)
    expect(call.expectedAmount).toBe(80)
    expect(call.completed).toBe(false)
    expect(call.reminders).toEqual([])
  })

  it('propaga el error del servicio de dominio como fallo, sin datos inventados', async () => {
    createServiceIncomeMock.mockRejectedValue(
      new Error('No hay una temporada activa. Crea una temporada para registrar actividad.'),
    )

    const result = await executeAssistantProposal(incomeProposal())

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected failure')
    expect(result.safeMessage).toContain('temporada activa')
  })

  it('registra en la auditoría el resultado sin importes ni fechas de la operación', async () => {
    createServiceIncomeMock.mockResolvedValue(42)

    await executeAssistantProposal(incomeProposal())

    const trail = getAssistantAuditTrail()
    expect(trail).toHaveLength(1)
    expect(trail[0]).toEqual(
      expect.objectContaining({ kind: 'register_income', status: 'completed', executedRecordId: 42 }),
    )
    // Solo timestamp/proposalId/kind/status/executedRecordId -- nunca los
    // campos financieros de la propuesta (fields, amount, date, currency...).
    expect(Object.keys(trail[0]).sort()).toEqual(
      ['executedRecordId', 'kind', 'proposalId', 'status', 'timestamp'].sort(),
    )
  })

  it('marca un único ingreso como reportado solo después de confirmar', async () => {
    markIncomeAsReportedMock.mockResolvedValue(undefined)
    const proposal: AssistantProposalRecord = {
      proposalId: 'assistant-proposal:mark:1', kind: 'mark_income_reported', status: 'confirmed',
      createdAt: '2026-08-02T10:00:00.000Z', sourceText: 'Marca el ingreso', missingRequiredFields: [],
      fields: { incomeId: 7, date: '2026-07-30', amount: 120, currency: 'EUR', category: 'Ingreso', currentStatus: 'Sin revisar' },
    }
    expect(await executeAssistantProposal(proposal)).toEqual({ ok: true, recordId: 7 })
    expect(markIncomeAsReportedMock).toHaveBeenCalledWith(7)

    await executeAssistantProposal({ ...proposal, status: 'cancelled' })
    expect(markIncomeAsReportedMock).toHaveBeenCalledTimes(1)
  })

  it('genera el PDF confirmado mediante el exportador existente', async () => {
    exportCopilotPeriodReportMock.mockResolvedValue('reporte.pdf')
    const proposal: AssistantProposalRecord = {
      proposalId: 'assistant-proposal:report:1', kind: 'generate_report', status: 'confirmed',
      createdAt: '2026-08-02T10:00:00.000Z', sourceText: 'Prepara PDF', missingRequiredFields: [],
      fields: { periodStart: '2026-08-01', periodEnd: '2026-08-31', format: 'pdf', includedData: 'Resumen' },
    }
    expect(await executeAssistantProposal(proposal)).toEqual({ ok: true, recordId: 'reporte.pdf' })
    expect(exportCopilotPeriodReportMock).toHaveBeenCalledWith({ periodStart: '2026-08-01', periodEnd: '2026-08-31' })
  })

  it('crea el objetivo confirmado mediante financialGoalService', async () => {
    createFinancialGoalMock.mockResolvedValue({ id: 'goal-created' })
    const proposal: AssistantProposalRecord = {
      proposalId: 'assistant-proposal:goal:1', kind: 'create_financial_goal', status: 'confirmed',
      createdAt: '2026-08-02T10:00:00.000Z', sourceText: 'Quiero ahorrar', missingRequiredFields: [],
      fields: { goalType: 'saving', name: 'Ahorro mensual', targetAmount: 300, currency: 'EUR', period: 'monthly', startDate: '2026-08-01', endDate: '2026-08-31' },
    }
    expect(await executeAssistantProposal(proposal)).toEqual({ ok: true, recordId: 'goal-created' })
    expect(createFinancialGoalMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'saving', targetAmount: 300 }))
  })
})

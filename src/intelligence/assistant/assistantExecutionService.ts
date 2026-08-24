import { convertCurrencyToEurCop } from '../../services/currencyConversionService'
import { createAppointment } from '../../services/appointmentService'
import { createExpense } from '../../services/expenseService'
import { createServiceIncome } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import { markIncomeAsReported } from '../../services/incomeReport.service'
import { financialGoalService } from '../../services/financialGoalService'
import { exportCopilotPeriodReport } from '../../services/copilotReportExportService'
import { createDefaultAppointmentReminders } from '../../utils/appointmentReminders'
import { calculateStoredRealGain } from '../../utils/realGain'
import { recordAssistantAudit } from './assistantAuditLog'
import { assertProposalReadyForExecution } from './assistantExecutionGuard'
import type { AssistantProposalRecord } from './assistantProposalContracts'

export interface AssistantExecutionSuccess {
  readonly ok: true
  readonly recordId: number | string
}

export interface AssistantExecutionFailure {
  readonly ok: false
  readonly safeMessage: string
}

export type AssistantExecutionResult = AssistantExecutionSuccess | AssistantExecutionFailure

/**
 * Único punto de guardado del flujo de propuestas. Reutiliza exactamente los
 * mismos servicios de dominio que usan los formularios (incomeService,
 * expenseService, appointmentService) — nunca escribe en Dexie de forma
 * directa ni duplica sus reglas de validación (temporada activa, ajustes,
 * etc.), que siguen siendo la única fuente de verdad. El Execution Guard se
 * evalúa aquí, inmediatamente antes de llamar al servicio real, para que sea
 * imposible ejecutar sin pasar por él.
 */
export async function executeAssistantProposal(
  proposal: AssistantProposalRecord,
): Promise<AssistantExecutionResult> {
  const guardResult = assertProposalReadyForExecution(proposal)
  if (!guardResult.ok) {
    recordAssistantAudit({
      timestamp: new Date().toISOString(),
      proposalId: proposal.proposalId,
      kind: proposal.kind,
      status: 'failed',
      failureCode: guardResult.code,
    })
    return { ok: false, safeMessage: guardResult.safeMessage }
  }

  try {
    const recordId = await executeByKind(proposal)
    recordAssistantAudit({
      timestamp: new Date().toISOString(),
      proposalId: proposal.proposalId,
      kind: proposal.kind,
      status: 'completed',
      ...(typeof recordId === 'number' ? { executedRecordId: recordId } : {}),
    })
    return { ok: true, recordId }
  } catch (error) {
    recordAssistantAudit({
      timestamp: new Date().toISOString(),
      proposalId: proposal.proposalId,
      kind: proposal.kind,
      status: 'failed',
      failureCode: 'DOMAIN_SERVICE_REJECTED',
    })
    return {
      ok: false,
      safeMessage: error instanceof Error ? error.message : 'No se pudo completar la operación.',
    }
  }
}

async function executeByKind(proposal: AssistantProposalRecord): Promise<number | string> {
  if (proposal.kind === 'mark_income_reported') {
    const incomeId = proposal.fields.incomeId as number
    await markIncomeAsReported(incomeId)
    return incomeId
  }

  if (proposal.kind === 'generate_report') {
    return exportCopilotPeriodReport({
      periodStart: proposal.fields.periodStart as string,
      periodEnd: proposal.fields.periodEnd as string,
    })
  }

  if (proposal.kind === 'create_financial_goal') {
    const fields = proposal.fields
    const goal = await financialGoalService.create({
      type: fields.goalType as 'saving' | 'expense_limit' | 'income_target',
      name: fields.name as string,
      targetAmount: fields.targetAmount as number,
      currency: fields.currency as NonNullable<typeof fields.currency>,
      period: fields.period,
      startDate: fields.startDate as string,
      ...(fields.endDate === null ? {} : { endDate: fields.endDate }),
    })
    return goal.id
  }

  const settings = await getSettings()

  if (proposal.kind === 'register_income') {
    const { amount, currency, date } = proposal.fields
    const totalAmount = amount as number
    const resolvedCurrency = (currency ?? settings.defaultCurrency)
    const { eurValue, copValue, eurCopRate } = await convertCurrencyToEurCop(totalAmount, resolvedCurrency)
    const realGain = calculateStoredRealGain({
      totalAmount,
      percentage: 0,
      usageMode: settings.usageMode,
      incomeType: 'otro',
    })

    return createServiceIncome({
      type: 'otro',
      date: date as string,
      duration: 0,
      totalAmount,
      currency: resolvedCurrency,
      percentage: 0,
      realGain,
      eurValue,
      copValue,
      exchangeRateUsed: eurCopRate,
      notes: 'Registrado por el Asistente',
    })
  }

  if (proposal.kind === 'register_expense') {
    const { amount, currency, date, category } = proposal.fields
    const totalAmount = amount as number
    const resolvedCurrency = (currency ?? settings.defaultCurrency)
    const { eurValue, copValue } = await convertCurrencyToEurCop(totalAmount, resolvedCurrency)

    return createExpense({
      type: 'gasto',
      date: date as string,
      category: (category as string) ?? 'General',
      amount: totalAmount,
      currency: resolvedCurrency,
      eurValue,
      copValue,
    })
  }

  const { date, time, durationMinutes, expectedAmount, currency } = proposal.fields
  const resolvedCurrency = (currency ?? settings.defaultCurrency)

  return createAppointment({
    dateTime: `${date}T${time}`,
    duration: durationMinutes ?? 60,
    expectedAmount: expectedAmount as number,
    currency: resolvedCurrency,
    reminders: createDefaultAppointmentReminders(),
    completed: false,
  })
}

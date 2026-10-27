import { createAppointment } from '../../services/appointmentService'
import { createExpense, getExpenseByAssistantProposalId } from '../../services/expenseService'
import { createServiceIncome, getServiceIncomeByAssistantProposalId } from '../../services/incomeService'
import {
  FINANCIAL_QUOTE_UNAVAILABLE,
  prepareFinancialConversionSnapshot,
} from '../../services/financialConversionSnapshotService'
import { getSettings } from '../../services/settingsService'
import { markIncomeAsReported } from '../../services/incomeReport.service'
import { financialGoalService } from '../../services/financialGoalService'
import { exportCopilotPeriodReport } from '../../services/copilotReportExportService'
import { createDefaultAppointmentReminders } from '../../utils/appointmentReminders'
import { calculateStoredRealGain } from '../../utils/realGain'
import { resolveActiveUsageMode } from '../../utils/usageMode'
import { FINANCIAL_CONVERSION_INCOMPLETE } from '../../utils/financialConversionValidation'
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
      safeMessage: error instanceof Error && (
        error.message === FINANCIAL_QUOTE_UNAVAILABLE ||
        error.message === FINANCIAL_CONVERSION_INCOMPLETE
      )
        ? 'No se registró el movimiento porque falta una cotización válida para esa fecha y esas monedas. Conéctate para obtenerla o guarda primero una tasa manual y vuelve a confirmar.'
        : error instanceof Error
          ? error.message
          : 'No se pudo completar la operación.',
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
    const existing = await getServiceIncomeByAssistantProposalId(proposal.proposalId)
    if (existing?.id !== undefined) return existing.id
    const { amount, currency, date } = proposal.fields
    const totalAmount = amount as number
    const resolvedCurrency = (currency ?? settings.defaultCurrency)
    const realGain = calculateStoredRealGain({
      totalAmount,
      percentage: 0,
      usageMode: resolveActiveUsageMode(settings),
      incomeType: 'otro',
    })
    const conversion = await prepareFinancialConversionSnapshot({
      amount: realGain,
      currency: resolvedCurrency,
      date: date as string,
      settings,
    })

    return createServiceIncome({
      assistantProposalId: proposal.proposalId,
      type: 'otro',
      date: date as string,
      duration: 0,
      totalAmount,
      currency: resolvedCurrency,
      percentage: 0,
      realGain,
      eurValue: conversion.eurValue,
      copValue: conversion.copValue,
      exchangeRateUsed: conversion.exchangeRateUsed,
      baseCurrency: conversion.baseCurrency,
      secondaryCurrency: conversion.secondaryCurrency,
      baseCurrencyValue: conversion.baseCurrencyValue,
      secondaryCurrencyValue: conversion.secondaryCurrencyValue,
      exchangeRateBaseToSecondary: conversion.exchangeRateBaseToSecondary,
      seasonStayId: proposal.fields.seasonStayId,
      travelDestination: proposal.fields.travelDestination,
      notes: proposal.fields.description?.trim() || 'Registrado por el Asistente',
    })
  }

  if (proposal.kind === 'register_expense') {
    const existing = await getExpenseByAssistantProposalId(proposal.proposalId)
    if (existing?.id !== undefined) return existing.id
    const { amount, currency, date, category } = proposal.fields
    const totalAmount = amount as number
    const resolvedCurrency = (currency ?? settings.defaultCurrency)
    const conversion = await prepareFinancialConversionSnapshot({
      amount: totalAmount,
      currency: resolvedCurrency,
      date: date as string,
      settings,
    })

    return createExpense({
      assistantProposalId: proposal.proposalId,
      type: 'gasto',
      date: date as string,
      category: (category as string) ?? 'General',
      amount: totalAmount,
      currency: resolvedCurrency,
      eurValue: conversion.eurValue,
      copValue: conversion.copValue,
      baseCurrency: conversion.baseCurrency,
      secondaryCurrency: conversion.secondaryCurrency,
      baseCurrencyValue: conversion.baseCurrencyValue,
      secondaryCurrencyValue: conversion.secondaryCurrencyValue,
      exchangeRateBaseToSecondary: conversion.exchangeRateBaseToSecondary,
      exchangeRateUsed: conversion.exchangeRateUsed,
      eurCopExchangeRateUsed: conversion.eurCopExchangeRateUsed,
      seasonStayId: proposal.fields.seasonStayId,
      travelDestination: proposal.fields.travelDestination,
      notes: 'Registrado por el Asistente',
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

import type { AssistantProposalRecord } from './assistantProposalContracts'

export type AssistantExecutionGuardFailureCode =
  | 'NOT_CONFIRMED'
  | 'MISSING_REQUIRED_FIELDS'
  | 'INVALID_AMOUNT'
  | 'INVALID_DATE'
  | 'INVALID_TIME'

export interface AssistantExecutionGuardFailure {
  readonly ok: false
  readonly code: AssistantExecutionGuardFailureCode
  readonly safeMessage: string
}

export interface AssistantExecutionGuardSuccess {
  readonly ok: true
}

export type AssistantExecutionGuardResult =
  | AssistantExecutionGuardSuccess
  | AssistantExecutionGuardFailure

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^\d{2}:\d{2}$/

/**
 * Última barrera antes de tocar un servicio de dominio: impide guardar sin
 * confirmar, con campos incompletos o con datos con forma inválida. No
 * repite las reglas de negocio de cada servicio (temporada activa, etc.) —
 * esas las sigue aplicando el propio servicio real, que es la única fuente
 * de verdad; esto solo evita llamarlo con una propuesta que nunca debería
 * ejecutarse.
 */
export function assertProposalReadyForExecution(
  proposal: AssistantProposalRecord,
): AssistantExecutionGuardResult {
  if (proposal.status !== 'confirmed') {
    return {
      ok: false,
      code: 'NOT_CONFIRMED',
      safeMessage: 'La propuesta no ha sido confirmada por el usuario.',
    }
  }

  if (proposal.missingRequiredFields.length > 0) {
    return {
      ok: false,
      code: 'MISSING_REQUIRED_FIELDS',
      safeMessage: `Faltan campos obligatorios: ${proposal.missingRequiredFields.join(', ')}.`,
    }
  }

  if (proposal.kind === 'register_income' || proposal.kind === 'register_expense') {
    const { amount, date } = proposal.fields
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return { ok: false, code: 'INVALID_AMOUNT', safeMessage: 'El importe debe ser un número mayor que cero.' }
    }
    if (typeof date !== 'string' || !ISO_DATE_PATTERN.test(date)) {
      return { ok: false, code: 'INVALID_DATE', safeMessage: 'La fecha no tiene un formato válido.' }
    }
    return { ok: true }
  }

  if (proposal.kind === 'mark_income_reported') {
    return typeof proposal.fields.incomeId === 'number' && Number.isSafeInteger(proposal.fields.incomeId)
      ? { ok: true }
      : { ok: false, code: 'MISSING_REQUIRED_FIELDS', safeMessage: 'Selecciona un ingreso válido.' }
  }

  if (proposal.kind === 'generate_report') {
    const { periodStart, periodEnd, format } = proposal.fields
    if (typeof periodStart !== 'string' || typeof periodEnd !== 'string' || !ISO_DATE_PATTERN.test(periodStart) || !ISO_DATE_PATTERN.test(periodEnd) || periodEnd < periodStart) {
      return { ok: false, code: 'INVALID_DATE', safeMessage: 'El periodo del reporte no es válido.' }
    }
    return format === 'pdf'
      ? { ok: true }
      : { ok: false, code: 'MISSING_REQUIRED_FIELDS', safeMessage: 'Selecciona un formato compatible.' }
  }

  if (proposal.kind === 'create_financial_goal') {
    const { targetAmount, startDate, endDate, goalType, name } = proposal.fields
    if (typeof targetAmount !== 'number' || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      return { ok: false, code: 'INVALID_AMOUNT', safeMessage: 'El importe objetivo debe ser mayor que cero.' }
    }
    if (typeof startDate !== 'string' || !ISO_DATE_PATTERN.test(startDate) || (endDate !== null && (!ISO_DATE_PATTERN.test(endDate) || endDate < startDate))) {
      return { ok: false, code: 'INVALID_DATE', safeMessage: 'El periodo del objetivo no es válido.' }
    }
    return goalType !== null && typeof name === 'string' && name.trim().length > 0
      ? { ok: true }
      : { ok: false, code: 'MISSING_REQUIRED_FIELDS', safeMessage: 'Faltan datos obligatorios del objetivo.' }
  }

  const { date, time, expectedAmount } = proposal.fields
  if (typeof date !== 'string' || !ISO_DATE_PATTERN.test(date)) {
    return { ok: false, code: 'INVALID_DATE', safeMessage: 'La fecha no tiene un formato válido.' }
  }
  if (typeof time !== 'string' || !TIME_PATTERN.test(time)) {
    return { ok: false, code: 'INVALID_TIME', safeMessage: 'La hora no tiene un formato válido.' }
  }
  if (typeof expectedAmount !== 'number' || !Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', safeMessage: 'El importe esperado debe ser un número mayor que cero.' }
  }

  return { ok: true }
}

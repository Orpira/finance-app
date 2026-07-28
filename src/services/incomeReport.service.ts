import { db } from '../database/db'
import {
  markAsPending,
  markAsReported,
  type MarkAsReportedOptions,
} from '../catalogs/reportStatuses'
import { updateServiceIncome } from './incomeService'
import { getActiveEarningPeriod } from './earningPeriodService'
import { getSettings } from './settingsService'
import { assertCanMarkAsReported, canMarkAsReported } from '../utils/reportStatus'
import { getStoredIncomeValue } from '../utils/financeStats'
import { recordBelongsToUsageMode } from '../utils/usageMode'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'

export type MarkIncomeAsReportedInput = MarkAsReportedOptions

export interface PendingIncomeSummary {
  count: number
  totalBaseCurrency: number
  baseCurrency: CurrencyCode
  oldestPendingDate: string | null
  overdueCount: number
}

export interface BulkMarkIncomesAsReportedResult {
  succeeded: number[]
  failed: Array<{ id: number; error: string }>
}

/** Un ingreso pendiente sin reportar por más de este número de días entra en el conteo de vencidos. */
export const PENDING_INCOME_OVERDUE_AFTER_DAYS = 7

async function getIncomeOrThrow(id: number) {
  const income = await db.services.get(id)

  if (!income) {
    throw new Error('El ingreso que intentas actualizar no existe.')
  }

  return income
}

function applyReportFields(nextRecord: ServiceIncome) {
  return {
    reportStatusCode: nextRecord.reportStatusCode,
    reportStatusLabel: nextRecord.reportStatusLabel,
    reportedAt: nextRecord.reportedAt,
    reportReference: nextRecord.reportReference,
    reportNotes: nextRecord.reportNotes,
  }
}

export async function markIncomeAsReported(
  id: number,
  input: MarkIncomeAsReportedInput = {},
) {
  const settings = await getSettings()
  const income = await getIncomeOrThrow(id)

  assertCanMarkAsReported(income, settings.usageMode)

  return updateServiceIncome(id, applyReportFields(markAsReported(income, input)))
}

export async function markIncomeAsPending(id: number) {
  const settings = await getSettings()
  const income = await getIncomeOrThrow(id)

  assertCanMarkAsReported(income, settings.usageMode)

  return updateServiceIncome(id, applyReportFields(markAsPending(income)))
}

export async function markMultipleIncomesAsReported(
  ids: number[],
  input: MarkIncomeAsReportedInput = {},
): Promise<BulkMarkIncomesAsReportedResult> {
  const succeeded: number[] = []
  const failed: Array<{ id: number; error: string }> = []

  for (const id of ids) {
    try {
      await markIncomeAsReported(id, input)
      succeeded.push(id)
    } catch (error: unknown) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : 'No se pudo marcar como reportado.',
      })
    }
  }

  return { succeeded, failed }
}

/**
 * Ingresos que aún no han sido reportados ("sin revisar" o "pendiente"), ordenados
 * por serviceDate ascendente (el más antiguo primero).
 *
 * Se limita a la temporada activa: los ingresos de temporadas anteriores (cerradas)
 * ya no cuentan como pendientes de reportar en el resumen de Inicio.
 */
export async function getPendingIncomes(): Promise<ServiceIncome[]> {
  const [settings, activePeriod, incomes] = await Promise.all([
    getSettings(),
    getActiveEarningPeriod(),
    db.services.toArray(),
  ])

  return incomes
    .filter(
      (income) =>
        recordBelongsToUsageMode(income, settings.usageMode) &&
        canMarkAsReported(income, settings.usageMode) &&
        income.reportStatusCode !== 'reported' &&
        activePeriod?.id !== undefined &&
        (income.earningPeriodId === activePeriod.id ||
          income.seasonPeriodId === activePeriod.id),
    )
    .sort((first, second) => first.date.localeCompare(second.date))
}

export async function getPendingIncomeSummary(): Promise<PendingIncomeSummary> {
  const settings = await getSettings()
  const baseCurrency = settings.defaultCurrency
  const pendingIncomes = await getPendingIncomes()
  const now = Date.now()

  const overdueCount = pendingIncomes.filter((income) => {
    const serviceDateMs = new Date(`${income.date}T00:00:00`).getTime()
    const ageInDays = (now - serviceDateMs) / (1000 * 60 * 60 * 24)

    return ageInDays > PENDING_INCOME_OVERDUE_AFTER_DAYS
  }).length

  return {
    count: pendingIncomes.length,
    totalBaseCurrency: pendingIncomes.reduce(
      (total, income) => total + getStoredIncomeValue(income, baseCurrency),
      0,
    ),
    baseCurrency,
    oldestPendingDate: pendingIncomes[0]?.date ?? null,
    overdueCount,
  }
}

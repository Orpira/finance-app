import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { ServiceIncome } from '../types/service'
import type { CountryCode } from '../types/settings'
import {
  assertRecordIsMutable,
  getActiveEarningPeriod,
} from './earningPeriodService'
import { getSettings } from './settingsService'
import { recordBelongsToUsageMode, requiresSeason } from '../utils/usageMode'
import { assertAllExpenseAdjustmentsAreValid } from '../utils/expenseAdjustments'
import {
  isAdjustmentIncome,
  isServiceIncome,
  normalizeAdjustmentIncome,
} from '../utils/incomeTypes'
import {
  createAutomationOutboxRecord,
  enqueueAutomationEvent,
  scheduleAutomationOutboxFlush,
} from './automationOutboxService'
import { buildInitialServiceTimerState } from './serviceTimerService'
import {
  assertRecordIsNotReported,
  assertReportedRecordUpdateIsAllowed,
  normalizeReportStatus,
} from '../catalogs/reportStatuses'
import { assertReportStatusUpdateIsAllowed } from '../utils/reportStatus'

export type CreateServiceIncomeInput = Omit<ServiceIncome, 'id'>
export type UpdateServiceIncomeInput = Partial<CreateServiceIncomeInput>

export interface ServiceIncomeListOptions extends DateRangeListOptions {
  country?: CountryCode
  city?: string
  earningPeriodId?: number
  paymentType?: string
}

function normalizeIncomeByType<T extends CreateServiceIncomeInput>(input: T): T {
  if (!isAdjustmentIncome(input)) return input
  return normalizeAdjustmentIncome(input)
}

export async function createServiceIncome(input: CreateServiceIncomeInput) {
  const settings = await getSettings()
  const earningPeriod =
    requiresSeason(settings) ? await getActiveEarningPeriod() : undefined

  if (requiresSeason(settings) && !earningPeriod) {
    throw new Error('No hay una temporada activa. Crea una temporada para registrar actividad.')
  }

  const normalizedInput = normalizeIncomeByType(input)

  const createdAt = new Date().toISOString()
  const incomeBase: ServiceIncome = normalizeReportStatus({
    createdAt,
    status: 'PENDIENTE',
    ...normalizedInput,
    type: normalizedInput.type ?? 'ingreso',
    usageMode: settings.usageMode,
    earningPeriodId: earningPeriod?.id,
    seasonPeriodId: earningPeriod?.id,
    earningPercentage: isServiceIncome(normalizedInput)
      ? earningPeriod?.percentage ??
        normalizedInput.earningPercentage ??
        normalizedInput.percentage
      : 0,
    percentage: isServiceIncome(normalizedInput)
      ? earningPeriod?.percentage ?? normalizedInput.percentage
      : 0,
  })
  const income: ServiceIncome = {
    ...incomeBase,
    ...buildInitialServiceTimerState(incomeBase, createdAt),
  }
  const incomeId = await db.transaction('rw', [db.services, db.automationOutbox], async () => {
    const nextIncomeId = await db.services.add(income)
    await enqueueAutomationEvent(
      createAutomationOutboxRecord('income.created', {
        income: { ...income, id: nextIncomeId },
      }),
    )
    return nextIncomeId
  })
  scheduleAutomationOutboxFlush()

  return incomeId
}

export async function getServiceIncomeById(id: number) {
  const income = await db.services.get(id)
  return income ? normalizeReportStatus(income) : income
}

export async function listServiceIncomes(options: ServiceIncomeListOptions = {}) {
  const {
    from,
    to,
    newestFirst = true,
    country,
    city,
    earningPeriodId,
    paymentType,
  } = options
  const lowerBound = from ?? ''
  const upperBound = to ?? '\uffff'
  const collection =
    from || to
      ? db.services.where('date').between(lowerBound, upperBound, true, true)
      : db.services.orderBy('date')

  if (newestFirst) {
    collection.reverse()
  }

  const items = await collection.toArray()
  
  // Filter by country if specified
  let filtered = items

  if (country) {
    filtered = filtered.filter((item) => item.country === country)
  }

  if (city) {
    filtered = filtered.filter((item) => item.city === city)
  }

  if (earningPeriodId !== undefined) {
    filtered = filtered.filter((item) => item.earningPeriodId === earningPeriodId)
  }

  if (paymentType) {
    filtered = filtered.filter((item) => item.paymentType === paymentType)
  }

  return filtered.map((item) => normalizeReportStatus(item))
}

export async function updateServiceIncome(
  id: number,
  updates: UpdateServiceIncomeInput,
) {
  const settings = await getSettings()
  const currentIncome = await db.services.get(id)
  if (
    !currentIncome ||
    !recordBelongsToUsageMode(currentIncome, settings.usageMode)
  ) {
    throw new Error('Este ingreso pertenece a otro modo de uso.')
  }
  assertReportStatusUpdateIsAllowed(currentIncome, settings.usageMode, updates)
  assertReportedRecordUpdateIsAllowed(currentIncome, updates)
  if (requiresSeason(settings)) {
    await assertRecordIsMutable(currentIncome)
  }
  return db.transaction('rw', [db.services, db.expenses], async () => {
    const [latestIncome, incomes, expenses] = await Promise.all([
      db.services.get(id),
      db.services.toArray(),
      db.expenses.toArray(),
    ])
    if (!latestIncome) throw new Error('El ingreso que intentas modificar no existe.')
    assertReportStatusUpdateIsAllowed(latestIncome, settings.usageMode, updates)
    assertReportedRecordUpdateIsAllowed(latestIncome, updates)

    const updatedIncome = normalizeIncomeByType(
      normalizeReportStatus({
        ...latestIncome,
        ...updates,
        usageMode: latestIncome.usageMode ?? settings.usageMode,
      }),
    )
    const updatedIncomes = incomes.map((income) =>
      income.id === id ? updatedIncome : income,
    )
    assertAllExpenseAdjustmentsAreValid(updatedIncomes, expenses)
    await db.services.put(updatedIncome)
    return updatedIncome
  })
}

export async function deleteServiceIncome(id: number) {
  const settings = await getSettings()
  const currentIncome = await db.services.get(id)
  if (
    !currentIncome ||
    !recordBelongsToUsageMode(currentIncome, settings.usageMode)
  ) {
    throw new Error('Este ingreso pertenece a otro modo de uso.')
  }
  assertRecordIsNotReported(currentIncome)
  if (requiresSeason(settings)) {
    await assertRecordIsMutable(currentIncome)
  }
  return db.transaction('rw', [db.services, db.expenses], async () => {
    assertRecordIsNotReported(await db.services.get(id))
    const linkedAdjustment = await db.expenses
      .where('relatedIncomeId')
      .equals(id)
      .and((expense) => expense.type === 'ajuste')
      .first()
    if (linkedAdjustment) {
      throw new Error(
        'No puedes eliminar un ingreso que tiene ajustes relacionados. Elimina primero sus ajustes.',
      )
    }
    return db.services.delete(id)
  })
}

import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { ServiceIncome } from '../types/service'
import type { CountryCode } from '../types/settings'
import { shouldCollectPaymentTypeAtRegistration } from '../catalogs/incomeCalculationMethods'
import {
  assertRecordIsMutable,
  getActiveEarningPeriod,
  getEarningPeriodById,
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

export const INCOME_BEFORE_SEASON_START_MESSAGE =
  'La fecha del ingreso no puede ser anterior al inicio de la temporada.'
export const INCOME_SEASON_REQUIRED_MESSAGE =
  'No se puede modificar el ingreso porque su temporada no existe.'
export const INCOME_SEASON_CHANGE_MESSAGE =
  'No se puede cambiar la temporada de un ingreso existente.'

function assertIncomeIsNotBeforeSeasonStart(
  incomeDate: string,
  earningPeriod?: { startDate: string },
) {
  if (earningPeriod && incomeDate < earningPeriod.startDate.slice(0, 10)) {
    throw new Error(INCOME_BEFORE_SEASON_START_MESSAGE)
  }
}

function normalizeIncomeByType<T extends CreateServiceIncomeInput>(input: T): T {
  if (!isAdjustmentIncome(input)) return input
  return normalizeAdjustmentIncome(input)
}

function normalizePaymentTypeForMethod<T extends CreateServiceIncomeInput>(input: T): T {
  if (shouldCollectPaymentTypeAtRegistration(input.incomeCalculationMethod ?? 'service_duration')) {
    return input
  }
  // "Jornada por horas" no solicita el tipo de pago en el formulario, pero se
  // persiste "Efectivo" por defecto para que listados y reportes por tipo de
  // pago no traten la jornada como un caso especial sin tipo de pago.
  return { ...input, paymentType: input.paymentType ?? 'cash' }
}

export async function createServiceIncome(input: CreateServiceIncomeInput) {
  const settings = await getSettings()
  const normalizedInput = normalizePaymentTypeForMethod(normalizeIncomeByType(input))
  const incomeId = await db.transaction(
    'rw',
    [db.services, db.automationOutbox, db.earningPeriods],
    async () => {
      const earningPeriod =
        requiresSeason(settings) ? await getActiveEarningPeriod() : undefined

      if (requiresSeason(settings) && !earningPeriod) {
        throw new Error('No hay una temporada activa. Crea una temporada para registrar actividad.')
      }

      assertIncomeIsNotBeforeSeasonStart(input.date, earningPeriod)

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
        incomeCalculationMethod: normalizedInput.incomeCalculationMethod ?? 'service_duration',
        updatedAt: createdAt,
      })
      const income: ServiceIncome = {
        ...incomeBase,
        ...buildInitialServiceTimerState(incomeBase, createdAt),
      }
      const nextIncomeId = await db.services.add(income)
      await enqueueAutomationEvent(
        createAutomationOutboxRecord('income.created', {
          income: { ...income, id: nextIncomeId },
        }),
      )
      return nextIncomeId
    },
  )
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
  return db.transaction('rw', [db.services, db.expenses, db.earningPeriods], async () => {
    const [latestIncome, incomes, expenses] = await Promise.all([
      db.services.get(id),
      db.services.toArray(),
      db.expenses.toArray(),
    ])
    if (!latestIncome) throw new Error('El ingreso que intentas modificar no existe.')
    if (!recordBelongsToUsageMode(latestIncome, settings.usageMode)) {
      throw new Error('Este ingreso pertenece a otro modo de uso.')
    }
    assertReportStatusUpdateIsAllowed(latestIncome, settings.usageMode, updates)
    assertReportedRecordUpdateIsAllowed(latestIncome, updates)
    if (requiresSeason(settings)) {
      await assertRecordIsMutable(latestIncome)
      const earningPeriodId = latestIncome.earningPeriodId ?? latestIncome.seasonPeriodId
      if (
        !earningPeriodId ||
        (latestIncome.earningPeriodId !== undefined &&
          latestIncome.seasonPeriodId !== undefined &&
          latestIncome.earningPeriodId !== latestIncome.seasonPeriodId)
      ) {
        throw new Error(INCOME_SEASON_REQUIRED_MESSAGE)
      }
      if (
        (Object.hasOwn(updates, 'earningPeriodId') && updates.earningPeriodId !== earningPeriodId) ||
        (Object.hasOwn(updates, 'seasonPeriodId') && updates.seasonPeriodId !== earningPeriodId)
      ) {
        throw new Error(INCOME_SEASON_CHANGE_MESSAGE)
      }
      const earningPeriod = await getEarningPeriodById(earningPeriodId)
      if (!earningPeriod) {
        throw new Error(INCOME_SEASON_REQUIRED_MESSAGE)
      }
      assertIncomeIsNotBeforeSeasonStart(
        updates.date ?? latestIncome.date,
        earningPeriod,
      )
    }

    // El método de cálculo es inmutable una vez creado el ingreso (PB-IS-0007,
    // sección 9): editar Configuración nunca debe alterar ingresos históricos.
    const safeUpdates: UpdateServiceIncomeInput = { ...updates }
    delete safeUpdates.incomeCalculationMethod
    // El tipo de pago se puede modificar al editar, en "Jornada por horas"
    // igual que en "Servicio por tiempo"; si no se envía, se conserva el
    // valor existente en vez de borrarlo.
    if (safeUpdates.paymentType === undefined) {
      delete safeUpdates.paymentType
    }

    const updatedIncome = normalizeIncomeByType(
      normalizeReportStatus({
        ...latestIncome,
        ...safeUpdates,
        usageMode: latestIncome.usageMode ?? settings.usageMode,
        updatedAt: new Date().toISOString(),
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
  return db.transaction('rw', [db.services, db.expenses, db.incomeAdditionals], async () => {
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
    // Los Adicionales no son un movimiento financiero independiente (PB-IS-0007,
    // 16): se borran en cascada con el ingreso, a diferencia de los ajustes.
    await db.incomeAdditionals.where('incomeId').equals(id).delete()
    return db.services.delete(id)
  })
}

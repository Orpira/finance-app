import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { ServiceIncome } from '../types/service'
import type { CountryCode } from '../types/settings'
import {
  assertRecordIsMutable,
  getActiveEarningPeriod,
} from './earningPeriodService'
import { getSettings } from './settingsService'

export type CreateServiceIncomeInput = Omit<ServiceIncome, 'id'>
export type UpdateServiceIncomeInput = Partial<CreateServiceIncomeInput>

export interface ServiceIncomeListOptions extends DateRangeListOptions {
  country?: CountryCode
  city?: string
  earningPeriodId?: number
  paymentType?: string
}

export async function createServiceIncome(input: CreateServiceIncomeInput) {
  const settings = await getSettings()
  const earningPeriod =
    settings.userType === 'primary' ? await getActiveEarningPeriod() : undefined

  if (settings.userType === 'primary' && !earningPeriod) {
    throw new Error('No hay una temporada activa. Crea una temporada para registrar actividad.')
  }

  return db.services.add({
    createdAt: new Date().toISOString(),
    status: 'PENDIENTE',
    ...input,
    earningPeriodId: earningPeriod?.id,
    seasonPeriodId: earningPeriod?.id,
    earningPercentage:
      earningPeriod?.percentage ?? input.earningPercentage ?? input.percentage,
    percentage: earningPeriod?.percentage ?? input.percentage,
  })
}

export async function getServiceIncomeById(id: number) {
  return db.services.get(id)
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

  return filtered
}

export async function updateServiceIncome(
  id: number,
  updates: UpdateServiceIncomeInput,
) {
  await assertRecordIsMutable(await db.services.get(id))
  await db.services.update(id, updates)
  return db.services.get(id)
}

export async function deleteServiceIncome(id: number) {
  await assertRecordIsMutable(await db.services.get(id))
  return db.services.delete(id)
}

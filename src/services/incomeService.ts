import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { ServiceIncome } from '../types/service'
import type { CountryCode } from '../types/settings'
import { ensureActiveEarningPeriod } from './earningPeriodService'

export type CreateServiceIncomeInput = Omit<ServiceIncome, 'id'>
export type UpdateServiceIncomeInput = Partial<CreateServiceIncomeInput>

export interface ServiceIncomeListOptions extends DateRangeListOptions {
  country?: CountryCode
  city?: string
  earningPeriodId?: number
  paymentType?: string
}

export async function createServiceIncome(input: CreateServiceIncomeInput) {
  const earningPeriod =
    input.earningPeriodId === undefined
      ? await ensureActiveEarningPeriod()
      : undefined

  return db.services.add({
    createdAt: new Date().toISOString(),
    status: 'PENDIENTE',
    ...input,
    earningPeriodId: earningPeriod?.id ?? input.earningPeriodId,
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
  await db.services.update(id, updates)
  return db.services.get(id)
}

export function deleteServiceIncome(id: number) {
  return db.services.delete(id)
}

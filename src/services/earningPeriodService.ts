import { DEFAULT_SETTINGS_ID, createDefaultSettings, db } from '../database/db'
import type { Appointment } from '../types/appointment'
import type { EarningPeriod } from '../types/earningPeriod'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { AppSettings, CountryCode, CurrencyCode } from '../types/settings'

export const NO_ACTIVE_SEASON_MESSAGE =
  'No hay una temporada activa. Crea una temporada para registrar actividad.'
export const CLOSED_SEASON_MESSAGE =
  'Este registro pertenece a una temporada cerrada y está disponible solo para consulta.'

export interface CreateSeasonInput {
  name: string
  city: string
  country: string
  countryCode: CountryCode
  baseCurrency: CurrencyCode
  earningPercentage: number
  startDate: string
  notes?: string
}

export interface SeasonStatistics {
  grossIncome: number
  realGain: number
  expenses: number
  adjustments: number
  netGain: number
  bestDay?: { date: string; amount: number }
  serviceCount: number
  appointmentCount: number
  completedAppointmentCount: number
  servicesByDay: Array<{ date: string; count: number; amount: number }>
  expensesByCategory: Array<{ category: string; amount: number }>
}

async function getSettingsForPeriod(settings?: AppSettings) {
  if (settings) return settings
  const stored = await db.settings.get(DEFAULT_SETTINGS_ID)
  return {
    ...createDefaultSettings(),
    ...stored,
    id: DEFAULT_SETTINGS_ID as AppSettings['id'],
  }
}

function recordPeriodId(record: { earningPeriodId?: number; seasonPeriodId?: number }) {
  return record.earningPeriodId ?? record.seasonPeriodId
}

export async function listEarningPeriods() {
  return db.earningPeriods.orderBy('startDate').reverse().toArray()
}

export async function listClosedEarningPeriods() {
  const periods = await db.earningPeriods.where('status').equals('closed').toArray()
  return periods.sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export function getEarningPeriodById(id: number) {
  return db.earningPeriods.get(id)
}

export async function getActiveEarningPeriod() {
  const active = await db.earningPeriods.where('status').equals('active').toArray()
  return active.sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
}

/** Compatibility helper: it no longer creates empty periods implicitly. */
export async function ensureActiveEarningPeriod(_settings?: AppSettings) {
  const active = await getActiveEarningPeriod()
  if (!active) throw new Error(NO_ACTIVE_SEASON_MESSAGE)
  return active
}

export async function requireActiveEarningPeriod() {
  return ensureActiveEarningPeriod()
}

export async function isEarningPeriodClosed(periodId?: number) {
  if (!periodId) return false
  return (await db.earningPeriods.get(periodId))?.status === 'closed'
}

export async function assertRecordIsMutable(record?: {
  earningPeriodId?: number
  seasonPeriodId?: number
}) {
  if (record && (await isEarningPeriodClosed(recordPeriodId(record)))) {
    throw new Error(CLOSED_SEASON_MESSAGE)
  }
}

export async function seasonHasActivity(periodId: number) {
  const [services, expenses, appointments] = await Promise.all([
    db.services.where('earningPeriodId').equals(periodId).count(),
    db.expenses.where('earningPeriodId').equals(periodId).count(),
    db.appointments.where('earningPeriodId').equals(periodId).count(),
  ])
  return services + expenses + appointments > 0
}

export async function createEarningPeriod(input: CreateSeasonInput) {
  const currentActive = await getActiveEarningPeriod()
  if (currentActive) {
    throw new Error('Ya existe una temporada activa. Debes finalizarla antes de crear una nueva.')
  }
  if (!input.name.trim()) throw new Error('Indica un nombre para la temporada.')
  if (!input.city.trim()) throw new Error('Indica la ciudad de la temporada.')
  if (input.earningPercentage < 0 || input.earningPercentage > 100) {
    throw new Error('El porcentaje debe estar entre 0 y 100.')
  }

  const now = new Date().toISOString()
  const period: Omit<EarningPeriod, 'id'> = {
    name: input.name.trim(),
    percentage: input.earningPercentage,
    startDate: `${input.startDate}T00:00:00.000Z`,
    status: 'active',
    city: input.city.trim(),
    country: input.country,
    countryCode: input.countryCode,
    baseCurrency: input.baseCurrency,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  const settings = await getSettingsForPeriod()
  return db.transaction('rw', db.earningPeriods, db.settings, async () => {
    const id = await db.earningPeriods.add(period)
    await db.settings.put({
      ...settings,
      city: period.city ?? '',
      country: input.countryCode,
      defaultCurrency: input.baseCurrency as AppSettings['defaultCurrency'],
      incomePercentage: input.earningPercentage,
      updatedAt: now,
    })
    return { ...period, id }
  })
}

export async function updateActiveEarningPeriod(
  id: number,
  updates: Pick<EarningPeriod, 'name' | 'notes' | 'percentage'> &
    Partial<Pick<EarningPeriod, 'city' | 'country' | 'countryCode' | 'baseCurrency'>>,
) {
  const period = await db.earningPeriods.get(id)
  if (!period || period.status !== 'active') throw new Error(CLOSED_SEASON_MESSAGE)
  if (updates.percentage !== period.percentage && (await seasonHasActivity(id))) {
    throw new Error('Para cambiar el porcentaje debes cerrar la temporada actual y crear una nueva.')
  }
  const now = new Date().toISOString()
  await db.earningPeriods.update(id, { ...updates, updatedAt: now })
  if (
    updates.percentage !== period.percentage ||
    (updates.city !== undefined && updates.city !== period.city) ||
    (updates.countryCode !== undefined && updates.countryCode !== period.countryCode) ||
    (updates.baseCurrency !== undefined && updates.baseCurrency !== period.baseCurrency)
  ) {
    const settings = await getSettingsForPeriod()
    await db.settings.put({
      ...settings,
      city: updates.city ?? settings.city,
      country: updates.countryCode ?? settings.country,
      defaultCurrency: updates.baseCurrency ?? settings.defaultCurrency,
      incomePercentage: updates.percentage,
      updatedAt: now,
    })
  }
  return db.earningPeriods.get(id)
}

export async function closeActiveEarningPeriod(endDate = new Date().toLocaleDateString('en-CA')) {
  const active = await getActiveEarningPeriod()
  if (!active?.id) throw new Error(NO_ACTIVE_SEASON_MESSAGE)
  const now = new Date().toISOString()
  await db.earningPeriods.update(active.id, {
    status: 'closed',
    endDate: `${endDate}T23:59:59.999Z`,
    closedAt: now,
    updatedAt: now,
  })
  return db.earningPeriods.get(active.id)
}

/** Kept for old callers/backups; explicit season UI should be used for new flows. */
export async function closeActiveEarningPeriodAndCreateNext(
  settings: AppSettings,
  nextPercentage: number,
  nextPeriodName?: string,
) {
  await closeActiveEarningPeriod()
  return createEarningPeriod({
    name: nextPeriodName?.trim() || `Temporada ${new Date().toLocaleDateString('es-ES')}`,
    city: settings.city,
    country: settings.country,
    countryCode: settings.country,
    baseCurrency: settings.defaultCurrency,
    earningPercentage: nextPercentage,
    startDate: new Date().toLocaleDateString('en-CA'),
  })
}

export async function listSeasonRecords(periodId: number) {
  const [incomes, expenses, appointments] = await Promise.all([
    db.services.where('earningPeriodId').equals(periodId).toArray(),
    db.expenses.where('earningPeriodId').equals(periodId).toArray(),
    db.appointments.where('earningPeriodId').equals(periodId).toArray(),
  ])
  return { incomes, expenses, appointments }
}

export async function getSeasonStatistics(periodId: number): Promise<SeasonStatistics> {
  const { incomes, expenses, appointments } = await listSeasonRecords(periodId)
  const grossIncome = incomes.reduce((sum, item) => sum + item.totalAmount, 0)
  const realGain = incomes.reduce((sum, item) => sum + item.realGain, 0)
  const expenseTotal = expenses.filter((item) => item.type !== 'ajuste').reduce((sum, item) => sum + item.amount, 0)
  const adjustments = expenses.filter((item) => item.type === 'ajuste').reduce((sum, item) => sum + item.amount, 0)
  const dayMap = new Map<string, { count: number; amount: number }>()
  incomes.forEach((item) => {
    const value = dayMap.get(item.date) ?? { count: 0, amount: 0 }
    value.count += 1
    value.amount += item.realGain
    dayMap.set(item.date, value)
  })
  const categoryMap = new Map<string, number>()
  expenses.forEach((item) => categoryMap.set(item.category, (categoryMap.get(item.category) ?? 0) + item.amount))
  const servicesByDay = [...dayMap].map(([date, value]) => ({ date, ...value })).sort((a, b) => a.date.localeCompare(b.date))
  const bestDay = [...servicesByDay].sort((a, b) => b.amount - a.amount)[0]
  return {
    grossIncome,
    realGain,
    expenses: expenseTotal,
    adjustments,
    netGain: realGain - expenseTotal + adjustments,
    bestDay: bestDay ? { date: bestDay.date, amount: bestDay.amount } : undefined,
    serviceCount: incomes.length,
    appointmentCount: appointments.length,
    completedAppointmentCount: appointments.filter((item) => item.completed).length,
    servicesByDay,
    expensesByCategory: [...categoryMap].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  }
}

export async function listServiceIncomesByEarningPeriod(periodId: number) {
  return db.services.where('earningPeriodId').equals(periodId).toArray()
}

export async function migrateLegacyRecordsToSeasons() {
  const periods = (await db.earningPeriods.toArray()).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const [services, expenses, appointments] = await Promise.all([
    db.services.toArray(), db.expenses.toArray(), db.appointments.toArray(),
  ])
  if (!periods.length && !services.length && !expenses.length && !appointments.length) return

  let available = periods
  if (!available.length) {
    const settings = await getSettingsForPeriod()
    const dates = [...services.map((x) => x.date), ...expenses.map((x) => x.date), ...appointments.map((x) => x.dateTime.slice(0, 10))].sort()
    const now = new Date().toISOString()
    const id = await db.earningPeriods.add({
      name: 'Temporada inicial migrada', percentage: settings.incomePercentage,
      startDate: `${dates[0] ?? now.slice(0, 10)}T00:00:00.000Z`, status: 'active',
      city: settings.city, country: settings.country, countryCode: settings.country,
      baseCurrency: settings.defaultCurrency, createdAt: now, updatedAt: now,
    })
    available = [(await db.earningPeriods.get(id)) as EarningPeriod]
  }
  const findId = (date: string, current?: number) => current ?? [...available].reverse().find((p) => date >= p.startDate.slice(0, 10) && (!p.endDate || date <= p.endDate.slice(0, 10)))?.id ?? available.at(-1)?.id
  await db.transaction('rw', db.services, db.expenses, db.appointments, async () => {
    await Promise.all([
      db.services.bulkPut(services.map((x: ServiceIncome) => ({ ...x, earningPeriodId: findId(x.date, recordPeriodId(x)), seasonPeriodId: findId(x.date, recordPeriodId(x)) }))),
      db.expenses.bulkPut(expenses.map((x: Expense) => ({ ...x, earningPeriodId: findId(x.date, recordPeriodId(x)), seasonPeriodId: findId(x.date, recordPeriodId(x)) }))),
      db.appointments.bulkPut(appointments.map((x: Appointment) => ({ ...x, earningPeriodId: findId(x.dateTime.slice(0, 10), recordPeriodId(x)), seasonPeriodId: findId(x.dateTime.slice(0, 10), recordPeriodId(x)) }))),
    ])
  })
}

import { DEFAULT_SETTINGS_ID, createDefaultSettings, db } from '../database/db'
import type { Appointment } from '../types/appointment'
import type { EarningPeriod } from '../types/earningPeriod'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { AppSettings, CountryCode, CurrencyCode } from '../types/settings'
import type { SeasonRevision } from '../types/seasonRevision'
import type { SeasonStay } from '../types/seasonStay'
import { normalizeCityName } from '../utils/cityNormalization'
import { isLocalDate, SeasonGeoDomainError } from '../utils/seasonGeoValidation'
import { isBasicMode, recordBelongsToUsageMode } from '../utils/usageMode'
import { isAdjustmentIncome, isServiceIncome } from '../utils/incomeTypes'
import {
  calculateSeasonFinancialResult,
  recordBelongsToEarningPeriod,
  type SeasonFinancialResult,
} from '../utils/financeStats'

export const NO_ACTIVE_SEASON_MESSAGE =
  'No hay una temporada activa. Crea una temporada para registrar actividad.'
export const CLOSED_SEASON_MESSAGE =
  'Este registro pertenece a una temporada cerrada y está disponible solo para consulta.'

export interface CreateSeasonInput {
  name: string
  /** Legacy season-level snapshot. New callers should use firstStay. */
  city?: string
  country: string
  countryCode: CountryCode
  baseCurrency: CurrencyCode
  earningPercentage: number
  startDate: string
  plannedEndDate?: string
  economicGoal?: number
  notes?: string
  firstStay?: {
    city: string
    plannedStartDate?: string
    plannedEndDate?: string
  }
}

export interface SeasonGoalProgress {
  completed: boolean
  exceeded: number
  expenses: number
  goal: number
  netIncome: number
  percentage: number
  remaining: number
  result: number
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

export function getSeasonGoalProgress(
  period: Pick<EarningPeriod, 'economicGoal'>,
  financialResult: SeasonFinancialResult,
): SeasonGoalProgress | null {
  const goal = period.economicGoal

  if (goal === undefined || !Number.isFinite(goal) || goal <= 0) {
    return null
  }

  const percentage = (financialResult.result / goal) * 100

  return {
    completed: financialResult.result >= goal,
    exceeded: Math.max(financialResult.result - goal, 0),
    expenses: financialResult.expenses,
    goal,
    netIncome: financialResult.netIncome,
    percentage,
    remaining: Math.max(goal - financialResult.result, 0),
    result: financialResult.result,
  }
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

/**
 * La temporada inmediatamente anterior a `period` (por startDate), sin
 * importar su status. Se usa para comparativas de Inicio ("vs. temporada
 * anterior"): la temporada activa es la unidad temporal principal en modo
 * profesional, así que la comparación debe ser temporada-contra-temporada,
 * nunca mes-contra-mes.
 */
export async function getPreviousEarningPeriod(
  period: Pick<EarningPeriod, 'id' | 'startDate'>,
) {
  const periods = await listEarningPeriods() // ya ordenadas desc por startDate
  return periods.find(
    (candidate) => candidate.id !== period.id && candidate.startDate < period.startDate,
  )
}

export async function getActiveEarningPeriod() {
  const active = await db.earningPeriods.where('status').equals('active').toArray()
  return active.sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
}

/** Compatibility helper: it no longer creates empty periods implicitly. */
export async function ensureActiveEarningPeriod(_settings?: AppSettings) {
  void _settings
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
  const { incomes, expenses, appointments } = await listSeasonRecords(periodId)
  return incomes.length + expenses.length + appointments.length > 0
}

export async function createEarningPeriod(input: CreateSeasonInput) {
  if (!input.name.trim()) throw new Error('Indica un nombre para la temporada.')
  if (input.earningPercentage < 0 || input.earningPercentage > 100) {
    throw new Error('El porcentaje debe estar entre 0 y 100.')
  }
  if (
    input.plannedEndDate &&
    (Number.isNaN(Date.parse(input.plannedEndDate)) ||
      input.plannedEndDate < input.startDate)
  ) {
    throw new Error('La finalización prevista no puede ser anterior al inicio.')
  }
  if (input.firstStay?.plannedStartDate && !isLocalDate(input.firstStay.plannedStartDate)) {
    throw new Error('La fecha prevista de la primera estancia no es válida.')
  }
  if (input.firstStay?.plannedEndDate && !isLocalDate(input.firstStay.plannedEndDate)) {
    throw new Error('La fecha prevista de la primera estancia no es válida.')
  }
  if (
    input.firstStay?.plannedStartDate && input.firstStay.plannedEndDate &&
    input.firstStay.plannedEndDate < input.firstStay.plannedStartDate
  ) {
    throw new Error('La primera estancia termina antes de empezar.')
  }
  if ((input.firstStay?.plannedStartDate && input.firstStay.plannedStartDate < input.startDate) ||
    (input.plannedEndDate && input.firstStay?.plannedEndDate &&
      input.firstStay.plannedEndDate > input.plannedEndDate)) {
    throw new Error('La primera estancia queda fuera de la temporada.')
  }
  if (
    input.economicGoal !== undefined &&
    (!Number.isFinite(input.economicGoal) || input.economicGoal <= 0)
  ) {
    throw new Error('La meta económica debe ser mayor a cero.')
  }

  const now = new Date().toISOString()
  const period: Omit<EarningPeriod, 'id'> = {
    name: input.name.trim(),
    percentage: input.earningPercentage,
    startDate: `${input.startDate}T00:00:00.000Z`,
    plannedEndDate: input.plannedEndDate
      ? `${input.plannedEndDate}T23:59:59.999Z`
      : undefined,
    economicGoal: input.economicGoal,
    status: 'active',
    city: input.firstStay?.city.trim() || input.city?.trim() || '',
    country: input.country,
    countryCode: input.countryCode,
    baseCurrency: input.baseCurrency,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  }

  const settings = await getSettingsForPeriod()
  return db.transaction(
    'rw',
    [db.earningPeriods, db.settings, db.seasonStays, db.seasonRevisions],
    async () => {
      const currentActive = (await db.earningPeriods.where('status').equals('active').toArray())[0]
      if (currentActive) {
        throw new Error('Ya existe una temporada activa. Debes finalizarla antes de crear una nueva.')
      }
      const id = await db.earningPeriods.add(period)
      let sequence = 0
      const revisions: SeasonRevision[] = []
      if (input.plannedEndDate) {
        revisions.push({
          earningPeriodId: id,
          sequence: ++sequence,
          kind: 'planned_end_date_revised',
          source: 'season_creation',
          previousValue: null,
          nextValue: input.plannedEndDate,
          recordedAt: now,
        })
      }
      if (input.economicGoal !== undefined) {
        sequence += 1
        revisions.push({
          earningPeriodId: id,
          sequence,
          kind: 'economic_goal_revised',
          source: 'season_creation',
          previousValue: null,
          nextValue: input.economicGoal,
          recordedAt: now,
        })
      }
      if (revisions.length) await db.seasonRevisions.bulkAdd(revisions)
      if (input.firstStay) {
        const city = input.firstStay.city.trim().replace(/\s+/g, ' ')
        if (!normalizeCityName(city)) throw new Error('Indica una ciudad válida para la primera estancia.')
        const stay: SeasonStay = {
          earningPeriodId: id,
          position: 0,
          city,
          cityNormalized: normalizeCityName(city),
          countryCode: input.countryCode,
          status: 'planned',
          plannedStartDate: input.firstStay.plannedStartDate,
          plannedEndDate: input.firstStay.plannedEndDate,
          locationSource: 'manual',
          createdAt: now,
          updatedAt: now,
        }
        await db.seasonStays.add(stay)
      }
      await db.settings.put({
        ...settings,
        city: period.city || settings.city,
        country: input.countryCode,
        defaultCurrency: input.baseCurrency as AppSettings['defaultCurrency'],
        incomePercentage: input.earningPercentage,
        updatedAt: now,
      })
      return { ...period, id }
    },
  )
}

export async function updateActiveEarningPeriod(
  id: number,
  updates: Pick<EarningPeriod, 'name' | 'notes' | 'percentage'> &
    Partial<
      Pick<
        EarningPeriod,
        | 'city'
        | 'country'
        | 'countryCode'
        | 'baseCurrency'
        | 'plannedEndDate'
        | 'economicGoal'
      >
    >,
) {
  const period = await db.earningPeriods.get(id)
  if (!period || period.status !== 'active') throw new Error(CLOSED_SEASON_MESSAGE)
  const protectedKeys = ['country', 'countryCode', 'baseCurrency', 'plannedEndDate', 'economicGoal'] as const
  if (protectedKeys.some((key) => updates[key] !== undefined && updates[key] !== period[key])) {
    throw new SeasonGeoDomainError(
      'REVISION_INVALID',
      'País, moneda, fecha prevista y objetivo no pueden modificarse por esta operación.',
    )
  }
  if (updates.percentage !== period.percentage && (await seasonHasActivity(id))) {
    throw new Error('Para cambiar el porcentaje debes cerrar la temporada actual y crear una nueva.')
  }
  const now = new Date().toISOString()
  const allowedUpdates = {
    name: updates.name,
    notes: updates.notes,
    percentage: updates.percentage,
    city: updates.city,
    updatedAt: now,
  }
  await db.earningPeriods.update(id, allowedUpdates)
  if (
    updates.percentage !== period.percentage ||
    (updates.city !== undefined && updates.city !== period.city)
  ) {
    const settings = await getSettingsForPeriod()
    await db.settings.put({
      ...settings,
      city: updates.city ?? settings.city,
      country: settings.country,
      defaultCurrency: settings.defaultCurrency,
      incomePercentage: updates.percentage,
      updatedAt: now,
    })
  }
  return db.earningPeriods.get(id)
}

export async function closeActiveEarningPeriod(endDate = new Date().toLocaleDateString('en-CA')) {
  if (!isLocalDate(endDate)) throw new Error('La fecha de cierre no es válida.')
  return db.transaction('rw', [db.earningPeriods, db.seasonStays], async () => {
    const active = (await db.earningPeriods.where('status').equals('active').toArray())[0]
    if (!active?.id) throw new Error(NO_ACTIVE_SEASON_MESSAGE)
    if (endDate < active.startDate.slice(0, 10)) throw new Error('La fecha de cierre no puede ser anterior al inicio.')
    const now = new Date().toISOString()
    const stays = await db.seasonStays.where('earningPeriodId').equals(active.id).toArray()
    const activeStays = stays.filter((stay) => stay.status === 'active')
    if (activeStays.length > 1) throw new SeasonGeoDomainError('ACTIVE_STAY_ALREADY_EXISTS', 'La temporada tiene varias estancias activas.')
    const closeAt = `${endDate}T23:59:59.999Z`
    for (const stay of stays) {
      if (stay.status === 'active') {
        if (stay.actualStartAt && Date.parse(closeAt) <= Date.parse(stay.actualStartAt)) {
          throw new SeasonGeoDomainError('STAY_DATE_INVALID', 'El cierre debe ser posterior al inicio de la estancia activa.')
        }
        await db.seasonStays.put({ ...stay, status: 'completed', actualEndAt: closeAt, completedAt: now, updatedAt: now })
      } else if (stay.status === 'planned') {
        await db.seasonStays.put({
          ...stay,
          status: 'cancelled',
          cancelledAt: now,
          cancellationReasonCode: 'season_closed',
          cancellationReason: 'Temporada cerrada antes de iniciar la estancia.',
          updatedAt: now,
        })
      }
    }
    await db.earningPeriods.update(active.id, {
      status: 'closed', endDate: closeAt, closedAt: now, updatedAt: now,
    })
    return db.earningPeriods.get(active.id)
  })
}

/** Kept for old callers/backups; explicit season UI should be used for new flows. */
export async function closeActiveEarningPeriodAndCreateNext(
  settings: AppSettings,
  nextPercentage: number,
  nextPeriodName?: string,
) {
  return db.transaction('rw', [db.earningPeriods, db.settings, db.seasonStays, db.seasonRevisions], async () => {
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
  })
}

export async function listSeasonRecords(periodId: number) {
  const [incomes, expenses, appointments] = await Promise.all([
    db.services
      .where('earningPeriodId').equals(periodId)
      .or('seasonPeriodId').equals(periodId)
      .toArray(),
    db.expenses
      .where('earningPeriodId').equals(periodId)
      .or('seasonPeriodId').equals(periodId)
      .toArray(),
    db.appointments
      .where('earningPeriodId').equals(periodId)
      .or('seasonPeriodId').equals(periodId)
      .toArray(),
  ])
  return {
    incomes: incomes.filter((income) => recordBelongsToEarningPeriod(income, periodId)),
    expenses: expenses.filter((expense) => recordBelongsToEarningPeriod(expense, periodId)),
    appointments: appointments.filter((appointment) => recordBelongsToEarningPeriod(appointment, periodId)),
  }
}

export async function getSeasonStatistics(periodId: number): Promise<SeasonStatistics> {
  const [period, settings, records] = await Promise.all([
    getEarningPeriodById(periodId),
    getSettingsForPeriod(),
    listSeasonRecords(periodId),
  ])
  const { incomes, expenses, appointments } = records
  const currency = period?.baseCurrency ?? settings.defaultCurrency
  const financialResult = calculateSeasonFinancialResult({
    incomes,
    expenses,
    currency,
    usageMode: 'professional',
    earningPeriodId: periodId,
  })
  const serviceIncomes = incomes.filter(isServiceIncome)
  const grossIncome = incomes
    .filter((income) => !isAdjustmentIncome(income))
    .reduce((sum, item) => sum + item.totalAmount, 0)
  const adjustments = expenses.filter((item) => item.type === 'ajuste').reduce((sum, item) => sum + item.amount, 0)
  const dayMap = new Map<string, { count: number; amount: number }>()
  serviceIncomes.forEach((item) => {
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
    realGain: financialResult.netIncome,
    expenses: financialResult.expenses,
    adjustments,
    netGain: financialResult.result,
    bestDay: bestDay ? { date: bestDay.date, amount: bestDay.amount } : undefined,
    serviceCount: serviceIncomes.length,
    appointmentCount: appointments.length,
    completedAppointmentCount: appointments.filter((item) => item.completed).length,
    servicesByDay,
    expensesByCategory: [...categoryMap].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  }
}

export async function listServiceIncomesByEarningPeriod(periodId: number) {
  const incomes = await db.services
    .where('earningPeriodId').equals(periodId)
    .or('seasonPeriodId').equals(periodId)
    .toArray()
  return incomes.filter((income) => recordBelongsToEarningPeriod(income, periodId))
}

export async function migrateLegacyRecordsToSeasons() {
  const settings = await getSettingsForPeriod()
  if (isBasicMode(settings)) return

  const periods = (await db.earningPeriods.toArray()).sort((a, b) => a.startDate.localeCompare(b.startDate))
  const [services, expenses, appointments] = await Promise.all([
    db.services.toArray(), db.expenses.toArray(), db.appointments.toArray(),
  ])
  const professionalServices = services.filter((service) =>
    recordBelongsToUsageMode(service, 'professional'),
  )
  const professionalExpenses = expenses.filter((expense) =>
    recordBelongsToUsageMode(expense, 'professional'),
  )

  if (
    !periods.length &&
    !professionalServices.length &&
    !professionalExpenses.length &&
    !appointments.length
  ) return

  let available = periods
  if (!available.length) {
    const dates = [...professionalServices.map((x) => x.date), ...professionalExpenses.map((x) => x.date), ...appointments.map((x) => x.dateTime.slice(0, 10))].sort()
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
      db.services.bulkPut(professionalServices.map((x: ServiceIncome) => ({ ...x, earningPeriodId: findId(x.date, recordPeriodId(x)), seasonPeriodId: findId(x.date, recordPeriodId(x)) }))),
      db.expenses.bulkPut(professionalExpenses.map((x: Expense) => ({ ...x, earningPeriodId: findId(x.date, recordPeriodId(x)), seasonPeriodId: findId(x.date, recordPeriodId(x)) }))),
      db.appointments.bulkPut(appointments.map((x: Appointment) => ({ ...x, earningPeriodId: findId(x.dateTime.slice(0, 10), recordPeriodId(x)), seasonPeriodId: findId(x.dateTime.slice(0, 10), recordPeriodId(x)) }))),
    ])
  })
}

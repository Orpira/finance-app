import { DEFAULT_SETTINGS_ID, createDefaultSettings, db } from '../database/db'
import type { EarningPeriod } from '../types/earningPeriod'
import type { AppSettings } from '../types/settings'

function getPeriodName(index: number) {
  return `Periodo ${index}`
}

async function getSettingsForPeriod(settings?: AppSettings) {
  if (settings) {
    return settings
  }

  const storedSettings = await db.settings.get(DEFAULT_SETTINGS_ID)

  return {
    ...createDefaultSettings(),
    ...storedSettings,
    id: DEFAULT_SETTINGS_ID as AppSettings['id'],
  }
}

async function getNextPeriodName() {
  const count = await db.earningPeriods.count()

  return getPeriodName(count + 1)
}

function buildEarningPeriod(settings: AppSettings, percentage: number) {
  const now = new Date().toISOString()

  return {
    name: '',
    percentage,
    startDate: now,
    status: 'active',
    country: settings.country,
    countryCode: settings.country,
    city: settings.city,
    createdAt: now,
  } satisfies Omit<EarningPeriod, 'id'>
}

async function attachLegacyServicesToPeriod(period: EarningPeriod) {
  if (!period.id) {
    return
  }

  const legacyServices = await db.services
    .filter((service) => service.earningPeriodId === undefined)
    .toArray()

  if (legacyServices.length === 0) {
    return
  }

  const legacyDates = legacyServices
    .map((service) => service.date)
    .filter(Boolean)
    .sort()
  const firstLegacyDate = legacyDates[0]

  await db.services.bulkPut(
    legacyServices.map((service) => ({
      ...service,
      earningPeriodId: period.id,
      earningPercentage:
        service.earningPercentage ?? service.percentage ?? period.percentage,
    })),
  )

  if (firstLegacyDate && firstLegacyDate < period.startDate.slice(0, 10)) {
    await db.earningPeriods.update(period.id, {
      startDate: `${firstLegacyDate}T00:00:00.000Z`,
    })
  }
}

async function syncPeriodStartDateFromServices(period: EarningPeriod) {
  if (!period.id) {
    return
  }

  const periodServices = await db.services
    .where('earningPeriodId')
    .equals(period.id)
    .toArray()
  const firstServiceDate = periodServices
    .map((service) => service.date)
    .filter(Boolean)
    .sort()[0]

  if (firstServiceDate && firstServiceDate < period.startDate.slice(0, 10)) {
    await db.earningPeriods.update(period.id, {
      startDate: `${firstServiceDate}T00:00:00.000Z`,
    })
  }
}

export async function listEarningPeriods() {
  return db.earningPeriods.orderBy('startDate').reverse().toArray()
}

export async function listClosedEarningPeriods() {
  const periods = await db.earningPeriods.where('status').equals('closed').toArray()

  return periods.sort((firstPeriod, secondPeriod) =>
    secondPeriod.startDate.localeCompare(firstPeriod.startDate),
  )
}

export async function getActiveEarningPeriod() {
  const activePeriods = await db.earningPeriods
    .where('status')
    .equals('active')
    .toArray()

  return activePeriods.sort((firstPeriod, secondPeriod) =>
    secondPeriod.startDate.localeCompare(firstPeriod.startDate),
  )[0]
}

export async function ensureActiveEarningPeriod(settings?: AppSettings) {
  const activePeriod = await getActiveEarningPeriod()

  if (activePeriod) {
    await attachLegacyServicesToPeriod(activePeriod)
    await syncPeriodStartDateFromServices(activePeriod)
    return activePeriod
  }

  const currentSettings = await getSettingsForPeriod(settings)
  const period = buildEarningPeriod(
    currentSettings,
    currentSettings.incomePercentage,
  )
  period.name = await getNextPeriodName()

  const id = await db.earningPeriods.add(period)
  const activePeriodWithId = {
    ...period,
    id,
  }
  await attachLegacyServicesToPeriod(activePeriodWithId)
  await syncPeriodStartDateFromServices(activePeriodWithId)

  return activePeriodWithId
}

export async function closeActiveEarningPeriodAndCreateNext(
  settings: AppSettings,
  nextPercentage: number,
  nextPeriodName?: string,
) {
  const now = new Date().toISOString()

  return db.transaction('rw', db.earningPeriods, async () => {
    const activePeriods = await db.earningPeriods
      .where('status')
      .equals('active')
      .toArray()

    await Promise.all(
      activePeriods.map((period) =>
        period.id
          ? db.earningPeriods.update(period.id, {
              status: 'closed',
              endDate: now,
              closedAt: now,
            })
          : Promise.resolve(),
      ),
    )

    const nextPeriod = buildEarningPeriod(settings, nextPercentage)
    nextPeriod.name =
      nextPeriodName?.trim() || getPeriodName((await db.earningPeriods.count()) + 1)
    nextPeriod.startDate = now
    nextPeriod.createdAt = now

    const id = await db.earningPeriods.add(nextPeriod)

    return {
      ...nextPeriod,
      id,
    }
  })
}

export async function listServiceIncomesByEarningPeriod(periodId: number) {
  return db.services.where('earningPeriodId').equals(periodId).toArray()
}

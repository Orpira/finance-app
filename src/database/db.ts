import Dexie, { type Table } from 'dexie'

import type { Appointment } from '../types/appointment'
import type { CutoffReport } from '../types/cutoffReport'
import type { EarningPeriod } from '../types/earningPeriod'
import type { ExchangeRate } from '../types/exchangeRate'
import type { Expense } from '../types/expense'
import type { AppLicense } from '../types/license'
import type { ServiceIncome } from '../types/service'
import type { AppSettings } from '../types/settings'
import type { AutomationOutboxRecord } from '../types/automation'
import type { CommunicationChannel } from '../types/communicationChannel'
import type { DeviceIdentity } from '../types/deviceIdentity'
import {
  resolveRecordUsageMode,
  resolveUsageMode,
  toLegacyUserType,
} from '../utils/usageMode'
import { assertAllExpenseAdjustmentsAreValid } from '../utils/expenseAdjustments'
import { getIncomeType, normalizeAdjustmentIncome } from '../utils/incomeTypes'
import { getNumericDurationLabel } from '../utils/serviceDuration'
import { normalizeReportStatus } from '../catalogs/reportStatuses'

export const DEFAULT_SETTINGS_ID = 'app'

export function createDefaultSettings(): AppSettings {
  const now = new Date().toISOString()

  return {
    id: DEFAULT_SETTINGS_ID,
    businessName: '',
    country: 'ES',
    city: '',
    defaultCurrency: 'EUR',
    secondaryCurrency: 'COP',
    incomePercentage: 50,
    rateMode: 'manual',
    usageMode: 'professional',
    userType: 'primary',
    theme: 'system',
    pinEnabled: false,
    backupEncryptionKey: '',
    driveBackupEnabled: false,
    driveBackupFrequency: 'daily',
    cutoffFrequency: 'weekly',
    cutoffWeekStart: 1,
    cutoffAnchorDate: now.slice(0, 10),
    googleDriveClientId: '',
    googleDriveConnected: false,
    googleDriveLastBackupAt: undefined,
    googleDriveLastBackupStatus: undefined,
    closedLocationSeasons: [],
    reopenedLocationSeasons: [],
    createdAt: now,
    updatedAt: now,
  }
}

export class FinanceDB extends Dexie {
  services!: Table<ServiceIncome, number>
  expenses!: Table<Expense, number>
  appointments!: Table<Appointment, number>
  settings!: Table<AppSettings, AppSettings['id']>
  exchangeRates!: Table<ExchangeRate, number>
  cutoffReports!: Table<CutoffReport, number>
  earningPeriods!: Table<EarningPeriod, number>
  licenses!: Table<AppLicense, AppLicense['id']>
  automationOutbox!: Table<AutomationOutboxRecord, string>
  communicationChannels!: Table<CommunicationChannel, CommunicationChannel['id']>
  deviceIdentity!: Table<DeviceIdentity, DeviceIdentity['id']>

  constructor() {
    super('finance-app')

    this.version(1).stores({
      services: '++id,date',
      expenses: '++id,date',
      appointments: '++id,dateTime',
      settings: 'id',
    })

    this.version(2).stores({
      services: '++id,date,currency',
      expenses: '++id,date,category,currency',
      appointments: '++id,dateTime,completed,currency',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
    })

    this.version(3).stores({
      services: '++id,date,currency,country',
      expenses: '++id,date,category,currency,country',
      appointments: '++id,dateTime,completed,currency',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
    })

    this.version(4)
      .stores({
        services: '++id,date,currency,country,status',
        expenses: '++id,date,category,currency,country',
        appointments: '++id,dateTime,completed,currency',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      })
      .upgrade((transaction) =>
        transaction
          .table<ServiceIncome, number>('services')
          .toCollection()
          .modify((service) => {
            service.status ??= 'PENDIENTE'
          }),
      )

    this.version(5)
      .stores({
        services: '++id,date,currency,country,status',
        expenses: '++id,date,category,currency,country',
        appointments: '++id,dateTime,completed,currency',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      })
      .upgrade((transaction) =>
        transaction
          .table<Appointment & { clientName?: string }, number>('appointments')
          .toCollection()
          .modify((appointment) => {
            delete appointment.clientName
          }),
      )

    this.version(6)
      .stores({
        services: '++id,date,currency,country,status',
        expenses: '++id,date,category,currency,country',
        appointments: '++id,dateTime,completed,currency',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      })
      .upgrade((transaction) =>
        transaction
          .table<Appointment, number>('appointments')
          .toCollection()
          .modify((appointment) => {
            appointment.reminders ??= []
          }),
      )

    this.version(7)
      .stores({
        services: '++id,date,currency,country,status',
        expenses: '++id,date,category,currency,country',
        appointments: '++id,dateTime,completed,currency',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      })
      .upgrade(async (transaction) => {
        const settings = await transaction
          .table<AppSettings, AppSettings['id']>('settings')
          .get(DEFAULT_SETTINGS_ID)

        await transaction
          .table<Appointment, number>('appointments')
          .toCollection()
          .modify((appointment) => {
            appointment.country ??= settings?.country
            appointment.city ??= settings?.city
          })
      })

    this.version(8).stores({
      services: '++id,date,currency,country,status',
      expenses: '++id,date,category,currency,country',
      appointments: '++id,dateTime,completed,currency',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      cutoffReports:
        '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
    })

    this.version(9).stores({
      services: '++id,date,currency,country,status,earningPeriodId',
      expenses: '++id,date,category,currency,country',
      appointments: '++id,dateTime,completed,currency',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      cutoffReports:
        '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
      earningPeriods: '++id,status,startDate,endDate,countryCode,city',
    })

    this.version(10)
      .stores({
        services: '++id,date,currency,country,status,earningPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt',
        appointments: '++id,dateTime,completed,currency',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
      })
      .upgrade((transaction) =>
        transaction
          .table<Expense, number>('expenses')
          .toCollection()
          .modify((expense) => {
            expense.type ??= 'gasto'
            expense.createdAt ??= `${expense.date}T00:00:00`
          }),
      )

    this.version(11).stores({
      services: '++id,date,currency,country,status,earningPeriodId',
      expenses:
        '++id,type,date,category,currency,country,relatedIncomeId,createdAt',
      appointments: '++id,dateTime,completed,currency',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      cutoffReports:
        '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
      earningPeriods: '++id,status,startDate,endDate,countryCode,city',
      licenses: 'id,deviceCode,status,expirationDate',
    })

    this.version(12)
      .stores({
        services:
          '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
        appointments:
          '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
        licenses: 'id,deviceCode,status,expirationDate',
      })
      .upgrade(async (transaction) => {
        const periodsTable = transaction.table<EarningPeriod, number>('earningPeriods')
        let periods = await periodsTable.toArray()
        const servicesTable = transaction.table<ServiceIncome, number>('services')
        const expensesTable = transaction.table<Expense, number>('expenses')
        const appointmentsTable = transaction.table<Appointment, number>('appointments')
        const settings = await transaction
          .table<AppSettings, AppSettings['id']>('settings')
          .get(DEFAULT_SETTINGS_ID)

        if (resolveUsageMode(settings) === 'basic') {
          return
        }

        const [services, expenses, appointments] = await Promise.all([
          servicesTable.toArray(),
          expensesTable.toArray(),
          appointmentsTable.toArray(),
        ])

        if (periods.length === 0 && (services.length || expenses.length || appointments.length)) {
          const dates = [
            ...services.map((item) => item.date),
            ...expenses.map((item) => item.date),
            ...appointments.map((item) => item.dateTime.slice(0, 10)),
          ].filter(Boolean).sort()
          const now = new Date().toISOString()
          const id = await periodsTable.add({
            name: 'Temporada inicial migrada',
            percentage: settings?.incomePercentage ?? 50,
            startDate: `${dates[0] ?? now.slice(0, 10)}T00:00:00.000Z`,
            status: 'active',
            country: settings?.country,
            countryCode: settings?.country,
            city: settings?.city,
            baseCurrency: settings?.defaultCurrency,
            createdAt: now,
            updatedAt: now,
          })
          periods = (await periodsTable.get(id)) ? [await periodsTable.get(id) as EarningPeriod] : []
        }

        const sortedPeriods = periods.sort((a, b) => a.startDate.localeCompare(b.startDate))
        const periodForDate = (date: string, existing?: number) => {
          if (existing) return existing
          const match = [...sortedPeriods].reverse().find((period) => {
            const start = period.startDate.slice(0, 10)
            const end = period.endDate?.slice(0, 10)
            return date >= start && (!end || date <= end)
          })
          return match?.id ?? sortedPeriods.at(-1)?.id
        }

        await Promise.all([
          servicesTable.toCollection().modify((item) => {
            const id = periodForDate(item.date, item.earningPeriodId ?? item.seasonPeriodId)
            item.earningPeriodId = id
            item.seasonPeriodId = id
          }),
          expensesTable.toCollection().modify((item) => {
            const id = periodForDate(item.date, item.earningPeriodId ?? item.seasonPeriodId)
            item.earningPeriodId = id
            item.seasonPeriodId = id
          }),
          appointmentsTable.toCollection().modify((item) => {
            const id = periodForDate(item.dateTime.slice(0, 10), item.earningPeriodId ?? item.seasonPeriodId)
            item.earningPeriodId = id
            item.seasonPeriodId = id
          }),
        ])
      })

    this.version(13)
      .stores({
        services:
          '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
        appointments:
          '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
        licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      })
      .upgrade((transaction) =>
        transaction
          .table<AppLicense, AppLicense['id']>('licenses')
          .toCollection()
          .modify((license) => {
            license.licenseVersion ??= 1
          }),
      )

    this.version(14)
      .stores({
        services:
          '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
        appointments:
          '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
        licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      })
      .upgrade((transaction) =>
        transaction
          .table<AppSettings, AppSettings['id']>('settings')
          .toCollection()
          .modify((settings) => {
            const usageMode = resolveUsageMode(settings)
            settings.usageMode = usageMode
            settings.userType = toLegacyUserType(usageMode)
          }),
      )

    this.version(15)
      .stores({
        services:
          '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
        appointments:
          '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
        licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      })
      .upgrade((transaction) =>
        Promise.all([
          transaction
            .table<ServiceIncome, number>('services')
            .toCollection()
            .modify((income) => {
              income.usageMode = resolveRecordUsageMode(income)
            }),
          transaction
            .table<Expense, number>('expenses')
            .toCollection()
            .modify((expense) => {
              expense.usageMode = resolveRecordUsageMode(expense)
            }),
        ]),
      )

    this.version(16)
      .stores({
        services:
          '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
        appointments:
          '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
        licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      })
      .upgrade((transaction) =>
        transaction
          .table<ServiceIncome, number>('services')
          .toCollection()
          .modify((income) => {
            income.type ??= 'ingreso'
          }),
      )

    this.version(17)
      .stores({
        services:
          '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
        appointments:
          '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
        licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      })
      .upgrade((transaction) =>
        transaction
          .table<ServiceIncome, number>('services')
          .toCollection()
          .modify((income) => {
            income.type = getIncomeType(income)
            Object.assign(income, normalizeAdjustmentIncome(income))
          }),
      )

    this.version(18).stores({
      services:
        '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
      expenses:
        '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
      appointments:
        '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      cutoffReports:
        '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
      earningPeriods: '++id,status,startDate,endDate,countryCode,city',
      licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      automationOutbox: 'eventId,event,nextAttemptAt,createdAt',
    })

    this.version(19).stores({
      services:
        '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
      expenses:
        '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
      appointments:
        '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      cutoffReports:
        '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
      earningPeriods: '++id,status,startDate,endDate,countryCode,city',
      licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      automationOutbox: 'eventId,event,nextAttemptAt,createdAt',
      communicationChannels: 'id,type,provider,status,updatedAt',
    })

    this.version(20)
      .stores({
        services:
          '++id,date,currency,country,status,earningPeriodId,seasonPeriodId',
        expenses:
          '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId',
        appointments:
          '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId',
        settings: 'id',
        exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
        cutoffReports:
          '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
        earningPeriods: '++id,status,startDate,endDate,countryCode,city',
        licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
        automationOutbox: 'eventId,event,nextAttemptAt,createdAt',
        communicationChannels: 'id,type,provider,status,updatedAt',
      })
      .upgrade((transaction) =>
        transaction
          .table<Appointment, number>('appointments')
          .toCollection()
          .modify((appointment) => {
            appointment.durationLabel ??= getNumericDurationLabel(
              appointment.duration,
            )
          }),
      )

    this.version(21).stores({
      services:
        '++id,date,currency,country,status,earningPeriodId,seasonPeriodId,reportStatusCode',
      expenses:
        '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId,reportStatusCode',
      appointments:
        '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId,reportStatusCode',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      cutoffReports:
        '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
      earningPeriods: '++id,status,startDate,endDate,countryCode,city',
      licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      automationOutbox: 'eventId,event,nextAttemptAt,createdAt',
      communicationChannels: 'id,type,provider,status,updatedAt',
      deviceIdentity: 'id,userCode,deviceCode,platform,updatedAt',
    })
      .upgrade((transaction) =>
        Promise.all([
          transaction
            .table<ServiceIncome, number>('services')
            .toCollection()
            .modify((income) => {
              Object.assign(income, normalizeReportStatus(income))
            }),
          transaction
            .table<Expense, number>('expenses')
            .toCollection()
            .modify((expense) => {
              Object.assign(expense, normalizeReportStatus(expense))
            }),
          transaction
            .table<Appointment, number>('appointments')
            .toCollection()
            .modify((appointment) => {
              Object.assign(appointment, normalizeReportStatus(appointment))
            }),
        ]),
      )

    this.version(22).stores({
      services:
        '++id,date,currency,country,status,earningPeriodId,seasonPeriodId,reportStatusCode,timerStatus,timerEndsAt',
      expenses:
        '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId,reportStatusCode',
      appointments:
        '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId,reportStatusCode',
      settings: 'id',
      exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
      cutoffReports:
        '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
      earningPeriods: '++id,status,startDate,endDate,countryCode,city',
      licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
      automationOutbox: 'eventId,event,nextAttemptAt,createdAt',
      communicationChannels: 'id,type,provider,status,updatedAt',
      deviceIdentity: 'id,userCode,deviceCode,platform,updatedAt',
    })
  }
}

export const db = new FinanceDB()

export async function initializeDatabase() {
  const settings = await db.settings.get(DEFAULT_SETTINGS_ID)

  if (!settings) {
    await db.settings.put(createDefaultSettings())
  }
}

export async function resetDatabase() {
  await db.transaction(
    'rw',
    [
      db.services,
      db.expenses,
      db.appointments,
      db.settings,
      db.exchangeRates,
      db.cutoffReports,
      db.earningPeriods,
      db.automationOutbox,
      db.communicationChannels,
    ],
    async () => {
      await Promise.all([
        db.services.clear(),
        db.expenses.clear(),
        db.appointments.clear(),
        db.settings.clear(),
        db.exchangeRates.clear(),
        db.cutoffReports.clear(),
        db.earningPeriods.clear(),
        db.automationOutbox.clear(),
        db.communicationChannels.clear(),
      ])

      await db.settings.put(createDefaultSettings())
    },
  )
}

export async function exportDatabaseSnapshot() {
  const [
    services,
    expenses,
    appointments,
    settings,
    exchangeRates,
    cutoffReports,
    earningPeriods,
    communicationChannels,
  ] =
    await Promise.all([
      db.services.toArray(),
      db.expenses.toArray(),
      db.appointments.toArray(),
      db.settings.toArray(),
      db.exchangeRates.toArray(),
      db.cutoffReports.toArray(),
      db.earningPeriods.toArray(),
      db.communicationChannels.toArray(),
    ])

  return {
    services,
    expenses,
    appointments,
    settings,
    exchangeRates,
    cutoffReports,
    earningPeriods,
    communicationChannels,
    exportedAt: new Date().toISOString(),
  }
}

export type DatabaseSnapshot = Awaited<ReturnType<typeof exportDatabaseSnapshot>>

export async function importDatabaseSnapshot(snapshot: DatabaseSnapshot) {
  const normalizedServices = (snapshot.services ?? []).map((income) =>
    normalizeAdjustmentIncome({
      ...normalizeReportStatus(income),
      type: getIncomeType(income),
      usageMode: resolveRecordUsageMode(income),
    }),
  )
  const normalizedExpenses = (snapshot.expenses ?? []).map((expense) => ({
    ...normalizeReportStatus(expense),
    type: expense.type ?? 'gasto',
    createdAt: expense.createdAt ?? `${expense.date}T00:00:00`,
    usageMode: resolveRecordUsageMode(expense),
  }))

  // Validate before clearing local data: an invalid backup must never partially restore.
  assertAllExpenseAdjustmentsAreValid(normalizedServices, normalizedExpenses)

  await db.transaction(
    'rw',
    [
      db.services,
      db.expenses,
      db.appointments,
      db.settings,
      db.exchangeRates,
      db.cutoffReports,
      db.earningPeriods,
      db.automationOutbox,
      db.communicationChannels,
    ],
    async () => {
      await Promise.all([
        db.services.clear(),
        db.expenses.clear(),
        db.appointments.clear(),
        db.settings.clear(),
        db.exchangeRates.clear(),
        db.cutoffReports.clear(),
        db.earningPeriods.clear(),
        db.automationOutbox.clear(),
        db.communicationChannels.clear(),
      ])

      await Promise.all([
        db.services.bulkPut(normalizedServices),
        db.expenses.bulkPut(normalizedExpenses),
        db.appointments.bulkPut(snapshot.appointments ?? []),
        db.settings.bulkPut(
          (snapshot.settings ?? []).map((settings) => {
            const usageMode = resolveUsageMode(settings)

            return {
              ...createDefaultSettings(),
              ...settings,
              id: DEFAULT_SETTINGS_ID,
              usageMode,
              userType: toLegacyUserType(usageMode),
            }
          }),
        ),
        db.exchangeRates.bulkPut(snapshot.exchangeRates ?? []),
        db.cutoffReports.bulkPut(snapshot.cutoffReports ?? []),
        db.earningPeriods.bulkPut(snapshot.earningPeriods ?? []),
        db.communicationChannels.bulkPut(snapshot.communicationChannels ?? []),
      ])

      if (!snapshot.settings?.length) {
        await db.settings.put(createDefaultSettings())
      }
    },
  )
}

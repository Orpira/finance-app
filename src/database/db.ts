import Dexie, { type Table } from 'dexie'

import type { Appointment } from '../types/appointment'
import type { CutoffReport } from '../types/cutoffReport'
import type { EarningPeriod } from '../types/earningPeriod'
import type { ExchangeRate } from '../types/exchangeRate'
import type { Expense } from '../types/expense'
import type { AppLicense } from '../types/license'
import type { ServiceIncome } from '../types/service'
import type { AppSettings } from '../types/settings'

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
  ] =
    await Promise.all([
      db.services.toArray(),
      db.expenses.toArray(),
      db.appointments.toArray(),
      db.settings.toArray(),
      db.exchangeRates.toArray(),
      db.cutoffReports.toArray(),
      db.earningPeriods.toArray(),
    ])

  return {
    services,
    expenses,
    appointments,
    settings,
    exchangeRates,
    cutoffReports,
    earningPeriods,
    exportedAt: new Date().toISOString(),
  }
}

export type DatabaseSnapshot = Awaited<ReturnType<typeof exportDatabaseSnapshot>>

export async function importDatabaseSnapshot(snapshot: DatabaseSnapshot) {
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
      ])

      await Promise.all([
        db.services.bulkPut(snapshot.services ?? []),
        db.expenses.bulkPut(
          (snapshot.expenses ?? []).map((expense) => ({
            ...expense,
            type: expense.type ?? 'gasto',
            createdAt: expense.createdAt ?? `${expense.date}T00:00:00`,
          })),
        ),
        db.appointments.bulkPut(snapshot.appointments ?? []),
        db.settings.bulkPut(snapshot.settings ?? []),
        db.exchangeRates.bulkPut(snapshot.exchangeRates ?? []),
        db.cutoffReports.bulkPut(snapshot.cutoffReports ?? []),
        db.earningPeriods.bulkPut(snapshot.earningPeriods ?? []),
      ])

      if (!snapshot.settings?.length) {
        await db.settings.put(createDefaultSettings())
      }
    },
  )
}

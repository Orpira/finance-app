import Dexie, { type Table } from 'dexie'

import type { Appointment } from '../types/appointment'
import type { ExchangeRate } from '../types/exchangeRate'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { AppSettings } from '../types/settings'

export const DEFAULT_SETTINGS_ID = 'app'

export function createDefaultSettings(): AppSettings {
  const now = new Date().toISOString()

  return {
    id: DEFAULT_SETTINGS_ID,
    businessName: '',
    country: 'ES',
    defaultCurrency: 'EUR',
    secondaryCurrency: 'COP',
    incomePercentage: 50,
    rateMode: 'manual',
    theme: 'system',
    pinEnabled: false,
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
    [db.services, db.expenses, db.appointments, db.settings, db.exchangeRates],
    async () => {
      await Promise.all([
        db.services.clear(),
        db.expenses.clear(),
        db.appointments.clear(),
        db.settings.clear(),
        db.exchangeRates.clear(),
      ])

      await db.settings.put(createDefaultSettings())
    },
  )
}

export async function exportDatabaseSnapshot() {
  const [services, expenses, appointments, settings, exchangeRates] =
    await Promise.all([
      db.services.toArray(),
      db.expenses.toArray(),
      db.appointments.toArray(),
      db.settings.toArray(),
      db.exchangeRates.toArray(),
    ])

  return {
    services,
    expenses,
    appointments,
    settings,
    exchangeRates,
    exportedAt: new Date().toISOString(),
  }
}

export type DatabaseSnapshot = Awaited<ReturnType<typeof exportDatabaseSnapshot>>

export async function importDatabaseSnapshot(snapshot: DatabaseSnapshot) {
  await db.transaction(
    'rw',
    [db.services, db.expenses, db.appointments, db.settings, db.exchangeRates],
    async () => {
      await Promise.all([
        db.services.clear(),
        db.expenses.clear(),
        db.appointments.clear(),
        db.settings.clear(),
        db.exchangeRates.clear(),
      ])

      await Promise.all([
        db.services.bulkPut(snapshot.services ?? []),
        db.expenses.bulkPut(snapshot.expenses ?? []),
        db.appointments.bulkPut(snapshot.appointments ?? []),
        db.settings.bulkPut(snapshot.settings ?? []),
        db.exchangeRates.bulkPut(snapshot.exchangeRates ?? []),
      ])

      if (!snapshot.settings?.length) {
        await db.settings.put(createDefaultSettings())
      }
    },
  )
}

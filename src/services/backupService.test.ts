import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppSettings } from '../types/settings'

const servicesTable = { toArray: vi.fn() }
const expensesTable = { toArray: vi.fn() }
const appointmentsTable = { toArray: vi.fn() }
const exchangeRatesTable = { toArray: vi.fn() }
const cutoffReportsTable = { toArray: vi.fn() }
const earningPeriodsTable = { toArray: vi.fn() }
const communicationChannelsTable = { toArray: vi.fn() }
const incomeAdditionalsTable = { toArray: vi.fn() }
const financialGoalsTable = { toArray: vi.fn() }

vi.mock('../database/db', () => ({
  db: {
    services: servicesTable,
    expenses: expensesTable,
    appointments: appointmentsTable,
    exchangeRates: exchangeRatesTable,
    cutoffReports: cutoffReportsTable,
    earningPeriods: earningPeriodsTable,
    communicationChannels: communicationChannelsTable,
    incomeAdditionals: incomeAdditionalsTable,
    financialGoals: financialGoalsTable,
  },
  exportDatabaseSnapshot: vi.fn(),
  importDatabaseSnapshot: vi.fn(),
}))

const getSettingsMock = vi.fn()

vi.mock('./settingsService', () => ({
  getSettings: () => getSettingsMock(),
  updateSettings: vi.fn(),
}))

vi.mock('./earningPeriodService', () => ({
  migrateLegacyRecordsToSeasons: vi.fn(),
}))

const { generateBackupData, backupDataToSnapshot } = await import('./backupService')

function settings(): AppSettings {
  return { id: 'app', businessName: 'Negocio' } as AppSettings
}

beforeEach(() => {
  vi.clearAllMocks()
  servicesTable.toArray.mockResolvedValue([])
  expensesTable.toArray.mockResolvedValue([])
  appointmentsTable.toArray.mockResolvedValue([])
  exchangeRatesTable.toArray.mockResolvedValue([])
  cutoffReportsTable.toArray.mockResolvedValue([])
  earningPeriodsTable.toArray.mockResolvedValue([])
  communicationChannelsTable.toArray.mockResolvedValue([])
  incomeAdditionalsTable.toArray.mockResolvedValue([])
  financialGoalsTable.toArray.mockResolvedValue([])
  getSettingsMock.mockResolvedValue(settings())
})

describe('generateBackupData', () => {
  it('incluye los incomeAdditionals persistidos', async () => {
    const additional = { id: 1, incomeId: 5, amount: 10, createdAt: '2026-01-01T00:00:00.000Z' }
    incomeAdditionalsTable.toArray.mockResolvedValue([additional])

    const backup = await generateBackupData()

    expect(backup.incomeAdditionals).toEqual([additional])
  })

  it('incluye los objetivos financieros persistidos', async () => {
    const goal = { id: 'goal-1', type: 'saving', targetAmount: 300 }
    financialGoalsTable.toArray.mockResolvedValue([goal])
    expect((await generateBackupData()).financialGoals).toEqual([goal])
  })
})

describe('backupDataToSnapshot', () => {
  it('incluye incomeAdditionals en el snapshot resultante', () => {
    const additional = { id: 1, incomeId: 5, amount: 10, createdAt: '2026-01-01T00:00:00.000Z' }

    const snapshot = backupDataToSnapshot({
      version: '2',
      generatedAt: '2026-01-01T00:00:00.000Z',
      appName: 'Private Balance',
      services: [],
      expenses: [],
      appointments: [],
      settings: settings(),
      exchangeRates: [],
      incomeAdditionals: [additional],
    })

    expect(snapshot.incomeAdditionals).toEqual([additional])
  })

  it('mantiene compatibilidad con backups sin objetivos financieros', () => {
    const snapshot = backupDataToSnapshot({
      version: '2', generatedAt: '2026-01-01T00:00:00.000Z', appName: 'Private Balance',
      services: [], expenses: [], appointments: [], settings: settings(), exchangeRates: [],
    })
    expect(snapshot.financialGoals).toEqual([])
  })

  it('devuelve un array vacío cuando el backup no trae incomeAdditionals (backups anteriores a PB-IS-0007)', () => {
    const snapshot = backupDataToSnapshot({
      version: '2',
      generatedAt: '2026-01-01T00:00:00.000Z',
      appName: 'Private Balance',
      services: [],
      expenses: [],
      appointments: [],
      settings: settings(),
      exchangeRates: [],
    })

    expect(snapshot.incomeAdditionals).toEqual([])
  })
})

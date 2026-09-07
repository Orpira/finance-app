import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppSettings } from '../types/settings'
import type { ServiceIncome } from '../types/service'

const servicesTable = { count: vi.fn(), toArray: vi.fn() }
const expensesTable = { count: vi.fn(), toArray: vi.fn() }
const appointmentsTable = { count: vi.fn(), toArray: vi.fn() }
const exchangeRatesTable = { toArray: vi.fn() }
const cutoffReportsTable = { toArray: vi.fn() }
const earningPeriodsTable = { toArray: vi.fn() }
const communicationChannelsTable = { toArray: vi.fn() }
const incomeAdditionalsTable = { toArray: vi.fn() }
const financialGoalsTable = { toArray: vi.fn() }
const importDatabaseSnapshotMock = vi.fn()
const personalIncomeCategoriesTable = { toArray: vi.fn() }
const personalExpenseCategoriesTable = { toArray: vi.fn() }
const walletsTable = { toArray: vi.fn() }
const internalTransfersTable = { toArray: vi.fn() }

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
    personalIncomeCategories: personalIncomeCategoriesTable,
    personalExpenseCategories: personalExpenseCategoriesTable,
    wallets: walletsTable,
    internalTransfers: internalTransfersTable,
  },
  exportDatabaseSnapshot: vi.fn(),
  importDatabaseSnapshot: importDatabaseSnapshotMock,
}))

const getSettingsMock = vi.fn()

vi.mock('./settingsService', () => ({
  getSettings: () => getSettingsMock(),
  updateSettings: vi.fn(),
}))

vi.mock('./earningPeriodService', () => ({
  migrateLegacyRecordsToSeasons: vi.fn(),
}))

const { generateBackupData, backupDataToSnapshot, importBackup } = await import('./backupService')

function settings(): AppSettings {
  return { id: 'app', businessName: 'Negocio' } as AppSettings
}

beforeEach(() => {
  vi.clearAllMocks()
  servicesTable.toArray.mockResolvedValue([])
  servicesTable.count.mockResolvedValue(0)
  expensesTable.toArray.mockResolvedValue([])
  expensesTable.count.mockResolvedValue(0)
  appointmentsTable.toArray.mockResolvedValue([])
  appointmentsTable.count.mockResolvedValue(0)
  exchangeRatesTable.toArray.mockResolvedValue([])
  cutoffReportsTable.toArray.mockResolvedValue([])
  earningPeriodsTable.toArray.mockResolvedValue([])
  communicationChannelsTable.toArray.mockResolvedValue([])
  incomeAdditionalsTable.toArray.mockResolvedValue([])
  financialGoalsTable.toArray.mockResolvedValue([])
  personalIncomeCategoriesTable.toArray.mockResolvedValue([])
  personalExpenseCategoriesTable.toArray.mockResolvedValue([])
  walletsTable.toArray.mockResolvedValue([])
  internalTransfersTable.toArray.mockResolvedValue([])
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

  it('incluye las wallets y transferencias internas persistidas', async () => {
    const wallet = { id: 'wal-1', name: 'Cuenta principal' }
    const transfer = { id: 'itx-1', fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 150 }
    walletsTable.toArray.mockResolvedValue([wallet])
    internalTransfersTable.toArray.mockResolvedValue([transfer])

    const backup = await generateBackupData()

    expect(backup.wallets).toEqual([wallet])
    expect(backup.internalTransfers).toEqual([transfer])
  })
})

describe('backupDataToSnapshot', () => {
  it('conserva el nombre Personal y admite backups históricos sin el campo', () => {
    const namedIncome = {
      id: 9,
      date: '2026-09-05',
      totalAmount: 125,
      currency: 'EUR',
      percentage: 100,
      realGain: 125,
      usageMode: 'basic',
      personalName: 'Nómina septiembre',
    } as ServiceIncome
    const baseBackup = {
      version: '2' as const,
      generatedAt: '2026-09-05T10:00:00.000Z',
      appName: 'Private Balance' as const,
      expenses: [], appointments: [], settings: { ...settings(), usageMode: 'basic' as const }, exchangeRates: [],
    }
    const historicalIncome = { ...namedIncome }
    delete historicalIncome.personalName

    expect(backupDataToSnapshot({ ...baseBackup, services: [namedIncome] }).services[0]?.personalName)
      .toBe('Nómina septiembre')
    expect(backupDataToSnapshot({ ...baseBackup, services: [historicalIncome] }).services[0])
      .not.toHaveProperty('personalName')
  })

  it('conserva el nombre Personal de un egreso y admite backups históricos sin el campo', () => {
    const namedExpense = {
      id: 4,
      type: 'gasto' as const,
      date: '2026-09-05',
      category: 'Otros',
      amount: 50,
      currency: 'EUR',
      eurValue: 50,
      copValue: 200_000,
      createdAt: '2026-09-05T10:00:00.000Z',
      usageMode: 'basic' as const,
      personalName: 'Compra supermercado',
    }
    const baseBackup = {
      version: '2' as const,
      generatedAt: '2026-09-05T10:00:00.000Z',
      appName: 'Private Balance' as const,
      services: [], appointments: [], settings: { ...settings(), usageMode: 'basic' as const }, exchangeRates: [],
    }
    const historicalExpense = { ...namedExpense }
    delete (historicalExpense as { personalName?: string }).personalName

    expect(backupDataToSnapshot({ ...baseBackup, expenses: [namedExpense] }).expenses[0]?.personalName)
      .toBe('Compra supermercado')
    expect(backupDataToSnapshot({ ...baseBackup, expenses: [historicalExpense] }).expenses[0])
      .not.toHaveProperty('personalName')
  })

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

  it('incluye wallets y transferencias internas en el snapshot resultante (spec §18)', () => {
    const wallet = {
      id: 'wal-1', name: 'Cuenta principal', normalizedName: 'cuenta principal',
      usageMode: 'basic' as const, isDefault: true, isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const transfer = {
      id: 'itx-1', fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 150, currency: 'EUR',
      date: '2026-01-05', usageMode: 'basic' as const,
      createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z',
    }

    const snapshot = backupDataToSnapshot({
      version: '2',
      generatedAt: '2026-01-01T00:00:00.000Z',
      appName: 'Private Balance',
      services: [],
      expenses: [],
      appointments: [],
      settings: settings(),
      exchangeRates: [],
      wallets: [wallet],
      internalTransfers: [transfer],
    })

    expect(snapshot.wallets).toEqual([wallet])
    expect(snapshot.internalTransfers).toEqual([transfer])
  })

  it('devuelve arrays vacíos cuando el backup no trae wallets ni transferencias (backups anteriores a Wallets)', () => {
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

    expect(snapshot.wallets).toEqual([])
    expect(snapshot.internalTransfers).toEqual([])
  })
})

describe('importBackup', () => {
  it('rechaza un JSON ajeno antes de tocar la base local', async () => {
    const file = {
      text: vi.fn().mockResolvedValue(JSON.stringify({ hello: 'world' })),
    } as unknown as File

    await expect(importBackup(file)).rejects.toThrow(
      'El archivo no contiene un backup válido de Private Balance.',
    )
    expect(importDatabaseSnapshotMock).not.toHaveBeenCalled()
  })

  it('normaliza el formato BackupData histórico antes de importarlo', async () => {
    const legacySettings = settings()
    const file = {
      text: vi.fn().mockResolvedValue(JSON.stringify({
        version: '2',
        generatedAt: '2026-08-08T00:00:00.000Z',
        appName: 'Private Balance',
        services: [],
        expenses: [],
        appointments: [],
        settings: legacySettings,
      })),
    } as unknown as File

    await importBackup(file)

    expect(importDatabaseSnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        exportedAt: '2026-08-08T00:00:00.000Z',
        exchangeRates: [],
        settings: [legacySettings],
      }),
    )
  })

  it('mantiene pinEnabled y pinHash al restaurar una copia y prepararla para arranque frío', async () => {
    const restoredSettings = {
      ...settings(),
      pinEnabled: true,
      pinHash: 'v2:210000:salt:hash',
    } as AppSettings
    const snapshot = backupDataToSnapshot({
      version: '2',
      generatedAt: '2026-08-22T00:00:00.000Z',
      appName: 'Private Balance',
      services: [],
      expenses: [],
      appointments: [],
      settings: restoredSettings,
      exchangeRates: [],
    })

    expect(snapshot.settings[0]).toEqual(
      expect.objectContaining({
        pinEnabled: true,
        pinHash: 'v2:210000:salt:hash',
      }),
    )
  })

  it('confirma los registros persistidos e identifica un backup solo histórico', async () => {
    servicesTable.count.mockResolvedValue(179)
    expensesTable.count.mockResolvedValue(2)
    appointmentsTable.count.mockResolvedValue(3)
    earningPeriodsTable.toArray.mockResolvedValue([
      { id: 1, status: 'closed' },
      { id: 2, status: 'closed' },
    ])
    const file = {
      text: vi.fn().mockResolvedValue(JSON.stringify({
        services: [],
        expenses: [],
        appointments: [],
        settings: [],
        exchangeRates: [],
        cutoffReports: [],
        earningPeriods: [],
        communicationChannels: [],
        incomeAdditionals: [],
        financialGoals: [],
        exportedAt: '2026-08-08T00:00:00.000Z',
      })),
    } as unknown as File

    await expect(importBackup(file)).resolves.toEqual({
      appointments: 3,
      closedEarningPeriods: 2,
      earningPeriods: 2,
      expenses: 2,
      hasActiveEarningPeriod: false,
      services: 179,
    })
  })
})

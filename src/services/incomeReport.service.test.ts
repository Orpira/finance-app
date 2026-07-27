import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServiceIncome } from '../types/service'
import type { AppSettings } from '../types/settings'
import { createDefaultOnboardingState } from '../utils/onboarding'

const servicesTable = {
  get: vi.fn(),
  toArray: vi.fn(),
}

vi.mock('../database/db', () => ({
  db: {
    services: servicesTable,
  },
}))

const updateServiceIncomeMock = vi.fn()

vi.mock('./incomeService', () => ({
  updateServiceIncome: (...args: unknown[]) => updateServiceIncomeMock(...args),
}))

const getSettingsMock = vi.fn()

vi.mock('./settingsService', () => ({
  getSettings: () => getSettingsMock(),
}))

const {
  getPendingIncomeSummary,
  getPendingIncomes,
  markIncomeAsPending,
  markIncomeAsReported,
  markMultipleIncomesAsReported,
  PENDING_INCOME_OVERDUE_AFTER_DAYS,
} = await import('./incomeReport.service')

function baseSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    id: 'app',
    businessName: '',
    country: 'ES',
    city: '',
    language: 'es',
    timeZone: 'Europe/Madrid',
    dateFormat: 'dd/MM/yyyy',
    onboarding: createDefaultOnboardingState(),
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
    cutoffAnchorDate: '2026-01-01',
    googleDriveClientId: '',
    googleDriveConnected: false,
    closedLocationSeasons: [],
    reopenedLocationSeasons: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function income(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1,
    date: '2026-01-01',
    duration: 60,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 50,
    realGain: 50,
    eurValue: 50,
    copValue: 215000,
    exchangeRateUsed: 4300,
    type: 'ingreso',
    usageMode: 'professional',
    baseCurrency: 'EUR',
    baseCurrencyValue: 50,
    reportStatusCode: 'unreviewed',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getSettingsMock.mockResolvedValue(baseSettings())
})

describe('markIncomeAsReported', () => {
  it('throws when the income does not exist', async () => {
    servicesTable.get.mockResolvedValue(undefined)

    await expect(markIncomeAsReported(999)).rejects.toThrow(
      'El ingreso que intentas actualizar no existe.',
    )
  })

  it('rejects records that are not eligible for reporting (e.g. an adjustment)', async () => {
    servicesTable.get.mockResolvedValue(income({ type: 'ajuste' }))

    await expect(markIncomeAsReported(1)).rejects.toThrow()
    expect(updateServiceIncomeMock).not.toHaveBeenCalled()
  })

  it('forwards reportedAt/reference/notes to updateServiceIncome', async () => {
    servicesTable.get.mockResolvedValue(income())
    updateServiceIncomeMock.mockResolvedValue(income({ reportStatusCode: 'reported' }))

    await markIncomeAsReported(1, {
      reportedAt: '2026-02-10T00:00:00.000Z',
      reportReference: 'REF-1',
      reportNotes: 'nota',
    })

    expect(updateServiceIncomeMock).toHaveBeenCalledWith(1, {
      reportStatusCode: 'reported',
      reportStatusLabel: 'Reportado',
      reportedAt: '2026-02-10T00:00:00.000Z',
      reportReference: 'REF-1',
      reportNotes: 'nota',
    })
  })
})

describe('markIncomeAsPending', () => {
  it('reverts a reported income to pending and clears report metadata', async () => {
    servicesTable.get.mockResolvedValue(
      income({
        reportStatusCode: 'reported',
        reportedAt: '2026-02-10T00:00:00.000Z',
        reportReference: 'REF-1',
      }),
    )
    updateServiceIncomeMock.mockResolvedValue(income({ reportStatusCode: 'pending' }))

    await markIncomeAsPending(1)

    expect(updateServiceIncomeMock).toHaveBeenCalledWith(1, {
      reportStatusCode: 'pending',
      reportStatusLabel: 'Pendiente',
      reportedAt: undefined,
      reportReference: undefined,
      reportNotes: undefined,
    })
  })
})

describe('markMultipleIncomesAsReported', () => {
  it('marks every valid id and collects failures without aborting the batch', async () => {
    servicesTable.get.mockImplementation(async (id: number) => {
      if (id === 1) return income({ id: 1 })
      if (id === 2) return income({ id: 2, type: 'ajuste' })
      return undefined
    })
    updateServiceIncomeMock.mockImplementation(async (id: number, updates: object) => ({
      ...income({ id }),
      ...updates,
    }))

    const result = await markMultipleIncomesAsReported([1, 2, 3])

    expect(result.succeeded).toEqual([1])
    expect(result.failed).toHaveLength(2)
    expect(result.failed.map((failure) => failure.id).sort()).toEqual([2, 3])
  })
})

describe('getPendingIncomes / getPendingIncomeSummary', () => {
  it('only returns eligible, not-yet-reported incomes sorted by serviceDate ascending', async () => {
    servicesTable.toArray.mockResolvedValue([
      income({ id: 1, date: '2026-01-10', reportStatusCode: 'pending' }),
      income({ id: 2, date: '2026-01-05', reportStatusCode: 'unreviewed' }),
      income({ id: 3, date: '2026-01-01', reportStatusCode: 'reported' }),
      income({ id: 4, date: '2026-01-08', type: 'ajuste', reportStatusCode: 'pending' }),
    ])

    const pending = await getPendingIncomes()

    expect(pending.map((item) => item.id)).toEqual([2, 1])
  })

  it('summarizes count, base-currency total, oldest date and overdue count', async () => {
    const now = new Date('2026-01-20T00:00:00.000Z')
    vi.setSystemTime(now)

    servicesTable.toArray.mockResolvedValue([
      income({
        id: 1,
        date: '2026-01-19',
        reportStatusCode: 'pending',
        baseCurrencyValue: 30,
      }),
      income({
        id: 2,
        date: '2026-01-01',
        reportStatusCode: 'unreviewed',
        baseCurrencyValue: 70,
      }),
    ])

    const summary = await getPendingIncomeSummary()

    expect(summary.count).toBe(2)
    expect(summary.totalBaseCurrency).toBe(100)
    expect(summary.baseCurrency).toBe('EUR')
    expect(summary.oldestPendingDate).toBe('2026-01-01')
    expect(summary.overdueCount).toBe(1)
    expect(PENDING_INCOME_OVERDUE_AFTER_DAYS).toBe(7)

    vi.useRealTimers()
  })

  it('returns an empty summary when there are no pending incomes', async () => {
    servicesTable.toArray.mockResolvedValue([])

    const summary = await getPendingIncomeSummary()

    expect(summary).toEqual({
      count: 0,
      totalBaseCurrency: 0,
      baseCurrency: 'EUR',
      oldestPendingDate: null,
      overdueCount: 0,
    })
  })
})

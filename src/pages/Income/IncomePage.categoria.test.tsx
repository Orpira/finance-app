// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { DialogProvider } from '../../components/dialogs/DialogProvider'
import type { AppSettings } from '../../types/settings'

const settingsService = {
  getSettings: vi.fn(),
}
vi.mock('../../services/settingsService', () => ({
  getSettings: (...args: unknown[]) => settingsService.getSettings(...args),
}))

const incomeService = {
  createServiceIncome: vi.fn(),
  updateServiceIncome: vi.fn(),
  getServiceIncomeById: vi.fn(),
  listServiceIncomes: vi.fn(),
}
vi.mock('../../services/incomeService', () => ({
  createServiceIncome: (...args: unknown[]) => incomeService.createServiceIncome(...args),
  updateServiceIncome: (...args: unknown[]) => incomeService.updateServiceIncome(...args),
  getServiceIncomeById: (...args: unknown[]) => incomeService.getServiceIncomeById(...args),
  listServiceIncomes: (...args: unknown[]) => incomeService.listServiceIncomes(...args),
}))

const earningPeriodService = {
  getActiveEarningPeriod: vi.fn(),
  getEarningPeriodById: vi.fn(),
  isEarningPeriodClosed: vi.fn(),
}
vi.mock('../../services/earningPeriodService', () => ({
  getActiveEarningPeriod: (...args: unknown[]) => earningPeriodService.getActiveEarningPeriod(...args),
  getEarningPeriodById: (...args: unknown[]) => earningPeriodService.getEarningPeriodById(...args),
  isEarningPeriodClosed: (...args: unknown[]) => earningPeriodService.isEarningPeriodClosed(...args),
}))

const incomeAdditionalService = {
  addIncomeAdditional: vi.fn(),
  deleteIncomeAdditional: vi.fn(),
  listIncomeAdditionals: vi.fn(),
}
vi.mock('../../services/incomeAdditionalService', () => ({
  addIncomeAdditional: (...args: unknown[]) => incomeAdditionalService.addIncomeAdditional(...args),
  deleteIncomeAdditional: (...args: unknown[]) => incomeAdditionalService.deleteIncomeAdditional(...args),
  listIncomeAdditionals: (...args: unknown[]) => incomeAdditionalService.listIncomeAdditionals(...args),
}))

const exchangeRateService = {
  saveExchangeRate: vi.fn(),
}
vi.mock('../../services/exchangeRateService', () => ({
  saveExchangeRate: (...args: unknown[]) => exchangeRateService.saveExchangeRate(...args),
}))

const currencyConversionService = {
  convertCurrencyPair: vi.fn(),
  convertCurrencyToEurCop: vi.fn(),
}
vi.mock('../../services/currencyConversionService', () => ({
  convertCurrencyPair: (...args: unknown[]) => currencyConversionService.convertCurrencyPair(...args),
  convertCurrencyToEurCop: (...args: unknown[]) => currencyConversionService.convertCurrencyToEurCop(...args),
}))

const categoryService = {
  createPersonalIncomeCategory: vi.fn(),
  getPersonalIncomeCategoryById: vi.fn(),
  listPersonalIncomeCategories: vi.fn(),
}
vi.mock('../../services/personalIncomeCategoryService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/personalIncomeCategoryService')>()
  return {
    ...actual,
    createPersonalIncomeCategory: (...args: unknown[]) => categoryService.createPersonalIncomeCategory(...args),
    getPersonalIncomeCategoryById: (...args: unknown[]) => categoryService.getPersonalIncomeCategoryById(...args),
    listPersonalIncomeCategories: (...args: unknown[]) => categoryService.listPersonalIncomeCategories(...args),
  }
})

// This suite never exercises Wallets; stub it out so IncomePage's real import of
// walletService (and therefore the real Dexie `db`) never touches IndexedDB, which
// this jsdom environment doesn't provide.
vi.mock('../../services/walletService', () => ({
  getWalletById: async () => undefined,
  listWallets: async () => [],
  WALLETS_CHANGED_EVENT: 'finance-app:wallets-changed',
}))

const { IncomePage } = await import('./IncomePage')

function basicSettings(): AppSettings {
  return {
    usageMode: 'basic',
    incomePercentage: 50,
    incomeCalculationMethod: 'service_duration',
    hourlyRate: 0,
    workedTimeUnit: 'minutes',
    rateMode: 'manual',
    defaultCurrency: 'EUR',
    secondaryCurrency: 'COP',
  } as AppSettings
}

function professionalSettings(): AppSettings {
  return { ...basicSettings(), usageMode: 'professional' } as AppSettings
}

function renderIncomePage(initialEntry = '/income/nuevo') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DialogProvider>
        <Routes>
          <Route element={<IncomePage />} path="/income/nuevo" />
          <Route element={<IncomePage />} path="/income/:incomeId/editar" />
        </Routes>
      </DialogProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('IncomePage — ingresos sin categorías', () => {
  for (const mode of ['basic', 'professional'] as const) {
    it(`no ofrece categorías en modo ${mode}`, async () => {
      settingsService.getSettings.mockResolvedValue(mode === 'basic' ? basicSettings() : professionalSettings())
      incomeService.listServiceIncomes.mockResolvedValue([])
      earningPeriodService.getActiveEarningPeriod.mockResolvedValue(mode === 'basic' ? null : { id: 7, startDate: '2026-01-01', percentage: 50 })
      currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 0, secondaryValue: 0 })
      currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 0, copValue: 0 })

      renderIncomePage()
      await screen.findByText(mode === 'basic' ? 'Wallet de destino' : 'Tipo de registro')
      expect(screen.queryByRole('combobox', { name: 'Categoría' })).toBeNull()
      expect(screen.queryByRole('button', { name: /Nueva categoría/ })).toBeNull()
      expect(categoryService.listPersonalIncomeCategories).not.toHaveBeenCalled()
    })
  }

  it('abre un ingreso histórico categorizado sin depender del catálogo', async () => {
    settingsService.getSettings.mockResolvedValue(basicSettings())
    incomeService.listServiceIncomes.mockResolvedValue([])
    incomeService.getServiceIncomeById.mockResolvedValue({
      id: 42, date: '2026-01-01', duration: 0, totalAmount: 100,
      currency: 'EUR', percentage: 100, realGain: 100, eurValue: 100,
      copValue: 0, exchangeRateUsed: 1, usageMode: 'basic',
      personalName: 'Nómina', personalCategoryId: 'pic-archived',
    })
    earningPeriodService.getActiveEarningPeriod.mockResolvedValue(null)
    incomeAdditionalService.listIncomeAdditionals.mockResolvedValue([])
    currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 100, secondaryValue: 0 })
    currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 100, copValue: 0 })

    renderIncomePage('/income/42/editar')
    await screen.findByDisplayValue('Nómina')
    expect(screen.queryByRole('combobox', { name: 'Categoría' })).toBeNull()
    expect(categoryService.getPersonalIncomeCategoryById).not.toHaveBeenCalled()
  })
})

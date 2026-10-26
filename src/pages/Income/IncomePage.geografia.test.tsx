// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

const seasonStayService = { listSelectableSeasonStays: vi.fn() }
vi.mock('../../services/seasonStayService', () => ({
  listSelectableSeasonStays: (...args: unknown[]) => seasonStayService.listSelectableSeasonStays(...args),
}))
const recordGeographyService = { resolveCreateRecordGeography: vi.fn() }
vi.mock('../../services/recordGeographyService', () => ({
  resolveCreateRecordGeography: (...args: unknown[]) => recordGeographyService.resolveCreateRecordGeography(...args),
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

function arrange(settings: AppSettings, period: unknown) {
  settingsService.getSettings.mockResolvedValue(settings)
  incomeService.listServiceIncomes.mockResolvedValue([])
  earningPeriodService.getActiveEarningPeriod.mockResolvedValue(period)
  categoryService.listPersonalIncomeCategories.mockResolvedValue([])
  currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 0, secondaryValue: 0 })
  currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 0, copValue: 0 })
  const stay = {
    id: 3, earningPeriodId: 7, position: 0, city: 'Madrid', cityNormalized: 'madrid', countryCode: 'ES',
    status: 'active', actualStartAt: '2026-01-02T08:00:00.000Z', timeZone: 'Europe/Madrid',
    locationSource: 'manual', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
  seasonStayService.listSelectableSeasonStays.mockResolvedValue([{
    stay, id: 3, earningPeriodId: 7, status: 'active', city: 'Madrid', visitNumber: 1,
    label: 'Madrid · 1.ª visita', selectable: true, selected: false,
  }])
  recordGeographyService.resolveCreateRecordGeography.mockResolvedValue({})
}

const professionalPeriod = { id: 7, startDate: '2026-01-01', percentage: 50, countryCode: 'ES', status: 'active' }

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('IncomePage — estancia y destino según el modo de uso (PB-GEO-002)', () => {
  it('Personal no muestra ni consulta estancias', async () => {
    arrange(basicSettings(), null)
    renderIncomePage()
    await screen.findByText('Categoría')
    expect(screen.queryByText('Ubicación')).toBeNull()
    expect(seasonStayService.listSelectableSeasonStays).not.toHaveBeenCalled()
  })

  it('Profesional muestra la estancia de la temporada activa', async () => {
    arrange(professionalSettings(), professionalPeriod)
    renderIncomePage()
    expect(await screen.findByText('Ubicación')).toBeTruthy()
    await waitFor(() => expect(seasonStayService.listSelectableSeasonStays).toHaveBeenCalledWith(
      expect.objectContaining({ earningPeriodId: 7, recordKind: 'income' }),
    ))
    expect(screen.getByRole('checkbox', { name: /Destino puntual/ })).toBeTruthy()
  })

  it('Híbrido en contexto Personal no muestra campos profesionales', async () => {
    arrange({ ...basicSettings(), usageMode: 'hybrid', activeContext: 'basic' } as AppSettings, null)
    renderIncomePage()
    await screen.findByText('Categoría')
    expect(screen.queryByText('Ubicación')).toBeNull()
    expect(seasonStayService.listSelectableSeasonStays).not.toHaveBeenCalled()
  })

  it('Híbrido en contexto Profesional sí muestra la estancia', async () => {
    arrange({ ...basicSettings(), usageMode: 'hybrid', activeContext: 'professional' } as AppSettings, professionalPeriod)
    renderIncomePage()
    expect(await screen.findByText('Ubicación')).toBeTruthy()
  })
})

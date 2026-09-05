// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { DialogProvider } from '../../components/dialogs/DialogProvider'
import type { PersonalIncomeCategory } from '../../types/personalIncomeCategory'
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

function category(overrides: Partial<PersonalIncomeCategory> = {}): PersonalIncomeCategory {
  return {
    id: 'pic-1',
    name: 'Nómina',
    normalizedName: 'nomina',
    usageMode: 'basic',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
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

describe('IncomePage — categoría de ingreso personal', () => {
  it('muestra el selector "Categoría" en modo Personal', async () => {
    settingsService.getSettings.mockResolvedValue(basicSettings())
    incomeService.listServiceIncomes.mockResolvedValue([])
    earningPeriodService.getActiveEarningPeriod.mockResolvedValue(null)
    categoryService.listPersonalIncomeCategories.mockResolvedValue([category()])
    currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 0, secondaryValue: 0 })
    currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 0, copValue: 0 })

    renderIncomePage()

    await screen.findByText('Categoría')
    screen.getByText('Nómina')
    screen.getByText('Sin categoría')
  })

  it('oculta el selector "Categoría" en modo Profesional', async () => {
    settingsService.getSettings.mockResolvedValue(professionalSettings())
    incomeService.listServiceIncomes.mockResolvedValue([])
    earningPeriodService.getActiveEarningPeriod.mockResolvedValue({ id: 7, startDate: '2026-01-01', percentage: 50 })
    categoryService.listPersonalIncomeCategories.mockResolvedValue([])
    currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 0, secondaryValue: 0 })
    currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 0, copValue: 0 })

    renderIncomePage()

    await screen.findByText('Tipo de registro')
    expect(screen.queryByText('Categoría')).toBeNull()
  })

  it('permite seleccionar y retirar una categoría', async () => {
    settingsService.getSettings.mockResolvedValue(basicSettings())
    incomeService.listServiceIncomes.mockResolvedValue([])
    earningPeriodService.getActiveEarningPeriod.mockResolvedValue(null)
    categoryService.listPersonalIncomeCategories.mockResolvedValue([category()])
    currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 0, secondaryValue: 0 })
    currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 0, copValue: 0 })

    renderIncomePage()
    await screen.findByText('Categoría')

    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'pic-1' } })
    expect(select.value).toBe('pic-1')

    fireEvent.change(select, { target: { value: '' } })
    expect(select.value).toBe('')
  })

  it('crea una categoría desde "Nueva categoría" y la selecciona automáticamente', async () => {
    settingsService.getSettings.mockResolvedValue(basicSettings())
    incomeService.listServiceIncomes.mockResolvedValue([])
    earningPeriodService.getActiveEarningPeriod.mockResolvedValue(null)
    categoryService.listPersonalIncomeCategories.mockResolvedValue([])
    categoryService.createPersonalIncomeCategory.mockResolvedValue(category({ id: 'pic-2', name: 'Reembolsos', normalizedName: 'reembolsos' }))
    currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 0, secondaryValue: 0 })
    currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 0, copValue: 0 })

    renderIncomePage()
    await screen.findByText('Categoría')

    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(dialog.querySelector('input') as HTMLInputElement, { target: { value: 'Reembolsos' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Crear' }))

    await waitFor(() => expect(categoryService.createPersonalIncomeCategory).toHaveBeenCalledWith({ name: 'Reembolsos' }))
    const select = await screen.findByRole('combobox') as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('pic-2'))
  })

  it('al editar, muestra una categoría archivada asignada con la indicación "Archivada" y permite retirarla', async () => {
    settingsService.getSettings.mockResolvedValue(basicSettings())
    incomeService.listServiceIncomes.mockResolvedValue([])
    incomeService.getServiceIncomeById.mockResolvedValue({
      id: 42,
      date: '2026-01-01',
      duration: 0,
      totalAmount: 100,
      currency: 'EUR',
      percentage: 0,
      realGain: 100,
      eurValue: 100,
      copValue: 0,
      exchangeRateUsed: 1,
      usageMode: 'basic',
      personalCategoryId: 'pic-archived',
    })
    earningPeriodService.getActiveEarningPeriod.mockResolvedValue(null)
    incomeAdditionalService.listIncomeAdditionals.mockResolvedValue([])
    categoryService.listPersonalIncomeCategories.mockResolvedValue([])
    categoryService.getPersonalIncomeCategoryById.mockResolvedValue(
      category({ id: 'pic-archived', name: 'Antigua', normalizedName: 'antigua', isArchived: true }),
    )
    currencyConversionService.convertCurrencyPair.mockResolvedValue({ primaryValue: 0, secondaryValue: 0 })
    currencyConversionService.convertCurrencyToEurCop.mockResolvedValue({ eurValue: 0, copValue: 0 })

    renderIncomePage('/income/42/editar')

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('pic-archived'))
    screen.getByText('Antigua · Archivada')

    fireEvent.change(select, { target: { value: '' } })
    expect(select.value).toBe('')
  })
})

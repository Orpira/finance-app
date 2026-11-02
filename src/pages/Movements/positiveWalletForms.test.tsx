// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const dialog = vi.hoisted(() => ({ alert: vi.fn(), prompt: vi.fn() }))
vi.mock('../../services/settingsService', () => ({ getSettings: async () => ({ usageMode: 'basic', defaultCurrency: 'EUR', secondaryCurrency: 'COP', incomeCalculationMethod: 'service_duration', incomePercentage: 100, hourlyRate: 0, workedTimeUnit: 'minutes', rateMode: 'manual' }) }))
vi.mock('../../services/walletService', () => ({
  listWalletsWithBalances: async (_currency: string, options: { archived?: string } = {}) => {
    const wallets = [
      { id: 'zero', name: 'Vacía', balance: 0, isDefault: true, isArchived: false },
      { id: 'positive', name: 'Banco', balance: 146.5, isDefault: false, isArchived: false },
      { id: 'negative', name: 'Déficit', balance: -10, isDefault: false, isArchived: false },
      { id: 'archived', name: 'Archivada', balance: 10, isDefault: false, isArchived: true },
    ]
    return options.archived === 'active'
      ? wallets.filter((wallet) => !wallet.isArchived)
      : wallets
  },
  getWalletById: vi.fn(), createWallet: vi.fn(), normalizeWalletName: vi.fn(), WALLETS_CHANGED_EVENT: 'wallets',
}))
vi.mock('../../services/incomeService', () => ({ listServiceIncomes: async () => [], getServiceIncomeById: vi.fn(), createServiceIncome: vi.fn(), updateServiceIncome: vi.fn() }))
vi.mock('../../services/earningPeriodService', () => ({ getActiveEarningPeriod: async () => null, getEarningPeriodById: vi.fn(), isEarningPeriodClosed: async () => false }))
const { createExpenseMock } = vi.hoisted(() => ({ createExpenseMock: vi.fn() }))
vi.mock('../../services/expenseService', () => ({
  createExpense: createExpenseMock,
  getExpenseById: vi.fn(),
  updateExpense: vi.fn(),
  getAdjustmentCapacity: vi.fn(),
}))
vi.mock('../../services/personalExpenseCategoryService', () => ({ listPersonalExpenseCategories: async () => [], getPersonalExpenseCategoryById: vi.fn(), createPersonalExpenseCategory: vi.fn(), normalizePersonalExpenseCategoryName: vi.fn() }))
vi.mock('../../services/currencyConversionService', () => ({ convertCurrencyPair: async () => ({ primaryValue: 0, secondaryValue: 0 }), convertCurrencyToEurCop: async () => ({ eurValue: 0, copValue: 0 }) }))
vi.mock('../../services/exchangeRateService', () => ({ saveExchangeRate: vi.fn() }))
vi.mock('../../services/incomeAdditionalService', () => ({ addIncomeAdditional: vi.fn(), deleteIncomeAdditional: vi.fn(), listIncomeAdditionals: async () => [] }))
vi.mock('../../components/dialogs/useDialog', () => ({ useDialog: () => dialog }))
import { IncomePage } from '../Income/IncomePage'
import { ExpensesPage } from '../Expenses/ExpensesPage'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('muestra todas las wallets activas en Ingresos, incluso sin saldo positivo', async () => {
  render(<MemoryRouter><IncomePage /></MemoryRouter>)
  const select = await screen.findByRole('combobox', { name: 'Wallet de destino' }) as HTMLSelectElement
  await waitFor(() => expect(Array.from(select.options).map((option) => option.text)).toContain('Déficit'))
  expect(Array.from(select.options).map((option) => option.text)).toEqual([
    'Sin wallet', 'Vacía', 'Banco', 'Déficit',
  ])
  expect(select.value).toBe('')
})

it('ofrece solo wallets con saldo positivo en Egresos y no preselecciona una vacía', async () => {
  render(<MemoryRouter><ExpensesPage /></MemoryRouter>)
  const select = await screen.findByRole('combobox', { name: 'Wallet de origen' }) as HTMLSelectElement
  await waitFor(() => expect(Array.from(select.options).map((option) => option.text)).toContain('Banco'))
  expect(Array.from(select.options).map((option) => option.text)).toEqual(['Sin wallet', 'Banco'])
  expect(select.value).toBe('')
})

it('permite registrar un egreso personal como pagado físicamente', async () => {
  render(<MemoryRouter><ExpensesPage /></MemoryRouter>)

  const paidCheckbox = await screen.findByRole('checkbox')
  fireEvent.click(paidCheckbox)
  expect(paidCheckbox).toHaveProperty('checked', true)

  fireEvent.change(screen.getByRole('spinbutton', { name: 'Importe' }), {
    target: { value: '25' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar egreso' }))

  await waitFor(() => {
    expect(createExpenseMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gasto', isPhysicallyPaid: true }),
    )
  })
})

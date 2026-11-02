// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const {
  alertMock,
  confirmMock,
  getSettingsMock,
  listExpensesMock,
  listWalletsMock,
  updateExpenseMock,
} = vi.hoisted(() => ({
  alertMock: vi.fn(),
  confirmMock: vi.fn(),
  getSettingsMock: vi.fn(),
  listExpensesMock: vi.fn(),
  listWalletsMock: vi.fn(),
  updateExpenseMock: vi.fn(),
}))

vi.mock('../../components/dialogs/useDialog', () => ({
  useDialog: () => ({ alert: alertMock, confirm: confirmMock }),
}))
vi.mock('../../hooks/useSensitiveValues', () => ({
  useSensitiveValues: () => ({ hidden: false }),
}))
vi.mock('../../services/expenseService', () => ({
  deleteExpense: vi.fn(),
  listExpenses: listExpensesMock,
  updateExpense: updateExpenseMock,
}))
vi.mock('../../services/incomeService', () => ({ listServiceIncomes: async () => [] }))
vi.mock('../../services/settingsService', () => ({ getSettings: getSettingsMock }))
vi.mock('../../services/earningPeriodService', () => ({ getActiveEarningPeriod: async () => undefined }))
vi.mock('../../services/personalExpenseCategoryService', () => ({
  listPersonalExpenseCategories: async () => [],
  PERSONAL_EXPENSE_CATEGORIES_CHANGED_EVENT: 'personal-expense-categories',
}))
vi.mock('../../services/walletService', () => ({
  getWalletName: (record: { walletId?: string }, wallets: { id: string; name: string }[]) =>
    wallets.find((wallet) => wallet.id === record.walletId)?.name,
  listWallets: listWalletsMock,
  WALLETS_CHANGED_EVENT: 'wallets',
}))

import { ExpenseListPage } from './ExpenseListPage'

const expense = {
  id: 8,
  type: 'gasto' as const,
  usageMode: 'basic' as const,
  personalName: 'Compra de comida',
  date: '2026-10-25',
  category: 'Alimentación',
  amount: 25,
  currency: 'EUR',
  eurValue: 25,
  copValue: 100_000,
  walletId: 'cash',
  createdAt: '2026-10-25T10:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  getSettingsMock.mockResolvedValue({ usageMode: 'basic' })
  listExpensesMock.mockResolvedValue([expense])
  listWalletsMock.mockResolvedValue([{ id: 'cash', name: 'Efectivo' }])
  updateExpenseMock.mockImplementation(async (_id: number, updates: object) => ({
    ...expense,
    ...updates,
  }))
})

afterEach(cleanup)

it('permite marcar/desmarcar el pago físico y tacha su fuente en Personal', async () => {
  render(
    <MemoryRouter>
      <ExpenseListPage />
    </MemoryRouter>,
  )

  const markButton = await screen.findByRole('button', { name: 'Marcar pago físico' })
  const source = screen.getByText('Efectivo')
  expect(source.classList.contains('line-through')).toBe(false)

  fireEvent.click(markButton)
  await waitFor(() => expect(source.classList.contains('line-through')).toBe(true))
  expect(updateExpenseMock).toHaveBeenLastCalledWith(8, { isPhysicallyPaid: true })
  expect(screen.getByRole('button', { name: 'Pago realizado físicamente' }).getAttribute('aria-pressed'))
    .toBe('true')

  fireEvent.click(screen.getByRole('button', { name: 'Pago realizado físicamente' }))
  await waitFor(() => expect(source.classList.contains('line-through')).toBe(false))
  expect(updateExpenseMock).toHaveBeenLastCalledWith(8, { isPhysicallyPaid: false })
})

it('no muestra la opción de pago físico en Profesional', async () => {
  getSettingsMock.mockResolvedValue({ usageMode: 'professional' })
  listExpensesMock.mockResolvedValue([{ ...expense, usageMode: 'professional' }])

  render(
    <MemoryRouter>
      <ExpenseListPage />
    </MemoryRouter>,
  )

  await screen.findByText('Registros de egresos')
  expect(screen.queryByRole('button', { name: /pago físico/i })).toBeNull()
  expect(screen.queryByText('Fuente:')).toBeNull()
})

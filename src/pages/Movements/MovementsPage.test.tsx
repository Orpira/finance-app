// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const { getSettings } = vi.hoisted(() => ({ getSettings: vi.fn() }))
vi.mock('../../services/settingsService', () => ({ getSettings }))
vi.mock('../../services/incomeService', () => ({ listServiceIncomes: async () => [] }))
vi.mock('../../services/expenseService', () => ({ listExpenses: async () => [] }))
vi.mock('../../services/personalExpenseCategoryService', () => ({
  listPersonalExpenseCategories: async () => [], PERSONAL_EXPENSE_CATEGORIES_CHANGED_EVENT: 'categories',
}))
vi.mock('../../services/internalTransferService', () => ({
  listInternalTransfers: async () => [{ id: 't1', fromWalletId: 'bank', toWalletId: 'home', amount: 10, currency: 'EUR', date: '2026-11-01', usageMode: 'basic' }],
  INTERNAL_TRANSFERS_CHANGED_EVENT: 'transfers',
}))
vi.mock('../../services/walletService', () => ({
  listWallets: async () => [], getWalletName: (wallet: string) => wallet,
  WALLETS_CHANGED_EVENT: 'wallets',
}))
vi.mock('../Income/IncomeListPage', () => ({ default: () => <div>Lista de ingresos</div> }))
vi.mock('../Expenses/ExpenseListPage', () => ({ default: () => <div>Lista de egresos</div> }))
import { MovementsPage } from './MovementsPage'

beforeEach(() => { sessionStorage.clear(); getSettings.mockReset() })
afterEach(cleanup)

it('ofrece transferencias en Personal y abre su historial con filtros compatibles', async () => {
  getSettings.mockResolvedValue({ usageMode: 'basic' })
  render(<MemoryRouter initialEntries={['/movements?tab=transferencias&type=income&reported=reported&category=Comida']}><MovementsPage /></MemoryRouter>)
  const tab = await screen.findByRole('tab', { name: 'Transferencias' })
  await waitFor(() => expect(tab.getAttribute('aria-selected')).toBe('true'))
  expect(await screen.findByRole('link', { name: /Transferir entre wallets/ })).toHaveProperty('href', expect.stringContaining('/transfers/nuevo'))
  expect(await screen.findByRole('link', { name: /10,00/ })).toHaveProperty('href', expect.stringContaining('/transfers/t1'))
  fireEvent.click(screen.getByRole('button', { name: /Filtros/ }))
  expect(screen.queryByText('Estado de reporte')).toBeNull()
  expect(screen.queryByText('Categoría')).toBeNull()
  expect(screen.getByText('Moneda')).toBeTruthy()
})

it('no ofrece transferencias en Profesional aunque la URL las solicite', async () => {
  getSettings.mockResolvedValue({ usageMode: 'professional' })
  render(<MemoryRouter initialEntries={['/movements?tab=transferencias']}><MovementsPage /></MemoryRouter>)
  await screen.findByText('Aún no hay movimientos')
  expect(screen.queryByRole('tab', { name: 'Transferencias' })).toBeNull()
  expect(screen.queryByRole('link', { name: /Transferir entre wallets/ })).toBeNull()
})

it('ofrece transferencias en el contexto Personal del modo Híbrido', async () => {
  getSettings.mockResolvedValue({ usageMode: 'hybrid', activeContext: 'basic' })
  render(<MemoryRouter><MovementsPage /></MemoryRouter>)
  expect(await screen.findByRole('tab', { name: 'Transferencias' })).toBeTruthy()
})

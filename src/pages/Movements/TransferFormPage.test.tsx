// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const { getTransfer, updateTransfer, createTransfer, alert } = vi.hoisted(() => ({
  getTransfer: vi.fn(), updateTransfer: vi.fn(), createTransfer: vi.fn(), alert: vi.fn(),
}))
vi.mock('../../services/internalTransferService', () => ({
  INTERNAL_TRANSFERS_CHANGED_EVENT: 'transfers',
  getInternalTransferById: getTransfer, updateInternalTransfer: updateTransfer, createInternalTransfer: createTransfer,
}))
vi.mock('../../services/settingsService', () => ({ getSettings: async () => ({ usageMode: 'basic', defaultCurrency: 'COP' }) }))
vi.mock('../../components/dialogs/useDialog', () => ({ useDialog: () => ({ alert }) }))
vi.mock('../../services/walletService', () => ({ WALLETS_CHANGED_EVENT: 'wallets', listWalletsWithBalances: async () => [
  { id: 'bank', name: 'Banco', balance: 40, usageMode: 'basic', isArchived: false },
  { id: 'home', name: 'Casa', balance: 60, usageMode: 'basic', isArchived: false },
] }))
import { TransferFormPage } from './TransferFormPage'

const original = { id: 't1', fromWalletId: 'bank', toWalletId: 'home', amount: 60, currency: 'EUR', date: '2026-10-31', note: 'Nota original', usageMode: 'basic', updatedAt: '2026-10-31T10:00:00Z' }
function show() {
  render(<MemoryRouter initialEntries={['/transfers/t1/editar']}><Routes>
    <Route path="/transfers/:id/editar" element={<TransferFormPage />} />
    <Route path="/transfers/:id" element={<p>Detalle actualizado</p>} />
  </Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.clearAllMocks()
  getTransfer.mockResolvedValue(original)
  updateTransfer.mockResolvedValue(original)
})
afterEach(cleanup)

it('precarga los datos y modifica el registro existente con control de versión', async () => {
  show()
  expect(await screen.findByDisplayValue('60')).toBeTruthy()
  expect(screen.getByLabelText('Origen')).toHaveProperty('value', 'bank')
  expect(screen.getByLabelText('Destino')).toHaveProperty('value', 'home')
  expect(screen.getByLabelText('Fecha')).toHaveProperty('value', '2026-10-31')
  expect(screen.getByLabelText('Nota (opcional)')).toHaveProperty('value', 'Nota original')
  expect(screen.getAllByText(/€/).length).toBeGreaterThan(0)
  fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '80' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByText('Detalle actualizado')
  expect(updateTransfer).toHaveBeenCalledWith('t1', { fromWalletId: 'bank', toWalletId: 'home', amount: 80, date: '2026-10-31', note: 'Nota original' }, original.updatedAt)
  expect(createTransfer).not.toHaveBeenCalled()
})
it('informa un rechazo sin navegar ni crear otra transferencia', async () => {
  updateTransfer.mockRejectedValue(new Error('Saldo insuficiente'))
  show()
  await screen.findByDisplayValue('60')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.objectContaining({ message: 'Saldo insuficiente' })))
  expect(screen.queryByText('Detalle actualizado')).toBeNull()
  expect(createTransfer).not.toHaveBeenCalled()
})
it('no permite guardar si la transferencia se eliminó', async () => {
  getTransfer.mockResolvedValue(undefined)
  show()
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Esta transferencia ya no existe.')
  expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
})

it('Trasladar todo repone la transferencia anterior al calcular el disponible en edición', async () => {
  show()
  await screen.findByDisplayValue('60')
  fireEvent.click(screen.getByRole('button', { name: 'Trasladar todo' }))
  expect(screen.getByLabelText('Importe')).toHaveProperty('value', '100.00')
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await screen.findByText('Detalle actualizado')
  expect(updateTransfer).toHaveBeenCalledWith('t1', expect.objectContaining({ amount: 100 }), original.updatedAt)
})

it('recalcula el importe de Trasladar todo al cambiar la wallet de origen', async () => {
  show()
  await screen.findByDisplayValue('60')
  fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'home' } })
  expect(screen.getByRole('button', { name: 'Trasladar todo' })).toHaveProperty('disabled', true)
})

it('Trasladar todo en una transferencia nueva utiliza el saldo de origen', async () => {
  render(<MemoryRouter initialEntries={['/transfers/nuevo']}><Routes>
    <Route path="/transfers/nuevo" element={<TransferFormPage />} />
    <Route path="/movements" element={<p>Transferencia registrada</p>} />
  </Routes></MemoryRouter>)
  await screen.findByLabelText('Origen')
  expect(screen.getByRole('button', { name: 'Trasladar todo' })).toHaveProperty('disabled', true)
  fireEvent.change(screen.getByLabelText('Origen'), { target: { value: 'bank' } })
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'home' } })
  fireEvent.click(screen.getByRole('button', { name: 'Trasladar todo' }))
  expect(screen.getByLabelText('Importe')).toHaveProperty('value', '40.00')
  fireEvent.click(screen.getByRole('button', { name: 'Transferir' }))
  await screen.findByText('Transferencia registrada')
  expect(createTransfer).toHaveBeenCalledWith(expect.objectContaining({ fromWalletId: 'bank', amount: 40 }))
})

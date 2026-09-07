// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const transferService = {
  listInternalTransfers: vi.fn(),
}
const walletService = {
  listWallets: vi.fn(),
}

vi.mock('../../services/internalTransferService', () => ({
  INTERNAL_TRANSFERS_CHANGED_EVENT: 'finance-app:internal-transfers-changed',
  listInternalTransfers: (...args: unknown[]) => transferService.listInternalTransfers(...args),
}))

vi.mock('../../services/walletService', () => ({
  WALLETS_CHANGED_EVENT: 'finance-app:wallets-changed',
  listWallets: (...args: unknown[]) => walletService.listWallets(...args),
}))

const { WalletActivityCard } = await import('./WalletActivityCard')

function currentMonthDate() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`
}

function renderCard() {
  return render(
    <MemoryRouter>
      <WalletActivityCard currency="EUR" hidden={false} />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WalletActivityCard', () => {
  it('muestra el estado vacío del mes sin transferencias', async () => {
    transferService.listInternalTransfers.mockResolvedValue([])
    walletService.listWallets.mockResolvedValue([])

    renderCard()

    await screen.findByText('0 transferencias')
    expect(screen.getByText('Sin movimientos entre ubicaciones')).toBeTruthy()
  })

  it('muestra cantidad, total y última ruta de transferencia del mes', async () => {
    transferService.listInternalTransfers.mockResolvedValue([
      {
        id: 'itx-1',
        fromWalletId: 'wal-bank',
        toWalletId: 'wal-home',
        amount: 150,
        currency: 'EUR',
        date: currentMonthDate(),
        usageMode: 'basic',
      },
    ])
    walletService.listWallets.mockResolvedValue([
      { id: 'wal-bank', name: 'Banco', usageMode: 'basic', isArchived: false },
      { id: 'wal-home', name: 'Casa', usageMode: 'basic', isArchived: false },
    ])

    renderCard()

    await screen.findByText('1 transferencia')
    expect(screen.getByText('Banco')).toBeTruthy()
    expect(screen.getByText('Casa')).toBeTruthy()
    expect(screen.getByText('150,00 €')).toBeTruthy()
  })
})

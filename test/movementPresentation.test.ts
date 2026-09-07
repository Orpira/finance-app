import { describe, expect, it } from 'vitest'

import { toUnifiedMovements } from '../src/pages/Movements/movementPresentation'
import type { ServiceIncome } from '../src/types/service'
import type { Expense } from '../src/types/expense'
import type { InternalTransfer } from '../src/types/internalTransfer'
import type { Wallet } from '../src/types/wallet'

function wallet(overrides: Partial<Wallet> = {}): Wallet {
  return {
    id: 'wal-1',
    name: 'Cuenta principal',
    normalizedName: 'cuenta principal',
    usageMode: 'basic',
    isDefault: true,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function income(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1,
    date: '2026-01-05',
    duration: 0,
    totalAmount: 500,
    currency: 'EUR',
    percentage: 100,
    realGain: 500,
    eurValue: 500,
    copValue: 0,
    exchangeRateUsed: 1,
    usageMode: 'basic',
    ...overrides,
  }
}

function expense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 1,
    type: 'gasto',
    date: '2026-01-06',
    category: 'Otros',
    amount: 100,
    currency: 'EUR',
    eurValue: 100,
    copValue: 0,
    createdAt: '2026-01-06T00:00:00',
    usageMode: 'basic',
    ...overrides,
  }
}

function transfer(overrides: Partial<InternalTransfer> = {}): InternalTransfer {
  return {
    id: 'itx-1',
    fromWalletId: 'wal-1',
    toWalletId: 'wal-2',
    amount: 150,
    currency: 'EUR',
    date: '2026-01-07',
    usageMode: 'basic',
    createdAt: '2026-01-07T00:00:00.000Z',
    updatedAt: '2026-01-07T00:00:00.000Z',
    ...overrides,
  }
}

describe('toUnifiedMovements — transferencias (spec §12/§13)', () => {
  const wallets = [wallet({ id: 'wal-1', name: 'Cuenta principal' }), wallet({ id: 'wal-2', name: 'Dinero en casa', isDefault: false })]

  it('nunca crea un movimiento de tipo income/expense a partir de una transferencia', () => {
    const movements = toUnifiedMovements([], [], [], [], [transfer()], wallets)
    expect(movements).toHaveLength(1)
    expect(movements[0].kind).toBe('transfer')
  })

  it('la transferencia queda claramente distinguida de ingresos y egresos', () => {
    const movements = toUnifiedMovements([income()], [expense()], [], [], [transfer()], wallets)
    const kinds = movements.map((movement) => movement.kind).sort()
    expect(kinds).toEqual(['expense', 'income', 'transfer'])

    const transferMovement = movements.find((movement) => movement.kind === 'transfer')
    expect(transferMovement?.walletLabel).toBe('Cuenta principal → Dinero en casa')
    expect(transferMovement?.amount).toBe(150)
    expect(transferMovement?.href).toBe('/transfers/itx-1')
  })

  it('el ingreso muestra la wallet de destino y el egreso la wallet de origen', () => {
    const movements = toUnifiedMovements(
      [income({ walletId: 'wal-1' })],
      [expense({ walletId: 'wal-2' })],
      [],
      [],
      [],
      wallets,
    )
    const incomeMovement = movements.find((movement) => movement.kind === 'income')
    const expenseMovement = movements.find((movement) => movement.kind === 'expense')
    expect(incomeMovement?.walletLabel).toBe('Cuenta principal')
    expect(expenseMovement?.walletLabel).toBe('Dinero en casa')
  })

  it('un ingreso o egreso sin walletId no muestra badge de wallet', () => {
    const movements = toUnifiedMovements([income()], [expense()], [], [], [], wallets)
    expect(movements.every((movement) => movement.walletLabel === undefined)).toBe(true)
  })
})

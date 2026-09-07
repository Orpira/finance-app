import { describe, expect, it } from 'vitest'

import {
  assertInternalTransfersAreValid,
  assertWalletsAreValid,
} from '../src/utils/walletImport'

function wallet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wal-1',
    name: 'Cuenta principal',
    normalizedName: 'cuenta principal',
    usageMode: 'basic',
    isDefault: false,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function transfer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'itx-1',
    fromWalletId: 'wal-1',
    toWalletId: 'wal-2',
    amount: 150,
    currency: 'EUR',
    date: '2026-01-10',
    usageMode: 'basic',
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('assertWalletsAreValid', () => {
  it('acepta una wallet válida sin referencias', () => {
    expect(() => assertWalletsAreValid([wallet()], [], [])).not.toThrow()
  })

  it('acepta un backup histórico sin wallets y sin referencias', () => {
    expect(() => assertWalletsAreValid([], [], [])).not.toThrow()
  })

  it('rechaza id inválido', () => {
    expect(() => assertWalletsAreValid([wallet({ id: '' })], [], [])).toThrow('WALLET_INVALID_ID')
  })

  it('rechaza nombre inválido', () => {
    expect(() => assertWalletsAreValid([wallet({ name: '   ' })], [], [])).toThrow('WALLET_INVALID_NAME')
  })

  it('rechaza usageMode distinto de "basic"', () => {
    expect(() => assertWalletsAreValid([wallet({ usageMode: 'professional' })], [], []))
      .toThrow('WALLET_INVALID_USAGE_MODE')
  })

  it('rechaza más de una wallet predeterminada', () => {
    expect(() =>
      assertWalletsAreValid(
        [
          wallet({ id: 'wal-1', isDefault: true }),
          wallet({ id: 'wal-2', name: 'Efectivo', normalizedName: 'efectivo', isDefault: true }),
        ],
        [],
        [],
      ),
    ).toThrow('WALLET_MULTIPLE_DEFAULTS')
  })

  it('rechaza IDs duplicados', () => {
    expect(() =>
      assertWalletsAreValid(
        [wallet({ id: 'wal-1' }), wallet({ id: 'wal-1', name: 'Otra', normalizedName: 'otra' })],
        [],
        [],
      ),
    ).toThrow('WALLET_DUPLICATE_ID')
  })

  it('rechaza un duplicado por nombre normalizado', () => {
    expect(() =>
      assertWalletsAreValid(
        [
          wallet({ id: 'wal-1', name: 'Cuenta', normalizedName: undefined }),
          wallet({ id: 'wal-2', name: '  CUENTA  ', normalizedName: undefined }),
        ],
        [],
        [],
      ),
    ).toThrow('WALLET_DUPLICATE_NAME')
  })

  it('permite una referencia existente desde un ingreso o egreso básico', () => {
    expect(() =>
      assertWalletsAreValid(
        [wallet({ id: 'wal-1' })],
        [{ usageMode: 'basic', walletId: 'wal-1' }],
        [{ usageMode: 'basic', walletId: 'wal-1' }],
      ),
    ).not.toThrow()
  })

  it('rechaza una referencia huérfana', () => {
    expect(() =>
      assertWalletsAreValid([wallet({ id: 'wal-1' })], [{ usageMode: 'basic', walletId: 'wal-inexistente' }], []),
    ).toThrow('WALLET_ORPHAN_REFERENCE')
  })

  it('rechaza una referencia de wallet en un registro profesional', () => {
    expect(() =>
      assertWalletsAreValid([wallet({ id: 'wal-1' })], [{ usageMode: 'professional', walletId: 'wal-1' }], []),
    ).toThrow('WALLET_NOT_ALLOWED_FOR_PROFESSIONAL')
  })

  it('permite una referencia a una wallet archivada (asignación histórica válida)', () => {
    expect(() =>
      assertWalletsAreValid(
        [wallet({ id: 'wal-1', isArchived: true })],
        [{ usageMode: 'basic', walletId: 'wal-1' }],
        [],
      ),
    ).not.toThrow()
  })
})

describe('assertInternalTransfersAreValid', () => {
  const wallets = [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2', name: 'Efectivo', normalizedName: 'efectivo' })]

  it('acepta una transferencia válida', () => {
    expect(() => assertInternalTransfersAreValid([transfer()], wallets)).not.toThrow()
  })

  it('rechaza wallet de origen inexistente', () => {
    expect(() => assertInternalTransfersAreValid([transfer({ fromWalletId: 'wal-x' })], wallets))
      .toThrow('INTERNAL_TRANSFER_INVALID_FROM_WALLET')
  })

  it('rechaza wallet de destino inexistente', () => {
    expect(() => assertInternalTransfersAreValid([transfer({ toWalletId: 'wal-x' })], wallets))
      .toThrow('INTERNAL_TRANSFER_INVALID_TO_WALLET')
  })

  it('rechaza origen y destino iguales', () => {
    expect(() => assertInternalTransfersAreValid([transfer({ toWalletId: 'wal-1' })], wallets))
      .toThrow('INTERNAL_TRANSFER_SAME_WALLET')
  })

  it('rechaza importe cero o negativo', () => {
    expect(() => assertInternalTransfersAreValid([transfer({ amount: 0 })], wallets))
      .toThrow('INTERNAL_TRANSFER_INVALID_AMOUNT')
    expect(() => assertInternalTransfersAreValid([transfer({ amount: -10 })], wallets))
      .toThrow('INTERNAL_TRANSFER_INVALID_AMOUNT')
  })

  it('rechaza IDs duplicados', () => {
    expect(() =>
      assertInternalTransfersAreValid([transfer({ id: 'itx-1' }), transfer({ id: 'itx-1' })], wallets),
    ).toThrow('INTERNAL_TRANSFER_DUPLICATE_ID')
  })

  it('rechaza usageMode distinto de "basic"', () => {
    expect(() => assertInternalTransfersAreValid([transfer({ usageMode: 'professional' })], wallets))
      .toThrow('INTERNAL_TRANSFER_INVALID_USAGE_MODE')
  })
})

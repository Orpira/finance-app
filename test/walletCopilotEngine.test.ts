import { describe, expect, it } from 'vitest'

import {
  canAnswerFinancialCopilotQuery,
} from '../src/intelligence/deterministic-copilot/financialCopilotEngine'
import {
  detectWalletCopilotIntent,
  findWalletsByQuery,
  resolveWalletCopilotPeriod,
  resolveWalletCopilotRequest,
  type WalletCopilotWallet,
} from '../src/intelligence/deterministic-copilot/walletCopilotEngine'

const NOW = '2026-09-08T10:00:00.000Z'

describe('detectWalletCopilotIntent — patrones de reconocimiento (spec §37)', () => {
  const cases: readonly [string, ReturnType<typeof detectWalletCopilotIntent>][] = [
    ['¿Cuánto dinero tengo?', 'wallet_total'],
    ['¿Cuánto tengo disponible?', 'wallet_total'],
    ['¿Cuál es mi saldo total?', 'wallet_total'],
    ['¿Cuánto tengo entre todas mis wallets?', 'wallet_total'],
    ['¿Cuánto dinero tengo registrado?', 'wallet_total'],
    ['¿Cuánto tengo en casa?', 'wallet_balance'],
    ['¿Cuál es el saldo de BBVA?', 'wallet_balance'],
    ['¿Cómo está distribuido mi dinero?', 'wallet_distribution'],
    ['¿Dónde tengo mi dinero?', 'wallet_distribution'],
    ['Muéstrame mis wallets', 'wallet_distribution'],
    ['¿Dónde tengo más dinero?', 'wallet_largest_balance'],
    ['¿Qué wallet tiene más saldo?', 'wallet_largest_balance'],
    ['¿Dónde tengo menos dinero?', 'wallet_smallest_balance'],
    ['¿Cuál es mi wallet predeterminada?', 'wallet_default'],
    ['¿Cuántas wallets tengo?', 'wallet_count'],
    ['¿Cuántas wallets activas tengo?', 'wallet_count'],
    ['¿Cuántas transferencias hice este mes?', 'wallet_transfers_summary'],
    ['¿Cuánto dinero moví entre wallets este mes?', 'wallet_transfers_summary'],
    ['Muéstrame la actividad de mis wallets', 'wallet_transfers_summary'],
    ['¿Cuál fue mi última transferencia?', 'wallet_latest_transfer'],
    ['¿De dónde salió mi última transferencia?', 'wallet_latest_transfer'],
  ]

  it.each(cases)('%s → %s', (query, expected) => {
    expect(detectWalletCopilotIntent(query)).toBe(expected)
  })

  it('nunca clasifica preguntas de resultado financiero como Wallet (spec §29/§36)', () => {
    expect(detectWalletCopilotIntent('¿Cuánto ingresé este mes?')).toBeNull()
    expect(detectWalletCopilotIntent('¿Cuánto gasté este mes?')).toBeNull()
    expect(detectWalletCopilotIntent('¿Cuál es mi balance del mes?')).toBeNull()
    expect(detectWalletCopilotIntent('¿Cómo va mi objetivo?')).toBeNull()
    expect(detectWalletCopilotIntent('Compara mis ingresos de esta temporada')).toBeNull()
  })

  it('no convierte un comando de transferencia en una consulta de lectura (spec §30)', () => {
    expect(detectWalletCopilotIntent('Transfiere 100 euros a Casa')).toBeNull()
  })

  it('el motor financiero tampoco reclama las preguntas de Wallets (sin solapamiento)', () => {
    expect(canAnswerFinancialCopilotQuery('¿Cuánto dinero tengo?')).toBe(false)
    expect(canAnswerFinancialCopilotQuery('¿Cuánto tengo en casa?')).toBe(false)
    expect(canAnswerFinancialCopilotQuery('¿Cómo está distribuido mi dinero?')).toBe(false)
  })

  it('las preguntas financieras validadas siguen siendo reclamadas solo por el motor financiero', () => {
    expect(canAnswerFinancialCopilotQuery('¿Cuánto gasté este mes?')).toBe(true)
    expect(detectWalletCopilotIntent('¿Cuánto gasté este mes?')).toBeNull()
  })
})

describe('resolveWalletCopilotPeriod — periodos soportados (spec §19)', () => {
  it('resuelve hoy, esta semana, este mes, mes anterior, este año y todo el historial', () => {
    expect(resolveWalletCopilotPeriod('¿cuántas transferencias hice hoy?', NOW)).toEqual(
      expect.objectContaining({ period: { from: '2026-09-08', to: '2026-09-08' } }),
    )
    expect(resolveWalletCopilotPeriod('¿cuánto moví esta semana?', NOW)).toEqual(
      expect.objectContaining({ period: { from: '2026-09-07', to: '2026-09-08' } }),
    )
    expect(resolveWalletCopilotPeriod('¿cuánto moví este mes?', NOW)).toEqual(
      expect.objectContaining({ period: { from: '2026-09-01', to: '2026-09-08' } }),
    )
    expect(resolveWalletCopilotPeriod('¿cuánto moví el mes anterior?', NOW)).toEqual(
      expect.objectContaining({ period: { from: '2026-08-01', to: '2026-08-31' } }),
    )
    expect(resolveWalletCopilotPeriod('¿cuánto moví este año?', NOW)).toEqual(
      expect.objectContaining({ period: { from: '2026-01-01', to: '2026-09-08' } }),
    )
    expect(resolveWalletCopilotPeriod('¿cuánto moví en todo el historial?', NOW)).toEqual(
      expect.objectContaining({ period: 'all' }),
    )
  })

  it('resuelve un nombre de mes explícito ("en agosto")', () => {
    expect(resolveWalletCopilotPeriod('¿cuál fue mi última transferencia en agosto?', NOW)).toEqual(
      expect.objectContaining({ period: { from: '2026-08-01', to: '2026-08-31' } }),
    )
  })

  it('devuelve null cuando no hay ninguna referencia de periodo (el llamador aplica su propio default)', () => {
    expect(resolveWalletCopilotPeriod('¿cuántas transferencias hice?', NOW)).toBeNull()
  })

  it('devuelve "unresolvable" para una referencia de periodo reconocible pero no soportada, en vez de usar todo el historial silenciosamente', () => {
    expect(resolveWalletCopilotPeriod('¿cuánto moví el trimestre pasado?', NOW)).toBe('unresolvable')
  })
})

describe('resolveWalletCopilotRequest — extracción de parámetros', () => {
  it('extrae el fragmento de nombre para wallet_balance preservando mayúsculas/tildes originales', () => {
    expect(resolveWalletCopilotRequest('¿Cuánto tengo en Dinero en Casa?', NOW)).toEqual({
      intent: 'wallet_balance',
      nameQuery: 'Dinero en Casa',
    })
  })

  it('distingue el alcance total/activas/archivadas para wallet_count', () => {
    expect(resolveWalletCopilotRequest('¿Cuántas wallets tengo?', NOW)).toEqual({ intent: 'wallet_count', scope: 'total' })
    expect(resolveWalletCopilotRequest('¿Cuántas wallets activas tengo?', NOW)).toEqual({ intent: 'wallet_count', scope: 'active' })
    expect(resolveWalletCopilotRequest('¿Cuántas tengo archivadas?', NOW)).toEqual({ intent: 'wallet_count', scope: 'archived' })
  })
})

const wallet = (overrides: Partial<WalletCopilotWallet>): WalletCopilotWallet => ({
  id: overrides.id ?? 'wal-1',
  name: overrides.name ?? 'Cuenta principal',
  normalizedName: overrides.normalizedName ?? 'cuenta principal',
  balance: overrides.balance ?? 0,
  isDefault: overrides.isDefault ?? false,
  isArchived: overrides.isArchived ?? false,
})

describe('findWalletsByQuery — coincidencia de nombres (spec §10/§38)', () => {
  const wallets: WalletCopilotWallet[] = [
    wallet({ id: 'w1', name: 'Dinero en casa', normalizedName: 'dinero en casa' }),
    wallet({ id: 'w2', name: 'Efectivo', normalizedName: 'efectivo' }),
    wallet({ id: 'w3', name: 'Cuenta principal', normalizedName: 'cuenta principal', isDefault: true }),
  ]

  it('coincide exacta, ignorando mayúsculas/tildes/espacios repetidos', () => {
    expect(findWalletsByQuery(wallets, 'Efectivo').matches.map((w) => w.id)).toEqual(['w2'])
    expect(findWalletsByQuery(wallets, '  efectivo  ').matches.map((w) => w.id)).toEqual(['w2'])
    expect(findWalletsByQuery(wallets, 'EFECTIVO').matches.map((w) => w.id)).toEqual(['w2'])
  })

  it('resuelve el alias documentado "casa" → "Dinero en casa"', () => {
    expect(findWalletsByQuery(wallets, 'casa').matches.map((w) => w.id)).toEqual(['w1'])
  })

  it('devuelve vacío para una wallet inexistente en vez de adivinar', () => {
    expect(findWalletsByQuery(wallets, 'Caja fuerte').matches).toHaveLength(0)
  })

  it('detecta ambigüedad entre coincidencias parciales sin ganador exacto', () => {
    const ambiguous: WalletCopilotWallet[] = [
      wallet({ id: 'a1', name: 'Banco Santander', normalizedName: 'banco santander' }),
      wallet({ id: 'a2', name: 'Banco BBVA', normalizedName: 'banco bbva' }),
    ]
    expect(findWalletsByQuery(ambiguous, 'banco').matches.map((w) => w.id).sort()).toEqual(['a1', 'a2'])
  })
})

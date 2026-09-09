import { beforeEach, describe, expect, it, vi } from 'vitest'

// Reuses the same in-memory Dexie fake as test/walletService.test.ts so this
// suite exercises the real walletService/internalTransferService read paths
// (balance derivation, transfer filtering) instead of hand-mocking numbers.

interface WalletRow {
  id: string
  name: string
  normalizedName: string
  usageMode: 'basic'
  isDefault: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

interface IncomeRow {
  id: number
  walletId?: string
  currency: string
  eurValue: number
}

interface ExpenseRow {
  id: number
  walletId?: string
  currency: string
  eurValue: number
}

interface TransferRow {
  id: string
  fromWalletId: string
  toWalletId: string
  amount: number
  currency: string
  date: string
  note?: string
  usageMode: 'basic'
  createdAt: string
  updatedAt: string
}

let wallets: WalletRow[]
let incomes: IncomeRow[]
let expenses: ExpenseRow[]
let transfers: TransferRow[]
let settingsRow: { defaultCurrency: string; usageMode: 'basic' | 'professional' | 'hybrid'; activeContext?: 'basic' | 'professional' }
let putCalls: number
let deleteCalls: number

function makeIndexedTable<T extends Record<string, unknown>>(
  getRows: () => T[],
  idField: keyof T,
) {
  return {
    async get(id: unknown) {
      return getRows().find((row) => row[idField] === id)
    },
    async toArray() {
      return [...getRows()]
    },
    orderBy(field: keyof T) {
      return {
        toArray: async () => [...getRows()].sort((a, b) => String(a[field]).localeCompare(String(b[field]))),
        reverse: () => ({ toArray: async () => [...getRows()].sort((a, b) => String(b[field]).localeCompare(String(a[field]))) }),
      }
    },
    where(field: keyof T) {
      return {
        equals(value: unknown) {
          const matches = () => getRows().filter((row) => row[field] === value)
          return { count: async () => matches().length, toArray: async () => matches() }
        },
      }
    },
    async put(row: T) {
      putCalls += 1
      const rows = getRows()
      const index = rows.findIndex((existing) => existing[idField] === row[idField])
      if (index === -1) rows.push(row)
      else rows[index] = row
      return row[idField]
    },
    async delete(id: unknown) {
      deleteCalls += 1
      const rows = getRows()
      const index = rows.findIndex((row) => row[idField] === id)
      if (index !== -1) rows.splice(index, 1)
    },
  }
}

vi.mock('../src/database/db', () => ({
  get db() {
    return {
      wallets: makeIndexedTable(() => wallets, 'id'),
      services: makeIndexedTable(() => incomes, 'id'),
      expenses: makeIndexedTable(() => expenses, 'id'),
      internalTransfers: makeIndexedTable(() => transfers, 'id'),
      async transaction(_mode: unknown, _tables: unknown, callback: () => unknown) {
        return callback()
      },
    }
  },
}))

vi.mock('../src/services/settingsService', () => ({
  getSettings: async () => settingsRow,
}))

vi.stubGlobal('window', { dispatchEvent: () => true })

const { createWallet } = await import('../src/services/walletService')
const { createInternalTransfer } = await import('../src/services/internalTransferService')
const { answerPersonalWalletCopilotQuery } = await import('../src/services/personalWalletCopilotService')
const { createLocalFinancialCopilotQueryHandler } = await import('../src/services/financialCopilotService')

let idCounter = 0
function nextIncomeId() {
  idCounter += 1
  return idCounter
}

beforeEach(() => {
  wallets = []
  incomes = []
  expenses = []
  transfers = []
  settingsRow = { defaultCurrency: 'EUR', usageMode: 'basic' }
  idCounter = 0
})

/** Builds the exact scenario from spec §39/§52: two Wallets, one transfer. */
async function buildAcceptanceScenario() {
  const main = await createWallet({ name: 'Cuenta principal' })
  const home = await createWallet({ name: 'Dinero en casa' })
  incomes.push({ id: nextIncomeId(), walletId: main.id, currency: 'EUR', eurValue: 500 })
  expenses.push({ id: nextIncomeId(), walletId: main.id, currency: 'EUR', eurValue: 100 })
  await createInternalTransfer({ fromWalletId: main.id, toWalletId: home.id, amount: 150, date: '2026-09-01' })
  expenses.push({ id: nextIncomeId(), walletId: home.id, currency: 'EUR', eurValue: 30 })
  return { main, home }
}

describe('answerPersonalWalletCopilotQuery — criterio de aceptación (spec §52)', () => {
  it('responde saldo total, saldo por wallet y distribución con los números correctos', async () => {
    putCalls = 0
    deleteCalls = 0
    await buildAcceptanceScenario()

    const total = await answerPersonalWalletCopilotQuery('¿Cuánto dinero tengo?')
    expect(total?.intent).toBe('wallet_total')
    expect(total?.text).toContain('370,00')
    expect(total?.text).toContain('Cuenta principal: 250,00')
    expect(total?.text).toContain('Dinero en casa: 120,00')

    const home = await answerPersonalWalletCopilotQuery('¿Cuánto tengo en casa?')
    expect(home?.intent).toBe('wallet_balance')
    expect(home?.text).toContain('120,00')
    expect(home?.text).toContain('Dinero en casa')

    const distribution = await answerPersonalWalletCopilotQuery('¿Cómo está distribuido mi dinero?')
    expect(distribution?.text).toContain('Cuenta principal: 250,00')
    expect(distribution?.text).toContain('Dinero en casa: 120,00')
    expect(distribution?.text).toContain('Total: 370,00')

    // Read-only: none of the wallet questions above should have written or
    // deleted anything (spec §43) beyond the setup calls counted before.
    putCalls = 0
    deleteCalls = 0
    await answerPersonalWalletCopilotQuery('¿Cuánto dinero tengo?')
    await answerPersonalWalletCopilotQuery('¿Cuántas wallets tengo?')
    await answerPersonalWalletCopilotQuery('¿Cuál es mi wallet predeterminada?')
    expect(putCalls).toBe(0)
    expect(deleteCalls).toBe(0)
  })

  it('nunca altera ingresos, egresos o balance financiero: la transferencia solo redistribuye (spec §3/§42)', async () => {
    await buildAcceptanceScenario()
    const { buildFinancialCopilotSnapshot } = await import('../src/services/financialCopilotService')
    const snapshot = buildFinancialCopilotSnapshot({
      asOfDate: '2026-09-08',
      settings: { defaultCurrency: 'EUR', secondaryCurrency: 'COP' } as never,
      currentIncomes: [{ id: 1, date: '2026-09-01', duration: 60, totalAmount: 500, currency: 'EUR', percentage: 100, realGain: 500, eurValue: 500, copValue: 2150000, exchangeRateUsed: 4300 } as never],
      previousIncomes: [],
      currentExpenses: [
        { id: 2, type: 'gasto', date: '2026-09-01', category: 'Varios', amount: 100, currency: 'EUR', eurValue: 100, copValue: 430000, createdAt: '2026-09-01T00:00:00.000Z' } as never,
        { id: 3, type: 'gasto', date: '2026-09-01', category: 'Varios', amount: 30, currency: 'EUR', eurValue: 30, copValue: 129000, createdAt: '2026-09-01T00:00:00.000Z' } as never,
      ],
      previousExpenses: [],
      pendingIncome: { count: 0, overdueCount: 0 },
      appointments: [],
    })

    // Financial result: 500 income, 130 expenses — the 150€ transfer never appears here.
    expect(snapshot.currentMonth.income).toBe(500)
    expect(snapshot.currentMonth.expenses).toBe(130)

    // Wallet distribution: total stays 370, matching income - expenses exactly.
    const total = await answerPersonalWalletCopilotQuery('¿Cuánto dinero tengo?')
    expect(total?.text).toContain('370,00')
    expect(snapshot.currentMonth.income - snapshot.currentMonth.expenses).toBe(370)
  })

  it('responde el resumen de transferencias sin duplicar el importe movido (spec §17)', async () => {
    await buildAcceptanceScenario()
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto transferí?')
    expect(answer?.text).toContain('150,00')
    expect(answer?.text).not.toContain('300,00')
  })
})

describe('answerPersonalWalletCopilotQuery — wallet inexistente y ambigüedad (spec §12/§38)', () => {
  it('nunca devuelve saldo cero para una wallet que no existe', async () => {
    await createWallet({ name: 'Cuenta principal' })
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto tengo en Caja fuerte?')
    expect(answer?.intent).toBe('wallet_not_found')
    expect(answer?.text).toContain('Caja fuerte')
    expect(answer?.text).not.toContain('0,00')
  })

  it('pide desambiguación en vez de sumar o elegir arbitrariamente entre coincidencias parciales', async () => {
    await createWallet({ name: 'Banco Santander' })
    await createWallet({ name: 'Banco BBVA' })
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto tengo en banco?')
    expect(answer?.intent).toBe('wallet_ambiguous')
    expect(answer?.text).toContain('Banco Santander')
    expect(answer?.text).toContain('Banco BBVA')
  })

  it('una wallet nombrada exactamente como la consulta gana frente a coincidencias parciales', async () => {
    await createWallet({ name: 'Banco' })
    await createWallet({ name: 'Banco BBVA' })
    incomes.push({ id: nextIncomeId(), walletId: wallets[0].id, currency: 'EUR', eurValue: 75 })
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto tengo en banco?')
    expect(answer?.intent).toBe('wallet_balance')
    expect(answer?.text).toContain('75,00')
  })

  it('ignora mayúsculas, tildes y espacios repetidos al buscar por nombre', async () => {
    await createWallet({ name: 'Dinero en casa' })
    incomes.push({ id: nextIncomeId(), walletId: wallets[0].id, currency: 'EUR', eurValue: 42 })
    const answer = await answerPersonalWalletCopilotQuery('cuanto   TENGO en   Casa')
    expect(answer?.text).toContain('42,00')
  })

  it('indica cuando la wallet consultada está archivada', async () => {
    const wallet = await createWallet({ name: 'Vieja cuenta' })
    incomes.push({ id: nextIncomeId(), walletId: wallet.id, currency: 'EUR', eurValue: 20 })
    const { archiveWallet } = await import('../src/services/walletService')
    await archiveWallet(wallet.id)
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto tengo en Vieja cuenta?')
    expect(answer?.text).toContain('archivada')
  })
})

describe('answerPersonalWalletCopilotQuery — saldos negativos (spec §23)', () => {
  it('conserva y muestra un saldo negativo sin ocultarlo ni convertirlo en cero', async () => {
    const wallet = await createWallet({ name: 'Obligaciones' })
    expenses.push({ id: nextIncomeId(), walletId: wallet.id, currency: 'EUR', eurValue: 30 })
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto tengo en Obligaciones?')
    expect(answer?.text).toMatch(/-30,00|−30,00/)
  })
})

describe('answerPersonalWalletCopilotQuery — mayor/menor saldo, conteo y predeterminada', () => {
  it('identifica la wallet con mayor y menor saldo entre wallets activas', async () => {
    const a = await createWallet({ name: 'Ahorros' })
    const b = await createWallet({ name: 'Gastos' })
    incomes.push({ id: nextIncomeId(), walletId: a.id, currency: 'EUR', eurValue: 500 })
    incomes.push({ id: nextIncomeId(), walletId: b.id, currency: 'EUR', eurValue: 50 })

    const largest = await answerPersonalWalletCopilotQuery('¿Dónde tengo más dinero?')
    expect(largest?.text).toContain('Ahorros')
    const smallest = await answerPersonalWalletCopilotQuery('¿Dónde tengo menos dinero?')
    expect(smallest?.text).toContain('Gastos')
  })

  it('cuenta wallets activas y archivadas sin ocultar ninguna en el total', async () => {
    const one = await createWallet({ name: 'Uno' })
    await createWallet({ name: 'Dos' })
    const { archiveWallet } = await import('../src/services/walletService')
    await archiveWallet(one.id)

    const total = await answerPersonalWalletCopilotQuery('¿Cuántas wallets tengo?')
    expect(total?.text).toContain('1')
    expect(total?.text).toMatch(/activa/)
    expect(total?.text).toMatch(/archivada/)

    const active = await answerPersonalWalletCopilotQuery('¿Cuántas wallets activas tengo?')
    expect(active?.text).toContain('1 Wallet activa')
  })

  it('reporta la wallet predeterminada con su explicación', async () => {
    await createWallet({ name: 'Cuenta principal' })
    const answer = await answerPersonalWalletCopilotQuery('¿Cuál es mi wallet predeterminada?')
    expect(answer?.text).toContain('Cuenta principal')
    expect(answer?.explanation).toContain('sin seleccionar otra Wallet')
  })
})

describe('answerPersonalWalletCopilotQuery — contexto Personal/Profesional/Híbrido (spec §24/§25/§26)', () => {
  it('responde con normalidad en modo Personal', async () => {
    await createWallet({ name: 'Cuenta principal' })
    settingsRow = { defaultCurrency: 'EUR', usageMode: 'basic' }
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto dinero tengo?')
    expect(answer?.intent).toBe('wallet_total')
  })

  it('bloquea la consulta en modo Profesional sin exponer ningún dato de Wallets', async () => {
    await createWallet({ name: 'Cuenta principal' })
    settingsRow = { defaultCurrency: 'EUR', usageMode: 'professional' }
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto dinero tengo?')
    expect(answer?.text).toContain('espacio Personal')
    expect(answer?.text).not.toContain('Cuenta principal')
  })

  it('en Híbrido responde si el contexto activo es Personal', async () => {
    await createWallet({ name: 'Cuenta principal' })
    settingsRow = { defaultCurrency: 'EUR', usageMode: 'hybrid', activeContext: 'basic' }
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto dinero tengo?')
    expect(answer?.intent).toBe('wallet_total')
  })

  it('en Híbrido bloquea si el contexto activo es Profesional', async () => {
    await createWallet({ name: 'Cuenta principal' })
    settingsRow = { defaultCurrency: 'EUR', usageMode: 'hybrid', activeContext: 'professional' }
    const answer = await answerPersonalWalletCopilotQuery('¿Cuánto dinero tengo?')
    expect(answer?.text).toContain('espacio Personal')
  })
})

describe('wiring — createLocalFinancialCopilotQueryHandler prioriza Wallets sin romper el motor financiero (spec §29/§36)', () => {
  it('resuelve "¿cuánto dinero tengo?" como distribución de Wallets, nunca como balance del mes', async () => {
    await buildAcceptanceScenario()
    const handler = createLocalFinancialCopilotQueryHandler()
    const answer = await handler.answer('¿Cuánto dinero tengo?')
    expect(answer?.intent).toBe('wallet_total')
  })

  it('mantiene "¿cuánto gasté este mes?" resolviendo por el motor financiero existente, sin tocar Wallets', async () => {
    await buildAcceptanceScenario()
    const loadSnapshot = async () => ({
      asOfDate: '2026-09-08', calculatedAt: '2026-09-08T10:00:00.000Z', source: 'local-financial-domain' as const,
      period: { current: { start: '2026-09-01', end: '2026-09-30', label: 'septiembre de 2026' }, previous: { start: '2026-08-01', end: '2026-08-31', label: 'agosto de 2026' } },
      limitations: [], currency: 'EUR' as const,
      currentMonth: { income: 500, expenses: 130, incomeCount: 1, expenseCount: 2 },
      previousMonth: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      currentWeek: { income: 500, expenses: 130, incomeCount: 1, expenseCount: 2 },
      previousWeek: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      movementDates: { currentIncome: ['2026-09-01'], currentExpenses: ['2026-09-01'], previousIncome: [], previousExpenses: [] },
      goalProgress: [], expenseCategories: [],
      pendingIncome: { count: 0, overdueCount: 0 }, appointments: { todayPendingCount: 0, nextPendingDateTime: null, lastDateTime: null }, yesterdayIncome: { amount: 0, count: 0 },
    })
    const handler = createLocalFinancialCopilotQueryHandler({ loadSnapshot })
    const answer = await handler.answer('¿Cuánto gasté este mes?')
    expect(answer).toEqual(expect.objectContaining({ intent: 'monthly-expenses', text: expect.stringContaining('130,00') }))
  })
})

describe('answerPersonalWalletCopilotQuery — consultas no reconocidas y comandos de escritura (spec §30)', () => {
  it('no responde a un comando de transferencia imperativo', async () => {
    await createWallet({ name: 'Cuenta principal' })
    const answer = await answerPersonalWalletCopilotQuery('Transfiere 100 euros a Casa')
    expect(answer).toBeNull()
  })

  it('devuelve null para preguntas que no son de Wallets', async () => {
    const answer = await answerPersonalWalletCopilotQuery('¿Qué tiempo hace hoy?')
    expect(answer).toBeNull()
  })
})

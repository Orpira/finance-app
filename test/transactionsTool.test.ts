import { describe, expect, it, vi } from 'vitest'

import { createTransactionsToolUseCase } from '../src/intelligence/ai-tools/financial/transactionsTool'
import type { ServiceIncomeListOptions } from '../src/services/incomeService'
import type { ExpenseListOptions } from '../src/services/expenseService'
import type { ServiceIncome } from '../src/types/service'
import type { Expense } from '../src/types/expense'
import type { AppSettings } from '../src/types/settings'
import type { FinancialTransactionInput } from '../src/intelligence/ai-tools/financial/transactionsContracts'

function income(overrides: Partial<ServiceIncome> & { id: number; date: string; eurValue: number }): ServiceIncome {
  return {
    duration: 60,
    totalAmount: overrides.eurValue,
    currency: 'EUR',
    percentage: 100,
    realGain: overrides.eurValue,
    copValue: 0,
    exchangeRateUsed: 1,
    usageMode: 'professional',
    type: 'ingreso',
    ...overrides,
  }
}

function settings(): AppSettings {
  return {
    id: 'app',
    businessName: '',
    country: 'ES',
    city: '',
    defaultCurrency: 'EUR',
    secondaryCurrency: 'COP',
    incomePercentage: 50,
    rateMode: 'manual',
    usageMode: 'professional',
    userType: 'primary',
    theme: 'system',
    pinEnabled: false,
    backupEncryptionKey: '',
    driveBackupEnabled: false,
    driveBackupFrequency: 'daily',
    cutoffFrequency: 'weekly',
    cutoffWeekStart: 1,
    cutoffAnchorDate: '2026-07-25',
    googleDriveClientId: '',
    googleDriveConnected: false,
    closedLocationSeasons: [],
    reopenedLocationSeasons: [],
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-25T00:00:00.000Z',
  } as unknown as AppSettings
}

function baseRequest(overrides: Partial<FinancialTransactionInput> = {}): FinancialTransactionInput {
  return {
    requestId: 'req-1',
    requestedAt: '2026-07-25T00:00:00.000Z',
    ...overrides,
  }
}

function createUseCase(input: {
  readonly incomes: readonly ServiceIncome[]
  readonly expenses?: readonly Expense[]
  readonly listServiceIncomes?: (options: ServiceIncomeListOptions) => Promise<readonly ServiceIncome[]>
}) {
  const listServiceIncomes = input.listServiceIncomes
    ?? vi.fn(async (options: ServiceIncomeListOptions) => {
      const sorted = [...input.incomes].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
      return options.newestFirst === false ? sorted : [...sorted].reverse()
    })

  const listExpenses = vi.fn(async (options: ExpenseListOptions) => {
    const items = input.expenses ?? []
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
    return options.newestFirst === false ? sorted : [...sorted].reverse()
  })

  return {
    useCase: createTransactionsToolUseCase({
      getSettings: async () => settings(),
      listServiceIncomes: listServiceIncomes as unknown as typeof import('../src/services/incomeService').listServiceIncomes,
      listExpenses: listExpenses as unknown as typeof import('../src/services/expenseService').listExpenses,
    }),
    listServiceIncomes,
    listExpenses,
  }
}

describe('financial_transactions tool — orden y seleccion (PB-IS-015.5-R2)', () => {
  it('orden descendente por defecto cuando las fechas son distintas', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 1, date: '2026-07-01', eurValue: 100 }),
        income({ id: 2, date: '2026-07-10', eurValue: 200 }),
        income({ id: 3, date: '2026-07-20', eurValue: 300 }),
      ],
    })

    const result = await useCase.execute(baseRequest({ filters: { kinds: ['income'] } }))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.output.items.map((item) => item.date)).toEqual([
        '2026-07-20', '2026-07-10', '2026-07-01',
      ])
    }
  })

  it('reutiliza el mismo newestFirst que usa /income para la fecha por defecto (desc)', async () => {
    const { useCase, listServiceIncomes } = createUseCase({
      incomes: [income({ id: 1, date: '2026-07-01', eurValue: 100 })],
    })

    await useCase.execute(baseRequest({ filters: { kinds: ['income'] } }))

    expect(listServiceIncomes).toHaveBeenCalledWith(
      expect.objectContaining({ newestFirst: true }),
    )
  })

  it('registros con la misma fecha: el orden coincide con el que produce /income (newestFirst por id descendente)', async () => {
    // Replica exactamente la semantica de Dexie `orderBy('date').reverse()`:
    // para claves de indice iguales, el cursor en reversa devuelve orden
    // descendente de clave primaria (id). listServiceIncomes({newestFirst:true})
    // es la fuente certificada que usa /income.
    const sameDateIncomes = [
      income({ id: 1, date: '2026-07-10', eurValue: 100 }), // Ingreso A (mas antiguo)
      income({ id: 2, date: '2026-07-10', eurValue: 200 }), // Ingreso B
      income({ id: 3, date: '2026-07-10', eurValue: 300 }), // Ingreso C (mas reciente)
    ]

    const { useCase } = createUseCase({ incomes: sameDateIncomes })

    const result = await useCase.execute(
      baseRequest({ filters: { kinds: ['income'] }, limit: 2 }),
    )

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      // Igual que /income mostraria: C, B, A -> con limit 2: C, B
      expect(result.output.items.map((item) => item.amount)).toEqual([300, 200])
    }
  })

  it('limit 2 selecciona exactamente los dos primeros tras el orden correcto', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 1, date: '2026-07-01', eurValue: 100 }),
        income({ id: 2, date: '2026-07-10', eurValue: 200 }),
        income({ id: 3, date: '2026-07-20', eurValue: 300 }),
      ],
    })

    const result = await useCase.execute(
      baseRequest({ filters: { kinds: ['income'] }, limit: 2 }),
    )

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.output.items).toHaveLength(2)
      expect(result.output.items.map((item) => item.amount)).toEqual([300, 200])
    }
  })

  it('la comparacion "ultimos dos ingresos" nunca devuelve el mismo registro dos veces con importes iguales por error de seleccion', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 1, date: '2026-07-10', eurValue: 500 }),
        income({ id: 2, date: '2026-07-15', eurValue: 800 }),
      ],
    })

    const result = await useCase.execute(
      baseRequest({ filters: { kinds: ['income'] }, sort: { field: 'date', direction: 'desc' }, limit: 2 }),
    )

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      const [first, second] = result.output.items
      expect(first?.transactionId).not.toBe(second?.transactionId)
      expect([first?.amount, second?.amount]).toEqual([800, 500])
    }
  })

  it('registros con distinto id en la misma fecha respetan el desempate por id (no por orden de llegada del arreglo)', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 5, date: '2026-07-10', eurValue: 111 }),
        income({ id: 9, date: '2026-07-10', eurValue: 222 }),
        income({ id: 7, date: '2026-07-10', eurValue: 333 }),
      ],
      listServiceIncomes: async () => [
        income({ id: 5, date: '2026-07-10', eurValue: 111 }),
        income({ id: 9, date: '2026-07-10', eurValue: 222 }),
        income({ id: 7, date: '2026-07-10', eurValue: 333 }),
      ],
    })

    const result = await useCase.execute(baseRequest({ filters: { kinds: ['income'] } }))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      // id 9 es el mayor -> debe quedar primero cuando hay empate de fecha en orden desc
      expect(result.output.items.map((item) => item.amount)).toEqual([222, 333, 111])
    }
  })

  it('registros con fechas distintas nunca se reordenan por id (la fecha domina sobre el desempate)', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 99, date: '2026-07-01', eurValue: 100 }),
        income({ id: 1, date: '2026-07-20', eurValue: 200 }),
      ],
    })

    const result = await useCase.execute(baseRequest({ filters: { kinds: ['income'] } }))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.output.items.map((item) => item.amount)).toEqual([200, 100])
    }
  })

  it('monedas distintas no afectan el orden ni la seleccion', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 1, date: '2026-07-01', eurValue: 100, currency: 'GBP' }),
        income({ id: 2, date: '2026-07-20', eurValue: 400, currency: 'USD' }),
      ],
    })

    const result = await useCase.execute(baseRequest({ filters: { kinds: ['income'], currencyCode: 'EUR' } }))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.output.items.map((item) => item.currencyCode)).toEqual(['EUR', 'EUR'])
      expect(result.output.items.map((item) => item.amount)).toEqual([400, 100])
    }
  })

  it('importes iguales en fechas distintas se distinguen correctamente por fecha', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 1, date: '2026-07-01', eurValue: 500 }),
        income({ id: 2, date: '2026-07-20', eurValue: 500 }),
      ],
    })

    const result = await useCase.execute(baseRequest({ filters: { kinds: ['income'] } }))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.output.items.map((item) => item.date)).toEqual(['2026-07-20', '2026-07-01'])
      expect(result.output.items).toHaveLength(2)
    }
  })

  it('importes distintos se preservan sin alteracion en el orden esperado', async () => {
    const { useCase } = createUseCase({
      incomes: [
        income({ id: 1, date: '2026-07-01', eurValue: 123.45 }),
        income({ id: 2, date: '2026-07-20', eurValue: 987.65 }),
      ],
    })

    const result = await useCase.execute(baseRequest({ filters: { kinds: ['income'] } }))
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.output.items.map((item) => item.amount)).toEqual([987.65, 123.45])
    }
  })
})

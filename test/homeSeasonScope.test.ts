import { beforeEach, describe, expect, it, vi } from 'vitest'

// P0 — "Inicio" reiniciaba los acumulados del Resumen financiero al cambiar
// de mes calendario, aunque la temporada profesional siguiera activa
// (season.status === 'active'). Causa raíz: HomePage.tsx alimentaba las
// tarjetas Ganancia/Ingresos/Egresos/Adicionales con registros filtrados
// por MES CALENDARIO Y temporada activa a la vez (doble filtro), en vez de usar
// únicamente la temporada activa como scope — la misma fuente que ya usa
// "Meta de temporada" (getSeasonStatistics/listSeasonRecords), lo que
// producía la inconsistencia reportada (Resumen: 0 GBP vs Meta: -47 GBP
// para la misma temporada).
//
// Estos tests ejercitan directamente listSeasonRecords/getSeasonStatistics
// de src/services/earningPeriodService.ts — la fuente canónica que
// HomePage.tsx ahora reutiliza sin duplicar lógica (ver
// test/homeSeasonScopeWiring.test.ts para la prueba de que HomePage
// efectivamente la usa). Probar la fuente canónica es probar el
// comportamiento nuevo de Inicio, porque HomePage no reimplementa ningún
// filtro propio.

interface Row {
  id?: number
  earningPeriodId?: number
  seasonPeriodId?: number
  usageMode?: 'professional' | 'basic'
  date?: string
  status?: string
  [key: string]: unknown
}

function createTable(seed: Row[] = []) {
  const rows = new Map<number, Row>()
  let nextId = 1
  seed.forEach((row) => {
    const id = row.id ?? nextId++
    rows.set(id, { ...row, id })
  })

  return {
    async add(row: Row) {
      const id = row.id ?? nextId++
      rows.set(id, { ...row, id })
      return id
    },
    async get(id: number) {
      return rows.get(id)
    },
    async update(id: number, changes: Partial<Row>) {
      const existing = rows.get(id)
      if (!existing) return 0
      rows.set(id, { ...existing, ...changes })
      return 1
    },
    async put(row: Row) {
      rows.set(row.id as number, row)
      return row.id
    },
    async toArray() {
      return Array.from(rows.values())
    },
    orderBy(field: string) {
      const sorted = () =>
        Array.from(rows.values()).sort((a, b) =>
          (a[field] as string) < (b[field] as string) ? -1 : (a[field] as string) > (b[field] as string) ? 1 : 0,
        )
      return {
        async toArray() {
          return sorted()
        },
        reverse() {
          return {
            async toArray() {
              return sorted().reverse()
            },
          }
        },
      }
    },
    where(field: string) {
      return {
        equals(value: unknown) {
          const matchesFirst = (row: Row) => row[field] === value
          return {
            or(field2: string) {
              return {
                equals(value2: unknown) {
                  return {
                    async toArray() {
                      return Array.from(rows.values()).filter(
                        (row) => matchesFirst(row) || row[field2] === value2,
                      )
                    },
                  }
                },
              }
            },
            async toArray() {
              return Array.from(rows.values()).filter(matchesFirst)
            },
          }
        },
      }
    },
  }
}

let earningPeriodsTable: ReturnType<typeof createTable>
let servicesTable: ReturnType<typeof createTable>
let expensesTable: ReturnType<typeof createTable>
let appointmentsTable: ReturnType<typeof createTable>
let settingsTable: ReturnType<typeof createTable>

vi.mock('../src/database/db', () => ({
  DEFAULT_SETTINGS_ID: 'app',
  createDefaultSettings: () => ({
    id: 'app',
    defaultCurrency: 'GBP',
    secondaryCurrency: 'EUR',
    incomePercentage: 100,
    city: '',
    country: 'ES',
  }),
  get db() {
    return {
      earningPeriods: earningPeriodsTable,
      services: servicesTable,
      expenses: expensesTable,
      appointments: appointmentsTable,
      settings: settingsTable,
      // Dexie acepta db.transaction(mode, table1, table2, ..., callback):
      // el callback siempre es el último argumento, sin importar cuántas
      // tablas se listen antes.
      transaction: async (...args: unknown[]) => (args[args.length - 1] as () => unknown)(),
    }
  },
}))

const {
  createEarningPeriod,
  closeActiveEarningPeriod,
  getActiveEarningPeriod,
  getPreviousEarningPeriod,
  listSeasonRecords,
  getSeasonStatistics,
} = await import('../src/services/earningPeriodService')

function income(overrides: Row = {}): Row {
  return {
    date: '2026-08-25',
    duration: 60,
    totalAmount: 100,
    currency: 'GBP',
    percentage: 100,
    realGain: 100,
    eurValue: 100,
    copValue: 0,
    exchangeRateUsed: 1,
    type: 'ingreso',
    usageMode: 'professional',
    ...overrides,
  }
}

function expense(overrides: Row = {}): Row {
  return {
    type: 'gasto',
    date: '2026-08-31',
    category: 'Otros',
    amount: 20,
    currency: 'GBP',
    usageMode: 'professional',
    ...overrides,
  }
}

beforeEach(() => {
  earningPeriodsTable = createTable()
  servicesTable = createTable()
  expensesTable = createTable()
  appointmentsTable = createTable()
  settingsTable = createTable()
})

describe('listSeasonRecords / getSeasonStatistics — TDD HOME-SEASON', () => {
  it('HOME-SEASON-001: temporada activa 20/08→30/09 acumula agosto + septiembre, sin reset de mes', async () => {
    const period = await createEarningPeriod({
      name: 'Temporada', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-20', plannedEndDate: '2026-09-30',
    })
    await servicesTable.add(income({ date: '2026-08-25', totalAmount: 100, realGain: 100, earningPeriodId: period.id, seasonPeriodId: period.id }))
    await expensesTable.add(expense({ date: '2026-08-31', amount: 20, earningPeriodId: period.id, seasonPeriodId: period.id }))
    await servicesTable.add(income({ date: '2026-09-01', totalAmount: 50, realGain: 50, earningPeriodId: period.id, seasonPeriodId: period.id }))

    const records = await listSeasonRecords(period.id as number)
    expect(records.incomes).toHaveLength(2)
    expect(records.incomes.reduce((sum, i) => sum + (i.totalAmount as number), 0)).toBe(150)
    expect(records.expenses).toHaveLength(1)
    expect(records.expenses.reduce((sum, e) => sum + (e.amount as number), 0)).toBe(20)
  })

  it('HOME-SEASON-002: temporada julio→octubre acumula los 4 meses mientras esté activa', async () => {
    const period = await createEarningPeriod({
      name: 'Larga', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-07-15', plannedEndDate: '2026-10-15',
    })
    const months = ['2026-07-20', '2026-08-20', '2026-09-20', '2026-10-01']
    for (const date of months) {
      await servicesTable.add(income({ date, totalAmount: 10, realGain: 10, earningPeriodId: period.id, seasonPeriodId: period.id }))
    }

    const records = await listSeasonRecords(period.id as number)
    expect(records.incomes).toHaveLength(4)
  })

  it('HOME-SEASON-003: fecha prevista de finalización alcanzada no cierra ni excluye movimientos (status sigue siendo la fuente de verdad)', async () => {
    const period = await createEarningPeriod({
      name: 'Corta', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01', plannedEndDate: '2026-08-31',
    })
    // "Hoy" simulado es 01/09, un día después de plannedEndDate — la
    // temporada sigue status: 'active' porque nadie la cerró manualmente.
    await servicesTable.add(income({ date: '2026-09-01', totalAmount: 40, realGain: 40, earningPeriodId: period.id, seasonPeriodId: period.id }))

    const active = await getActiveEarningPeriod()
    expect(active?.status).toBe('active')
    const records = await listSeasonRecords(period.id as number)
    expect(records.incomes).toHaveLength(1)
  })

  it('HOME-SEASON-004: cierre manual — los datos permanecen intactos pero la temporada deja de estar activa', async () => {
    const period = await createEarningPeriod({
      name: 'A cerrar', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01',
    })
    await servicesTable.add(income({ date: '2026-08-10', totalAmount: 100, realGain: 100, earningPeriodId: period.id, seasonPeriodId: period.id }))

    await closeActiveEarningPeriod('2026-08-31')

    expect(await getActiveEarningPeriod()).toBeUndefined()
    const records = await listSeasonRecords(period.id as number)
    expect(records.incomes).toHaveLength(1) // el histórico no se borra ni modifica
    expect(records.incomes[0].totalAmount).toBe(100)
  })

  it('HOME-SEASON-005: nueva temporada tras cerrar la anterior no incluye movimientos de la temporada A', async () => {
    const periodA = await createEarningPeriod({
      name: 'A', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01',
    })
    await servicesTable.add(income({ date: '2026-08-10', totalAmount: 999, realGain: 999, earningPeriodId: periodA.id, seasonPeriodId: periodA.id }))
    await closeActiveEarningPeriod('2026-08-31')

    const periodB = await createEarningPeriod({
      name: 'B', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-09-01',
    })
    await servicesTable.add(income({ date: '2026-09-05', totalAmount: 50, realGain: 50, earningPeriodId: periodB.id, seasonPeriodId: periodB.id }))

    const recordsB = await listSeasonRecords(periodB.id as number)
    expect(recordsB.incomes).toHaveLength(1)
    expect(recordsB.incomes[0].totalAmount).toBe(50)
  })

  it('HOME-SEASON-006: egresos intermensuales (31 ago -17, 01 sept -30) suman 47, no 30', async () => {
    const period = await createEarningPeriod({
      name: 'T', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01',
    })
    await expensesTable.add(expense({ date: '2026-08-31', amount: 17, earningPeriodId: period.id, seasonPeriodId: period.id }))
    await expensesTable.add(expense({ date: '2026-09-01', amount: 30, earningPeriodId: period.id, seasonPeriodId: period.id }))

    const records = await listSeasonRecords(period.id as number)
    const total = records.expenses.reduce((sum, e) => sum + (e.amount as number), 0)
    expect(total).toBe(47)
  })

  it('HOME-SEASON-007: adicional de agosto sigue contando en septiembre mientras la temporada esté activa', async () => {
    const period = await createEarningPeriod({
      name: 'T', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01',
    })
    await servicesTable.add(income({
      date: '2026-08-15', totalAmount: 100, realGain: 100, additionalsTotal: 10,
      earningPeriodId: period.id, seasonPeriodId: period.id,
    }))

    const records = await listSeasonRecords(period.id as number)
    expect(records.incomes[0].additionalsTotal).toBe(10)
  })

  it('HOME-SEASON-008: getSeasonStatistics (Meta de temporada) usa exactamente el mismo listado que listSeasonRecords (consistencia estructural)', async () => {
    const period = await createEarningPeriod({
      name: 'T', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01',
    })
    await expensesTable.add(expense({ date: '2026-08-31', amount: 12, earningPeriodId: period.id, seasonPeriodId: period.id }))
    await expensesTable.add(expense({ date: '2026-08-31', amount: 5, earningPeriodId: period.id, seasonPeriodId: period.id }))
    await expensesTable.add(expense({ date: '2026-09-01', amount: 30, earningPeriodId: period.id, seasonPeriodId: period.id }))

    const records = await listSeasonRecords(period.id as number)
    const stats = await getSeasonStatistics(period.id as number)

    const recordsExpenseTotal = records.expenses.reduce((sum, e) => sum + (e.amount as number), 0)
    expect(recordsExpenseTotal).toBe(47)
    expect(stats.expenses).toBe(47)
  })

  it('HOME-SEASON-009: movimientos de otra temporada (cerrada) no se cuentan en la temporada activa', async () => {
    const closedPeriod = await createEarningPeriod({
      name: 'Cerrada', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-01-01',
    })
    await servicesTable.add(income({ date: '2026-01-15', totalAmount: 500, realGain: 500, earningPeriodId: closedPeriod.id, seasonPeriodId: closedPeriod.id }))
    await closeActiveEarningPeriod('2026-06-30')

    const activePeriod = await createEarningPeriod({
      name: 'Activa', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01',
    })
    await servicesTable.add(income({ date: '2026-08-10', totalAmount: 40, realGain: 40, earningPeriodId: activePeriod.id, seasonPeriodId: activePeriod.id }))

    const records = await listSeasonRecords(activePeriod.id as number)
    expect(records.incomes).toHaveLength(1)
    expect(records.incomes[0].totalAmount).toBe(40)
  })

  it('getPreviousEarningPeriod: la comparativa de Inicio debe usar la temporada anterior, no el mes anterior', async () => {
    const periodA = await createEarningPeriod({
      name: 'A', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-06-01',
    })
    await servicesTable.add(income({ date: '2026-06-10', totalAmount: 200, realGain: 200, earningPeriodId: periodA.id, seasonPeriodId: periodA.id }))
    await closeActiveEarningPeriod('2026-07-31')

    const periodB = await createEarningPeriod({
      name: 'B', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-20',
    })

    const previous = await getPreviousEarningPeriod(periodB)
    expect(previous?.id).toBe(periodA.id)

    const previousRecords = await listSeasonRecords(previous!.id as number)
    expect(previousRecords.incomes.reduce((sum, i) => sum + (i.totalAmount as number), 0)).toBe(200)
  })

  it('getPreviousEarningPeriod: sin temporada previa devuelve undefined (primera temporada de la cuenta)', async () => {
    const onlyPeriod = await createEarningPeriod({
      name: 'Única', city: 'Londres', country: 'GB', countryCode: 'GB',
      baseCurrency: 'GBP', earningPercentage: 100, startDate: '2026-08-01',
    })

    const previous = await getPreviousEarningPeriod(onlyPeriod)
    expect(previous).toBeUndefined()
  })
})

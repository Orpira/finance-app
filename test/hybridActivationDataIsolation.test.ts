import { beforeEach, describe, expect, it, vi } from 'vitest'

// Bloque 2, Etapa 4 — prueba de aislamiento real (sin navegador disponible en
// este entorno, se ejercita a nivel de datos, que es donde vive la garantía:
// Home/Movimientos/Temporadas/Copiloto/Insights son capas finas sobre
// exactamente este filtrado — ver test/usageModeHybrid.test.ts para la
// prueba unitaria de recordBelongsToUsageMode en aislamiento).
//
// Demuestra, contra un mock de Dexie con datos "reales" precargados:
// 1) activar Híbrido no modifica ni un solo registro de ingresos/gastos.
// 2) el espacio que no coincide con el modo previo queda vacío (0 registros).
// 3) el espacio que sí coincide conserva exactamente los mismos registros y totales.

interface FinancialRow {
  id: number
  usageMode: 'basic' | 'professional'
  totalAmount?: number
  amount?: number
  [key: string]: unknown
}

interface SettingsRow {
  id: string
  usageMode: 'basic' | 'professional' | 'hybrid'
  activeContext?: 'basic' | 'professional'
  onboarding: { completed: boolean; currentStep: number; version: number }
  [key: string]: unknown
}

let settingsRow: SettingsRow | undefined
let servicesRows: FinancialRow[]
let expensesRows: FinancialRow[]
const financialGoals: Array<{ id: string; usageMode?: 'basic' | 'professional' }> = []

vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => {}, setItem: () => {} })
vi.stubGlobal('window', { dispatchEvent: () => true, matchMedia: () => ({ matches: false }) })
vi.stubGlobal('document', {
  documentElement: { classList: { toggle: () => {} }, dataset: {} as Record<string, string> },
})

vi.mock('../src/database/db', () => ({
  DEFAULT_SETTINGS_ID: 'app',
  createDefaultSettings: () => ({
    id: 'app',
    defaultCurrency: 'EUR',
    secondaryCurrency: 'USD',
    incomePercentage: 100,
    city: '',
    country: 'ES',
    theme: 'system',
    usageMode: 'professional',
    userType: 'primary',
    onboarding: { completed: true, currentStep: 6, version: 1 },
    notificationPreferences: {},
  }),
  get db() {
    return {
      settings: {
        async get(id: string) {
          return id === settingsRow?.id ? settingsRow : undefined
        },
        async put(row: SettingsRow) {
          settingsRow = row
          return row.id
        },
      },
      services: { async toArray() { return servicesRows } },
      expenses: { async toArray() { return expensesRows } },
      financialGoals: {
        async toArray() { return financialGoals },
        async bulkPut(goals: typeof financialGoals) {
          financialGoals.splice(0, financialGoals.length, ...goals)
        },
      },
      async transaction(_mode: unknown, _tables: unknown, callback: () => unknown) {
        return callback()
      },
    }
  },
}))

const { activateHybridMode } = await import('../src/services/settingsService')
const { recordBelongsToUsageMode } = await import('../src/utils/usageMode')

function sumBy(rows: FinancialRow[], field: 'totalAmount' | 'amount') {
  return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0)
}

beforeEach(() => {
  settingsRow = undefined
  servicesRows = []
  expensesRows = []
  financialGoals.length = 0
})

describe('Bloque 2 / Etapa 4 — activar Híbrido desde una instalación Personal', () => {
  beforeEach(() => {
    settingsRow = {
      id: 'app',
      usageMode: 'basic',
      userType: 'basic',
      onboarding: { completed: true, currentStep: 6, version: 1 },
    }
    servicesRows = [
      { id: 1, usageMode: 'basic', totalAmount: 100 },
      { id: 2, usageMode: 'basic', totalAmount: 250 },
    ]
    expensesRows = [
      { id: 1, usageMode: 'basic', amount: 40 },
    ]
  })

  it('no modifica ni un registro de ingresos/gastos al activar Híbrido', async () => {
    const servicesBefore = JSON.stringify(servicesRows)
    const expensesBefore = JSON.stringify(expensesRows)

    await activateHybridMode()

    expect(JSON.stringify(servicesRows)).toBe(servicesBefore)
    expect(JSON.stringify(expensesRows)).toBe(expensesBefore)
  })

  it('Personal conserva exactamente los mismos registros y totales', async () => {
    await activateHybridMode()

    const personalIncomes = servicesRows.filter((row) => recordBelongsToUsageMode(row, 'basic'))
    const personalExpenses = expensesRows.filter((row) => recordBelongsToUsageMode(row, 'basic'))

    expect(personalIncomes).toHaveLength(2)
    expect(personalExpenses).toHaveLength(1)
    expect(sumBy(personalIncomes, 'totalAmount')).toBe(350)
    expect(sumBy(personalExpenses, 'amount')).toBe(40)
  })

  it('Profesional comienza vacío: ningún ingreso ni gasto personal aparece', async () => {
    await activateHybridMode()

    const professionalIncomes = servicesRows.filter((row) =>
      recordBelongsToUsageMode(row, 'professional'),
    )
    const professionalExpenses = expensesRows.filter((row) =>
      recordBelongsToUsageMode(row, 'professional'),
    )

    expect(professionalIncomes).toHaveLength(0)
    expect(professionalExpenses).toHaveLength(0)
  })
})

describe('Bloque 2 / Etapa 4 — activar Híbrido desde una instalación Profesional', () => {
  beforeEach(() => {
    settingsRow = {
      id: 'app',
      usageMode: 'professional',
      userType: 'primary',
      onboarding: { completed: true, currentStep: 6, version: 1 },
    }
    servicesRows = [
      { id: 1, usageMode: 'professional', totalAmount: 500, earningPeriodId: 9 },
      { id: 2, usageMode: 'professional', totalAmount: 300, earningPeriodId: 9 },
      { id: 3, usageMode: 'professional', totalAmount: 200, earningPeriodId: 9 },
    ]
    expensesRows = [
      { id: 1, usageMode: 'professional', amount: 75, earningPeriodId: 9 },
    ]
  })

  it('no modifica ni un registro de ingresos/gastos al activar Híbrido', async () => {
    const servicesBefore = JSON.stringify(servicesRows)
    const expensesBefore = JSON.stringify(expensesRows)

    await activateHybridMode()

    expect(JSON.stringify(servicesRows)).toBe(servicesBefore)
    expect(JSON.stringify(expensesRows)).toBe(expensesBefore)
  })

  it('Profesional conserva exactamente los mismos registros y totales', async () => {
    await activateHybridMode()

    const professionalIncomes = servicesRows.filter((row) =>
      recordBelongsToUsageMode(row, 'professional'),
    )
    const professionalExpenses = expensesRows.filter((row) =>
      recordBelongsToUsageMode(row, 'professional'),
    )

    expect(professionalIncomes).toHaveLength(3)
    expect(professionalExpenses).toHaveLength(1)
    expect(sumBy(professionalIncomes, 'totalAmount')).toBe(1000)
    expect(sumBy(professionalExpenses, 'amount')).toBe(75)
  })

  it('Personal comienza vacío: ningún ingreso ni gasto profesional aparece', async () => {
    await activateHybridMode()

    const personalIncomes = servicesRows.filter((row) => recordBelongsToUsageMode(row, 'basic'))
    const personalExpenses = expensesRows.filter((row) => recordBelongsToUsageMode(row, 'basic'))

    expect(personalIncomes).toHaveLength(0)
    expect(personalExpenses).toHaveLength(0)
  })
})

describe('Bloque 2 / Etapa 4 — repetir el diagnóstico no modifica datos', () => {
  it('llamar activateHybridMode dos veces (ya activo) no altera registros ni activeContext', async () => {
    settingsRow = {
      id: 'app',
      usageMode: 'hybrid',
      activeContext: 'professional',
      onboarding: { completed: true, currentStep: 6, version: 1 },
    }
    servicesRows = [{ id: 1, usageMode: 'professional', totalAmount: 999 }]
    expensesRows = []

    const first = await activateHybridMode()
    const servicesAfterFirst = JSON.stringify(servicesRows)

    const second = await activateHybridMode()

    expect(first.activeContext).toBe('professional')
    expect(second.activeContext).toBe('professional')
    expect(JSON.stringify(servicesRows)).toBe(servicesAfterFirst)
  })
})

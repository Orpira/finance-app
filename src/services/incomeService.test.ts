import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ServiceIncome } from '../types/service'

const servicesTable = {
  get: vi.fn(),
  add: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  toArray: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
}

const expensesTable = {
  where: vi.fn(),
  toArray: vi.fn(),
}

const incomeAdditionalsTable = {
  where: vi.fn(),
}

const personalIncomeCategoriesTable = {
  get: vi.fn(),
}

const transactionMock = vi.fn(async (_mode: unknown, _tables: unknown, callback: () => unknown) =>
  callback(),
)

vi.mock('../database/db', () => ({
  db: {
    services: servicesTable,
    expenses: expensesTable,
    automationOutbox: {},
    earningPeriods: {},
    incomeAdditionals: incomeAdditionalsTable,
    personalIncomeCategories: personalIncomeCategoriesTable,
    transaction: (...args: unknown[]) =>
      transactionMock(...(args as [unknown, unknown, () => unknown])),
  },
}))

const getSettingsMock = vi.fn()
vi.mock('./settingsService', () => ({
  getSettings: () => getSettingsMock(),
}))

const getActiveEarningPeriodMock = vi.fn()
const getEarningPeriodByIdMock = vi.fn()
const assertRecordIsMutableMock = vi.fn()
vi.mock('./earningPeriodService', () => ({
  getActiveEarningPeriod: () => getActiveEarningPeriodMock(),
  getEarningPeriodById: (...args: unknown[]) => getEarningPeriodByIdMock(...args),
  assertRecordIsMutable: (...args: unknown[]) => assertRecordIsMutableMock(...args),
}))

vi.mock('./automationOutboxService', () => ({
  createAutomationOutboxRecord: vi.fn((event: string, payload: unknown) => ({ event, payload })),
  enqueueAutomationEvent: vi.fn(),
  scheduleAutomationOutboxFlush: vi.fn(),
}))

vi.mock('./serviceTimerService', () => ({
  buildInitialServiceTimerState: vi.fn(() => ({})),
}))

const {
  createServiceIncome,
  updateServiceIncome,
  deleteServiceIncome,
} = await import('./incomeService')

function basicSettings() {
  return { usageMode: 'basic' as const }
}

function professionalSettings() {
  return { usageMode: 'professional' as const }
}

function baseIncomeInput(overrides: Partial<ServiceIncome> = {}) {
  return {
    date: '2026-01-01',
    duration: 0,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 0,
    realGain: 100,
    eurValue: 100,
    copValue: 0,
    exchangeRateUsed: 1,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  servicesTable.add.mockResolvedValue(1)
  transactionMock.mockImplementation(async (_mode, _tables, callback: () => unknown) => callback())
})

describe('createServiceIncome', () => {
  it('normaliza y persiste el nombre de un ingreso Personal', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    await createServiceIncome(baseIncomeInput({ personalName: '  Nómina   septiembre  ' }))
    expect(servicesTable.add).toHaveBeenCalledWith(
      expect.objectContaining({ personalName: 'Nómina septiembre', usageMode: 'basic' }),
    )
  })

  it('no persiste nombres vacíos ni nombres enviados en Profesional', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    await createServiceIncome(baseIncomeInput({ personalName: '   ' }))
    expect(servicesTable.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ personalName: undefined }),
    )

    getSettingsMock.mockResolvedValue(professionalSettings())
    getActiveEarningPeriodMock.mockResolvedValue({ id: 7, startDate: '2026-01-01', percentage: 50 })
    await createServiceIncome(baseIncomeInput({ personalName: 'No permitido' }))
    expect(servicesTable.add).toHaveBeenLastCalledWith(
      expect.objectContaining({ personalName: undefined, usageMode: 'professional' }),
    )
  })

  describe('categoría de ingreso personal', () => {
    const personalCategory = { id: 'pic-1', name: 'Nómina', normalizedName: 'nomina', usageMode: 'basic', isArchived: false }

    it('permite una categoría personal válida y activa en básico, y persiste personalCategoryId', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      personalIncomeCategoriesTable.get.mockResolvedValue(personalCategory)

      await createServiceIncome(baseIncomeInput({ personalCategoryId: 'pic-1' }))

      expect(servicesTable.add).toHaveBeenCalledWith(
        expect.objectContaining({ personalCategoryId: 'pic-1', usageMode: 'basic' }),
      )
    })

    it('rechaza una categoría inexistente', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      personalIncomeCategoriesTable.get.mockResolvedValue(undefined)

      await expect(
        createServiceIncome(baseIncomeInput({ personalCategoryId: 'no-existe' })),
      ).rejects.toThrow('La categoría de ingreso personal no es válida.')
    })

    it('rechaza una categoría archivada', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      personalIncomeCategoriesTable.get.mockResolvedValue({ ...personalCategory, isArchived: true })

      await expect(
        createServiceIncome(baseIncomeInput({ personalCategoryId: 'pic-1' })),
      ).rejects.toThrow('La categoría de ingreso personal no es válida.')
    })

    it('rechaza una categoría con usageMode distinto de "basic"', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      personalIncomeCategoriesTable.get.mockResolvedValue({ ...personalCategory, usageMode: 'professional' })

      await expect(
        createServiceIncome(baseIncomeInput({ personalCategoryId: 'pic-1' })),
      ).rejects.toThrow('La categoría de ingreso personal no es válida.')
    })

    it('rechaza personalCategoryId en profesional y no persiste el valor', async () => {
      getSettingsMock.mockResolvedValue(professionalSettings())
      getActiveEarningPeriodMock.mockResolvedValue({ id: 7, startDate: '2026-01-01', percentage: 50 })

      await expect(
        createServiceIncome(baseIncomeInput({ personalCategoryId: 'pic-1' })),
      ).rejects.toThrow('PERSONAL_INCOME_CATEGORY_NOT_ALLOWED_FOR_PROFESSIONAL')
    })

    it('no consulta categorías personales en profesional cuando no se envía personalCategoryId', async () => {
      getSettingsMock.mockResolvedValue(professionalSettings())
      getActiveEarningPeriodMock.mockResolvedValue({ id: 7, startDate: '2026-01-01', percentage: 50 })

      await createServiceIncome(baseIncomeInput())

      expect(personalIncomeCategoriesTable.get).not.toHaveBeenCalled()
    })

    it('en híbrido, permite la categoría personal con contexto activo Personal', async () => {
      getSettingsMock.mockResolvedValue({ usageMode: 'hybrid', activeContext: 'basic' })
      personalIncomeCategoriesTable.get.mockResolvedValue(personalCategory)

      await createServiceIncome(baseIncomeInput({ personalCategoryId: 'pic-1' }))

      expect(servicesTable.add).toHaveBeenCalledWith(
        expect.objectContaining({ personalCategoryId: 'pic-1', usageMode: 'basic' }),
      )
    })

    it('en híbrido, no permite la categoría personal con contexto activo Profesional', async () => {
      getSettingsMock.mockResolvedValue({ usageMode: 'hybrid', activeContext: 'professional' })
      getActiveEarningPeriodMock.mockResolvedValue({ id: 7, startDate: '2026-01-01', percentage: 50 })

      await expect(
        createServiceIncome(baseIncomeInput({ personalCategoryId: 'pic-1' })),
      ).rejects.toThrow('PERSONAL_INCOME_CATEGORY_NOT_ALLOWED_FOR_PROFESSIONAL')
    })

    it('normaliza "" a ausencia y no consulta la categoría', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())

      await createServiceIncome(baseIncomeInput({ personalCategoryId: '' }))

      expect(personalIncomeCategoriesTable.get).not.toHaveBeenCalled()
      expect(servicesTable.add).toHaveBeenCalledWith(
        expect.objectContaining({ personalCategoryId: undefined }),
      )
    })

    it('normaliza un string de solo espacios a ausencia', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())

      await createServiceIncome(baseIncomeInput({ personalCategoryId: '   ' }))

      expect(personalIncomeCategoriesTable.get).not.toHaveBeenCalled()
      expect(servicesTable.add).toHaveBeenCalledWith(
        expect.objectContaining({ personalCategoryId: undefined }),
      )
    })

    it('recorta espacios de un ID válido antes de consultarlo', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      personalIncomeCategoriesTable.get.mockResolvedValue(personalCategory)

      await createServiceIncome(baseIncomeInput({ personalCategoryId: '  pic-1  ' }))

      expect(personalIncomeCategoriesTable.get).toHaveBeenCalledWith('pic-1')
      expect(servicesTable.add).toHaveBeenCalledWith(
        expect.objectContaining({ personalCategoryId: 'pic-1' }),
      )
    })

    it('rechaza un personalCategoryId de tipo distinto de string', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())

      await expect(
        createServiceIncome(baseIncomeInput({ personalCategoryId: 123 as unknown as string })),
      ).rejects.toThrow('PERSONAL_INCOME_CATEGORY_INVALID_ID')
      expect(personalIncomeCategoriesTable.get).not.toHaveBeenCalled()
    })
  })
  it('persiste incomeCalculationMethod="service_duration" por defecto cuando el input no lo especifica', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())

    await createServiceIncome(baseIncomeInput())

    expect(servicesTable.add).toHaveBeenCalledTimes(1)
    const persisted = servicesTable.add.mock.calls[0][0]
    expect(persisted.incomeCalculationMethod).toBe('service_duration')
  })

  it('respeta el incomeCalculationMethod explícito del input (p.ej. "hourly_workday")', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())

    await createServiceIncome(baseIncomeInput({ incomeCalculationMethod: 'hourly_workday' }))

    const persisted = servicesTable.add.mock.calls[0][0]
    expect(persisted.incomeCalculationMethod).toBe('hourly_workday')
  })

  it('no persiste tipo de pago en Personal aunque el input no lo traiga', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())

    await createServiceIncome(baseIncomeInput({
      incomeCalculationMethod: 'hourly_workday',
      paymentType: undefined,
    }))

    expect(servicesTable.add).toHaveBeenCalledWith(
      expect.objectContaining({
        incomeCalculationMethod: 'hourly_workday',
        paymentType: undefined,
      }),
    )
  })

  it('descarta el tipo de pago explícito en Personal', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())

    await createServiceIncome(baseIncomeInput({
      incomeCalculationMethod: 'hourly_workday',
      paymentType: 'transfer',
    }))

    expect(servicesTable.add).toHaveBeenCalledWith(
      expect.objectContaining({
        incomeCalculationMethod: 'hourly_workday',
        paymentType: undefined,
      }),
    )
  })

  it('no persiste tipo de pago en un servicio Personal', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())

    await createServiceIncome(baseIncomeInput({
      incomeCalculationMethod: 'service_duration',
      paymentType: 'cash',
    }))

    expect(servicesTable.add).toHaveBeenCalledWith(
      expect.objectContaining({
        incomeCalculationMethod: 'service_duration',
        paymentType: undefined,
      }),
    )
  })

  it('rechaza un ingreso anterior al inicio de la temporada activa sin persistirlo', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    getActiveEarningPeriodMock.mockResolvedValue({
      id: 7,
      startDate: '2026-01-02T00:00:00.000Z',
      percentage: 50,
    })

    await expect(
      createServiceIncome(baseIncomeInput({ date: '2026-01-01' })),
    ).rejects.toThrow('La fecha del ingreso no puede ser anterior al inicio de la temporada.')

    expect(servicesTable.add).not.toHaveBeenCalled()
  })

  it('permite un ingreso en la misma fecha de inicio de la temporada activa', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    getActiveEarningPeriodMock.mockResolvedValue({
      id: 7,
      startDate: '2026-01-02T00:00:00.000Z',
      percentage: 50,
    })

    await createServiceIncome(baseIncomeInput({ date: '2026-01-02' }))

    expect(servicesTable.add).toHaveBeenCalledWith(
      expect.objectContaining({ date: '2026-01-02', earningPeriodId: 7 }),
    )
  })

  it('revalida la temporada activa dentro de la transacción antes de persistir', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    let transactionStarted = false
    transactionMock.mockImplementation(async (_mode, tables, callback: () => unknown) => {
      transactionStarted = true
      expect(tables).toEqual([
        servicesTable,
        expect.anything(),
        expect.anything(),
      ])
      return callback()
    })
    getActiveEarningPeriodMock.mockImplementation(() => {
      expect(transactionStarted).toBe(true)
      return {
        id: 7,
        startDate: '2026-01-02T00:00:00.000Z',
        percentage: 50,
      }
    })

    await createServiceIncome(baseIncomeInput({ date: '2026-01-02' }))

    expect(getActiveEarningPeriodMock).toHaveBeenCalledTimes(1)
    expect(servicesTable.add).toHaveBeenCalledTimes(1)
  })
})

describe('updateServiceIncome', () => {
  it('permite modificar y eliminar únicamente el nombre Personal sin cambiar el ID', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic', personalName: 'Anterior' }) }
    servicesTable.get.mockResolvedValue(current)
    servicesTable.toArray.mockResolvedValue([current])
    expensesTable.toArray.mockResolvedValue([])

    const renamed = await updateServiceIncome(1, { personalName: '  Nueva   nómina ' })
    expect(renamed).toEqual(expect.objectContaining({ id: 1, personalName: 'Nueva nómina', totalAmount: 100 }))

    const cleared = await updateServiceIncome(1, { personalName: '   ' })
    expect(cleared.personalName).toBeUndefined()
  })
  describe('categoría de ingreso personal (updateServiceIncome)', () => {
    const archivedCategory = { id: 'pic-1', name: 'Nómina', normalizedName: 'nomina', usageMode: 'basic', isArchived: true }
    const activeCategory = { id: 'pic-2', name: 'Reembolsos', normalizedName: 'reembolsos', usageMode: 'basic', isArchived: false }

    it('permite retirar una categoría previamente asignada', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic', personalCategoryId: 'pic-1' }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])

      const result = await updateServiceIncome(1, { personalCategoryId: '' })

      expect(result.personalCategoryId).toBeUndefined()
      expect(personalIncomeCategoriesTable.get).not.toHaveBeenCalled()
    })

    it('normaliza un personalCategoryId de solo espacios como ausencia al editar', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic', personalCategoryId: 'pic-1' }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])

      const result = await updateServiceIncome(1, { personalCategoryId: '   ' })

      expect(result.personalCategoryId).toBeUndefined()
      expect(personalIncomeCategoriesTable.get).not.toHaveBeenCalled()
    })

    it('permite conservar una categoría ya asignada aunque se haya archivado desde entonces', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic', personalCategoryId: 'pic-1' }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])
      personalIncomeCategoriesTable.get.mockResolvedValue(archivedCategory)

      const result = await updateServiceIncome(1, { personalCategoryId: 'pic-1' })

      expect(result.personalCategoryId).toBe('pic-1')
    })

    it('rechaza asignar una categoría archivada distinta a la que ya tenía', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic', personalCategoryId: 'pic-2' }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])
      personalIncomeCategoriesTable.get.mockResolvedValue(archivedCategory)

      await expect(
        updateServiceIncome(1, { personalCategoryId: 'pic-1' }),
      ).rejects.toThrow('La categoría de ingreso personal no es válida.')
    })

    it('permite asignar una categoría válida y activa distinta a la actual', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic', personalCategoryId: undefined }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])
      personalIncomeCategoriesTable.get.mockResolvedValue(activeCategory)

      const result = await updateServiceIncome(1, { personalCategoryId: 'pic-2' })

      expect(result.personalCategoryId).toBe('pic-2')
    })

    it('rechaza una categoría inexistente al editar', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic' }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])
      personalIncomeCategoriesTable.get.mockResolvedValue(undefined)

      await expect(
        updateServiceIncome(1, { personalCategoryId: 'no-existe' }),
      ).rejects.toThrow('La categoría de ingreso personal no es válida.')
    })

    it('rechaza un personalCategoryId de tipo distinto de string al editar', async () => {
      getSettingsMock.mockResolvedValue(basicSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'basic' }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])

      await expect(
        updateServiceIncome(1, { personalCategoryId: 123 as unknown as string }),
      ).rejects.toThrow('PERSONAL_INCOME_CATEGORY_INVALID_ID')
    })

    it('en profesional, ignora personalCategoryId defensivamente y no lo persiste', async () => {
      getSettingsMock.mockResolvedValue(professionalSettings())
      const current: ServiceIncome = { id: 1, ...baseIncomeInput({ usageMode: 'professional', earningPeriodId: 7 }) }
      servicesTable.get.mockResolvedValue(current)
      servicesTable.toArray.mockResolvedValue([current])
      expensesTable.toArray.mockResolvedValue([])
      getEarningPeriodByIdMock.mockResolvedValue({ id: 7, startDate: '2026-01-01T00:00:00.000Z' })

      const result = await updateServiceIncome(1, { personalCategoryId: 'pic-1' })

      expect(result.personalCategoryId).toBeUndefined()
      expect(personalIncomeCategoriesTable.get).not.toHaveBeenCalled()
    })
  })

  it('ignora un incomeCalculationMethod distinto en los updates (inmutable tras la creación)', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput(),
      incomeCalculationMethod: 'service_duration',
    }
    servicesTable.get.mockResolvedValue(current)
    servicesTable.toArray.mockResolvedValue([current])
    expensesTable.toArray.mockResolvedValue([])

    const result = await updateServiceIncome(1, {
      incomeCalculationMethod: 'hourly_workday',
      totalAmount: 200,
    })

    expect(result.incomeCalculationMethod).toBe('service_duration')
    expect(result.totalAmount).toBe(200)
    expect(servicesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ incomeCalculationMethod: 'service_duration' }),
    )
  })

  it('permite modificar el tipo de pago al editar una jornada por horas', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        incomeCalculationMethod: 'hourly_workday',
        paymentType: 'cash',
        usageMode: 'professional',
        earningPeriodId: 7,
      }),
    }
    servicesTable.get.mockResolvedValue(current)
    servicesTable.toArray.mockResolvedValue([current])
    expensesTable.toArray.mockResolvedValue([])
    getEarningPeriodByIdMock.mockResolvedValue({ id: 7, startDate: '2026-01-01T00:00:00.000Z' })

    const result = await updateServiceIncome(1, { paymentType: 'transfer' })

    expect(result.paymentType).toBe('transfer')
    expect(servicesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ paymentType: 'transfer' }),
    )
  })

  it('conserva el tipo de pago de una jornada si la edición no lo vuelve a enviar', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        incomeCalculationMethod: 'hourly_workday',
        paymentType: 'cash',
        usageMode: 'professional',
        earningPeriodId: 7,
      }),
    }
    servicesTable.get.mockResolvedValue(current)
    servicesTable.toArray.mockResolvedValue([current])
    expensesTable.toArray.mockResolvedValue([])
    getEarningPeriodByIdMock.mockResolvedValue({ id: 7, startDate: '2026-01-01T00:00:00.000Z' })

    const result = await updateServiceIncome(1, { totalAmount: 200 })

    expect(result.paymentType).toBe('cash')
    expect(servicesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ paymentType: 'cash' }),
    )
  })

  it('rechaza mover un ingreso a una fecha anterior al inicio de su temporada', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        date: '2026-01-03',
        earningPeriodId: 7,
        usageMode: 'professional',
      }),
    }
    servicesTable.get.mockResolvedValue(current)
    getEarningPeriodByIdMock.mockResolvedValue({
      id: 7,
      startDate: '2026-01-02T00:00:00.000Z',
    })

    await expect(
      updateServiceIncome(1, { date: '2026-01-01' }),
    ).rejects.toThrow('La fecha del ingreso no puede ser anterior al inicio de la temporada.')

    expect(servicesTable.put).not.toHaveBeenCalled()
  })

  it('rechaza cambiar la temporada vinculada a un ingreso existente', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        date: '2026-01-03',
        earningPeriodId: 7,
        usageMode: 'professional',
      }),
    }
    servicesTable.get.mockResolvedValue(current)

    await expect(
      updateServiceIncome(1, { earningPeriodId: 8 }),
    ).rejects.toThrow('No se puede cambiar la temporada de un ingreso existente.')

    expect(getEarningPeriodByIdMock).not.toHaveBeenCalled()
    expect(servicesTable.put).not.toHaveBeenCalled()
  })

  it('rechaza modificar un ingreso profesional sin una temporada válida', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        date: '2026-01-03',
        earningPeriodId: 7,
        usageMode: 'professional',
      }),
    }
    servicesTable.get.mockResolvedValue(current)
    getEarningPeriodByIdMock.mockResolvedValue(undefined)

    await expect(
      updateServiceIncome(1, { date: '2026-01-04' }),
    ).rejects.toThrow('No se puede modificar el ingreso porque su temporada no existe.')

    expect(servicesTable.put).not.toHaveBeenCalled()
  })

  it('limpia el tipo de pago histórico de un servicio Personal al editarlo', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        incomeCalculationMethod: 'service_duration',
        paymentType: 'cash',
        usageMode: 'basic',
      }),
    }
    servicesTable.get.mockResolvedValue(current)
    servicesTable.toArray.mockResolvedValue([current])
    expensesTable.toArray.mockResolvedValue([])

    const result = await updateServiceIncome(1, { paymentType: undefined, totalAmount: 200 })

    expect(result.paymentType).toBeUndefined()
    expect(servicesTable.put).toHaveBeenCalledWith(
      expect.objectContaining({ paymentType: undefined }),
    )
  })

  it('rechaza eliminar explícitamente el vínculo de temporada', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        date: '2026-01-03',
        earningPeriodId: 7,
        usageMode: 'professional',
      }),
    }
    servicesTable.get.mockResolvedValue(current)

    await expect(
      updateServiceIncome(1, { earningPeriodId: undefined }),
    ).rejects.toThrow('No se puede cambiar la temporada de un ingreso existente.')

    expect(servicesTable.put).not.toHaveBeenCalled()
  })

  it('valida dentro de la transacción contra la versión más reciente del ingreso', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const initial: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        date: '2026-01-03',
        earningPeriodId: 7,
        usageMode: 'professional',
      }),
    }
    const latest: ServiceIncome = {
      ...initial,
      earningPeriodId: 8,
      seasonPeriodId: 8,
    }
    servicesTable.get
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(latest)
    servicesTable.toArray.mockResolvedValue([latest])
    expensesTable.toArray.mockResolvedValue([])
    getEarningPeriodByIdMock.mockResolvedValue({
      id: 8,
      startDate: '2026-01-04T00:00:00.000Z',
    })

    await expect(
      updateServiceIncome(1, { date: '2026-01-03' }),
    ).rejects.toThrow('La fecha del ingreso no puede ser anterior al inicio de la temporada.')

    expect(getEarningPeriodByIdMock).toHaveBeenCalledWith(8)
    expect(servicesTable.put).not.toHaveBeenCalled()
  })

  it('rechaza un ingreso cuyos dos aliases apuntan a temporadas distintas', async () => {
    getSettingsMock.mockResolvedValue(professionalSettings())
    const current: ServiceIncome = {
      id: 1,
      ...baseIncomeInput({
        earningPeriodId: 7,
        seasonPeriodId: 8,
        usageMode: 'professional',
      }),
    }
    servicesTable.get.mockResolvedValue(current)
    servicesTable.toArray.mockResolvedValue([current])
    expensesTable.toArray.mockResolvedValue([])

    await expect(
      updateServiceIncome(1, { totalAmount: 200 }),
    ).rejects.toThrow('No se puede modificar el ingreso porque su temporada no existe.')

    expect(servicesTable.put).not.toHaveBeenCalled()
  })
})

describe('deleteServiceIncome', () => {
  function mockNoLinkedAdjustment() {
    expensesTable.where.mockReturnValue({
      equals: () => ({
        and: () => ({ first: async () => undefined }),
      }),
    })
  }

  function mockLinkedAdjustment() {
    expensesTable.where.mockReturnValue({
      equals: () => ({
        and: () => ({ first: async () => ({ id: 99, type: 'ajuste', relatedIncomeId: 1 }) }),
      }),
    })
  }

  it('borra en cascada los incomeAdditionals del ingreso antes de eliminar el ingreso', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = { id: 1, ...baseIncomeInput() }
    servicesTable.get.mockResolvedValue(current)
    mockNoLinkedAdjustment()
    const deleteAdditionalsMock = vi.fn()
    incomeAdditionalsTable.where.mockReturnValue({
      equals: () => ({ delete: deleteAdditionalsMock }),
    })

    await deleteServiceIncome(1)

    expect(incomeAdditionalsTable.where).toHaveBeenCalledWith('incomeId')
    expect(deleteAdditionalsMock).toHaveBeenCalledTimes(1)
    expect(servicesTable.delete).toHaveBeenCalledWith(1)
  })

  it('sigue bloqueando el borrado si hay un ajuste vinculado (regresión)', async () => {
    getSettingsMock.mockResolvedValue(basicSettings())
    const current: ServiceIncome = { id: 1, ...baseIncomeInput() }
    servicesTable.get.mockResolvedValue(current)
    mockLinkedAdjustment()

    await expect(deleteServiceIncome(1)).rejects.toThrow(
      'No puedes eliminar un ingreso que tiene ajustes relacionados. Elimina primero sus ajustes.',
    )
    expect(servicesTable.delete).not.toHaveBeenCalled()
  })
})

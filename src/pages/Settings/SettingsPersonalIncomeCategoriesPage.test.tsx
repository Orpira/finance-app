// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { DialogProvider } from '../../components/dialogs/DialogProvider'
import type { PersonalIncomeCategory } from '../../types/personalIncomeCategory'

const service = {
  archivePersonalIncomeCategory: vi.fn(),
  countIncomeReferencesForCategory: vi.fn(),
  createPersonalIncomeCategory: vi.fn(),
  deletePersonalIncomeCategory: vi.fn(),
  listPersonalIncomeCategories: vi.fn(),
  reactivatePersonalIncomeCategory: vi.fn(),
  renamePersonalIncomeCategory: vi.fn(),
}

vi.mock('../../services/personalIncomeCategoryService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/personalIncomeCategoryService')>()
  return {
    ...actual,
    archivePersonalIncomeCategory: (...args: unknown[]) => service.archivePersonalIncomeCategory(...args),
    countIncomeReferencesForCategory: (...args: unknown[]) => service.countIncomeReferencesForCategory(...args),
    createPersonalIncomeCategory: (...args: unknown[]) => service.createPersonalIncomeCategory(...args),
    deletePersonalIncomeCategory: (...args: unknown[]) => service.deletePersonalIncomeCategory(...args),
    listPersonalIncomeCategories: (...args: unknown[]) => service.listPersonalIncomeCategories(...args),
    reactivatePersonalIncomeCategory: (...args: unknown[]) => service.reactivatePersonalIncomeCategory(...args),
    renamePersonalIncomeCategory: (...args: unknown[]) => service.renamePersonalIncomeCategory(...args),
  }
})

const { SettingsPersonalIncomeCategoriesPage } = await import('./SettingsPersonalIncomeCategoriesPage')

function category(overrides: Partial<PersonalIncomeCategory> = {}): PersonalIncomeCategory {
  return {
    id: 'pic-1',
    name: 'Nómina',
    normalizedName: 'nomina',
    usageMode: 'basic',
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DialogProvider>
        <SettingsPersonalIncomeCategoriesPage />
      </DialogProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SettingsPersonalIncomeCategoriesPage', () => {
  it('muestra el estado vacío explicando que las categorías son opcionales', async () => {
    service.listPersonalIncomeCategories.mockResolvedValue([])

    renderPage()

    await screen.findByText(/Todavía no creaste categorías/)
  })

  it('lista las categorías activas con su cantidad de ingresos asociados', async () => {
    service.listPersonalIncomeCategories.mockResolvedValue([category()])
    service.countIncomeReferencesForCategory.mockResolvedValue(3)

    renderPage()

    await screen.findByText('Nómina')
    await screen.findByText(/3 ingresos asociados/)
  })

  it('lista las categorías archivadas con la indicación "Archivada"', async () => {
    service.listPersonalIncomeCategories.mockResolvedValue([category({ isArchived: true })])
    service.countIncomeReferencesForCategory.mockResolvedValue(0)

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Archivadas/ }))
    await screen.findByText('Archivada')
    await screen.findByText(/Sin ingresos asociados/)
  })

  it('crea una categoría y refresca el listado', async () => {
    service.listPersonalIncomeCategories
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([category({ name: 'Reembolsos', normalizedName: 'reembolsos' })])
    service.countIncomeReferencesForCategory.mockResolvedValue(0)
    service.createPersonalIncomeCategory.mockResolvedValue(category({ name: 'Reembolsos', normalizedName: 'reembolsos' }))

    renderPage()
    await screen.findByText(/Todavía no creaste categorías/)

    fireEvent.change(screen.getByPlaceholderText('Ej. Nómina, reembolso, venta'), {
      target: { value: 'Reembolsos' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/ }))

    await waitFor(() => expect(service.createPersonalIncomeCategory).toHaveBeenCalledWith({ name: 'Reembolsos' }))
    await screen.findByText('Reembolsos')
  })

  it('archiva una categoría activa', async () => {
    service.listPersonalIncomeCategories
      .mockResolvedValueOnce([category()])
      .mockResolvedValueOnce([category({ isArchived: true })])
    service.countIncomeReferencesForCategory.mockResolvedValue(0)
    service.archivePersonalIncomeCategory.mockResolvedValue(category({ isArchived: true }))

    renderPage()
    await screen.findByText('Nómina')

    fireEvent.click(screen.getByRole('button', { name: /Archivar/ }))

    await waitFor(() => expect(service.archivePersonalIncomeCategory).toHaveBeenCalledWith('pic-1'))
  })

  it('bloquea la eliminación cuando existen referencias y explica por qué', async () => {
    service.listPersonalIncomeCategories.mockResolvedValue([category()])
    service.countIncomeReferencesForCategory.mockResolvedValue(2)

    renderPage()
    await screen.findByText(/2 ingresos asociados/)

    const deleteButton = screen.getByRole('button', { name: /Eliminar/ }) as HTMLButtonElement
    expect(deleteButton.disabled).toBe(true)
    expect(service.deletePersonalIncomeCategory).not.toHaveBeenCalled()
  })

  it('elimina una categoría sin referencias tras confirmar', async () => {
    service.listPersonalIncomeCategories
      .mockResolvedValueOnce([category()])
      .mockResolvedValueOnce([])
    service.countIncomeReferencesForCategory.mockResolvedValue(0)
    service.deletePersonalIncomeCategory.mockResolvedValue(true)

    renderPage()
    await screen.findByText(/Sin ingresos asociados/)

    fireEvent.click(screen.getByRole('button', { name: /Eliminar/ }))
    const confirmDialog = await screen.findByRole('dialog')
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Eliminar' }))

    await waitFor(() => expect(service.deletePersonalIncomeCategory).toHaveBeenCalledWith('pic-1'))
    await screen.findByText(/Todavía no creaste categorías/)
  })

  it('previene doble acción deshabilitando los botones de fila mientras una operación está en curso', async () => {
    service.listPersonalIncomeCategories.mockResolvedValue([category()])
    service.countIncomeReferencesForCategory.mockResolvedValue(0)
    let resolveArchive: () => void = () => {}
    service.archivePersonalIncomeCategory.mockImplementation(
      () => new Promise((resolve) => { resolveArchive = () => resolve(category({ isArchived: true })) }),
    )

    renderPage()
    await screen.findByText('Nómina')

    const archiveButton = screen.getByRole('button', { name: /Archivar/ })
    fireEvent.click(archiveButton)

    await waitFor(() =>
      expect((screen.getByRole('button', { name: /Renombrar/ }) as HTMLButtonElement).disabled).toBe(true),
    )

    resolveArchive()
  })
})

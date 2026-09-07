import { Archive, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../../components/dialogs/useDialog'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  archivePersonalIncomeCategory,
  countIncomeReferencesForCategory,
  createPersonalIncomeCategory,
  deletePersonalIncomeCategory,
  listPersonalIncomeCategories,
  normalizePersonalIncomeCategoryName,
  PERSONAL_INCOME_CATEGORIES_CHANGED_EVENT,
  reactivatePersonalIncomeCategory,
  renamePersonalIncomeCategory,
  type PersonalIncomeCategoryListOptions,
} from '../../services/personalIncomeCategoryService'
import type { PersonalIncomeCategory } from '../../types/personalIncomeCategory'

type CategoryFilter = PersonalIncomeCategoryListOptions['archived']

export function SettingsPersonalIncomeCategoriesPage() {
  const { alert, confirm, prompt } = useDialog()
  const [categories, setCategories] = useState<PersonalIncomeCategory[]>([])
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<CategoryFilter>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [newName, setNewName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  async function loadCategories(nextFilter: CategoryFilter = filter) {
    setIsLoading(true)
    setLoadError('')
    try {
      const nextCategories = await listPersonalIncomeCategories({ archived: nextFilter })
      const counts = await Promise.all(
        nextCategories.map((category) => countIncomeReferencesForCategory(category.id)),
      )
      setCategories(nextCategories)
      setUsageCounts(
        Object.fromEntries(nextCategories.map((category, index) => [category.id, counts[index]])),
      )
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las categorías.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    async function initialLoad() {
      await loadCategories(filter)
    }
    void initialLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    function handleExternalChange() {
      async function reload() {
        await loadCategories(filter)
      }
      void reload()
    }
    window.addEventListener(PERSONAL_INCOME_CATEGORIES_CHANGED_EVENT, handleExternalChange)
    return () => window.removeEventListener(PERSONAL_INCOME_CATEGORIES_CHANGED_EVENT, handleExternalChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    if (!statusMessage) return
    const timeoutId = window.setTimeout(() => setStatusMessage(''), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [statusMessage])

  const categoryCounts = useMemo(() => ({
    active: categories.filter((category) => !category.isArchived).length,
    archived: categories.filter((category) => category.isArchived).length,
  }), [categories])

  async function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const cleanName = newName.trim()

    if (!cleanName) {
      await alert({ type: 'warning', title: 'Nombre requerido', message: 'Escribe un nombre para la categoría.' })
      return
    }

    setIsSubmitting(true)
    try {
      const created = await createPersonalIncomeCategory({ name: cleanName })
      setNewName('')
      await loadCategories(filter)
      setStatusMessage(`Categoría “${created.name}” creada.`)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo guardar',
        message: error instanceof Error ? error.message : 'La categoría no se pudo crear.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRenameCategory(category: PersonalIncomeCategory) {
    if (busyCategoryId) return
    const nextName = await prompt({
      title: 'Renombrar categoría',
      message: 'Escribe el nuevo nombre para la categoría.',
      initialValue: category.name,
      placeholder: 'Ej. Nómina',
      confirmLabel: 'Guardar',
      validate: (value) => {
        try {
          normalizePersonalIncomeCategoryName(value)
          return undefined
        } catch (error) {
          return error instanceof Error ? error.message : 'Nombre inválido.'
        }
      },
    })

    if (!nextName) {
      return
    }

    setBusyCategoryId(category.id)
    try {
      await renamePersonalIncomeCategory(category.id, nextName)
      await loadCategories(filter)
      setStatusMessage(`Categoría renombrada a “${nextName.trim()}”.`)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo renombrar',
        message: error instanceof Error ? error.message : 'No se pudo guardar el cambio.',
      })
    } finally {
      setBusyCategoryId(null)
    }
  }

  async function handleToggleArchive(category: PersonalIncomeCategory) {
    if (busyCategoryId) return
    setBusyCategoryId(category.id)
    try {
      if (category.isArchived) {
        await reactivatePersonalIncomeCategory(category.id)
        setStatusMessage(`Categoría “${category.name}” reactivada.`)
      } else {
        await archivePersonalIncomeCategory(category.id)
        setStatusMessage(`Categoría “${category.name}” archivada.`)
      }
      await loadCategories(filter)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo actualizar',
        message: error instanceof Error ? error.message : 'No se pudo cambiar el estado de la categoría.',
      })
    } finally {
      setBusyCategoryId(null)
    }
  }

  async function handleDeleteCategory(category: PersonalIncomeCategory) {
    if (busyCategoryId) return
    const usageCount = usageCounts[category.id] ?? await countIncomeReferencesForCategory(category.id)

    if (usageCount > 0) {
      await alert({
        type: 'warning',
        title: 'La categoría está en uso',
        message: 'Esta categoría está asociada a ingresos existentes. Archívala en su lugar para evitar romper el historial.',
      })
      return
    }

    const confirmed = await confirm({
      title: 'Eliminar categoría',
      message: `¿Eliminar “${category.name}”? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      confirmTone: 'danger',
    })

    if (!confirmed) {
      return
    }

    setBusyCategoryId(category.id)
    try {
      // The service re-checks references transactionally: the count shown here is
      // a UI convenience, never the real integrity barrier.
      await deletePersonalIncomeCategory(category.id)
      await loadCategories(filter)
      setStatusMessage(`Categoría “${category.name}” eliminada.`)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo eliminar',
        message: error instanceof Error ? error.message : 'No se pudo eliminar la categoría.',
      })
      await loadCategories(filter)
    } finally {
      setBusyCategoryId(null)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Ingresos personales"
        title="Categorías de ingreso personal"
      />

      <p aria-live="polite" className="sr-only" role="status">
        {statusMessage}
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleCreateCategory}>
          <label className="sr-only" htmlFor="new-personal-income-category-name">
            Nombre de la nueva categoría
          </label>
          <input
            className="h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            id="new-personal-income-category-name"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Ej. Nómina, reembolso, venta"
            value={newName}
          />
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting}
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {isSubmitting ? 'Guardando...' : 'Nueva categoría'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['active', 'archived', 'all'] as CategoryFilter[]).map((option) => (
            <button
              aria-pressed={filter === option}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                filter === option
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
              key={option}
              onClick={() => setFilter(option)}
              type="button"
            >
              {option === 'active' ? 'Activas' : option === 'archived' ? 'Archivadas' : 'Todas'}
              {option === 'active' && categoryCounts.active > 0 ? ` (${categoryCounts.active})` : ''}
              {option === 'archived' && categoryCounts.archived > 0 ? ` (${categoryCounts.archived})` : ''}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Cargando categorías…</p>
        ) : loadError ? (
          <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{loadError}</p>
            <button
              className="self-start font-semibold underline"
              onClick={() => loadCategories(filter)}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-500">
            {filter === 'archived'
              ? 'No tienes categorías archivadas.'
              : 'Todavía no creaste categorías. Son opcionales: te sirven para organizar tus ingresos personales, por ejemplo “Nómina” o “Reembolsos”.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {categories.map((category) => {
              const usageCount = usageCounts[category.id] ?? 0
              const isRowBusy = busyCategoryId === category.id
              const isAnyRowBusy = busyCategoryId !== null
              return (
                <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={category.id}>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {category.name}
                      {category.isArchived ? (
                        <span className="ml-2 rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Archivada
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-500">
                      {usageCount === 0
                        ? 'Sin ingresos asociados'
                        : usageCount === 1
                          ? '1 ingreso asociado'
                          : `${usageCount} ingresos asociados`}
                      {' · '}
                      Actualizada el {new Date(category.updatedAt).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isAnyRowBusy}
                      onClick={() => handleRenameCategory(category)}
                      type="button"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Renombrar
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isAnyRowBusy}
                      onClick={() => handleToggleArchive(category)}
                      type="button"
                    >
                      {category.isArchived ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <Archive className="size-3.5" aria-hidden="true" />}
                      {isRowBusy ? 'Guardando...' : category.isArchived ? 'Reactivar' : 'Archivar'}
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isAnyRowBusy || usageCount > 0}
                      onClick={() => handleDeleteCategory(category)}
                      title={usageCount > 0 ? 'No se puede eliminar: tiene ingresos asociados. Archívala en su lugar.' : undefined}
                      type="button"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Eliminar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default SettingsPersonalIncomeCategoriesPage

import { Archive, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDialog } from '../../components/dialogs/useDialog'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  archivePersonalExpenseCategory,
  countExpenseReferencesForCategory,
  createPersonalExpenseCategory,
  deletePersonalExpenseCategory,
  listPersonalExpenseCategories,
  normalizePersonalExpenseCategoryName,
  reactivatePersonalExpenseCategory,
  renamePersonalExpenseCategory,
  type PersonalExpenseCategoryListOptions,
} from '../../services/personalExpenseCategoryService'
import type { PersonalExpenseCategory } from '../../types/personalExpenseCategory'

type CategoryFilter = PersonalExpenseCategoryListOptions['archived']

export function SettingsPersonalExpenseCategoriesPage() {
  const { alert, confirm, prompt } = useDialog()
  const [categories, setCategories] = useState<PersonalExpenseCategory[]>([])
  const [filter, setFilter] = useState<CategoryFilter>('active')
  const [newName, setNewName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function loadCategories() {
    setIsLoading(true)
    try {
      setCategories(await listPersonalExpenseCategories({ archived: filter }))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    async function initialLoad() {
      await loadCategories()
    }
    void initialLoad()
    // The filter is the intentional reload boundary for this local catalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    try {
      await createPersonalExpenseCategory({ name: newName })
      setNewName('')
      await loadCategories()
    } catch (error) {
      await alert({ type: 'error', title: 'No se pudo guardar', message: error instanceof Error ? error.message : 'No se pudo crear la categoría.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRename(category: PersonalExpenseCategory) {
    const nextName = await prompt({
      title: 'Renombrar categoría',
      message: 'Escribe el nuevo nombre de la categoría de egreso.',
      initialValue: category.name,
      confirmLabel: 'Guardar',
      validate: (value) => {
        try {
          normalizePersonalExpenseCategoryName(value)
          return undefined
        } catch (error) {
          return error instanceof Error ? error.message : 'Nombre inválido.'
        }
      },
    })
    if (!nextName) return
    try {
      await renamePersonalExpenseCategory(category.id, nextName)
      await loadCategories()
    } catch (error) {
      await alert({ type: 'error', title: 'No se pudo renombrar', message: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' })
    }
  }

  async function handleArchiveToggle(category: PersonalExpenseCategory) {
    try {
      if (category.isArchived) await reactivatePersonalExpenseCategory(category.id)
      else await archivePersonalExpenseCategory(category.id)
      await loadCategories()
    } catch (error) {
      await alert({ type: 'error', title: 'No se pudo actualizar', message: error instanceof Error ? error.message : 'No se pudo cambiar el estado.' })
    }
  }

  async function handleDelete(category: PersonalExpenseCategory) {
    const references = await countExpenseReferencesForCategory(category.id)
    if (references > 0) {
      await alert({ type: 'warning', title: 'La categoría está en uso', message: 'Esta categoría está asociada a egresos existentes. Archívala en su lugar.' })
      return
    }
    if (!await confirm({ title: 'Eliminar categoría', message: `¿Eliminar “${category.name}”? Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar', confirmTone: 'danger' })) return
    try {
      await deletePersonalExpenseCategory(category.id)
      await loadCategories()
    } catch (error) {
      await alert({ type: 'error', title: 'No se pudo eliminar', message: error instanceof Error ? error.message : 'No se pudo eliminar la categoría.' })
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader backLabel="Configuración" backTo="/settings" eyebrow="Egresos personales" title="Categorías de egreso personal" />
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleCreate}>
          <label className="sr-only" htmlFor="new-personal-expense-category">Nombre de categoría</label>
          <input id="new-personal-expense-category" className="h-11 flex-1 rounded-md border border-slate-300 px-3" onChange={(event) => setNewName(event.target.value)} placeholder="Ej. Alimentación, vivienda, salud" value={newName} />
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isSubmitting} type="submit"><Plus className="size-4" aria-hidden="true" />Nueva categoría</button>
        </form>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['active', 'archived', 'all'] as CategoryFilter[]).map((option) => (
            <button aria-pressed={filter === option} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm" key={option} onClick={() => setFilter(option)} type="button">{option === 'active' ? 'Activas' : option === 'archived' ? 'Archivadas' : 'Todas'}</button>
          ))}
        </div>
        {isLoading ? <p className="text-sm text-slate-500">Cargando categorías...</p> : categories.length === 0 ? <p className="text-sm text-slate-500">No hay categorías para este filtro.</p> : (
          <ul className="divide-y divide-slate-200">
            {categories.map((category) => (
              <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={category.id}>
                <div><p className="font-medium text-slate-900">{category.name}</p><p className="text-xs text-slate-500">{category.isArchived ? 'Archivada' : 'Activa'}</p></div>
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs" onClick={() => handleRename(category)} type="button"><Pencil className="size-3.5" aria-hidden="true" />Renombrar</button>
                  <button className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs" onClick={() => handleArchiveToggle(category)} type="button">{category.isArchived ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <Archive className="size-3.5" aria-hidden="true" />}{category.isArchived ? 'Reactivar' : 'Archivar'}</button>
                  <button className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700" onClick={() => handleDelete(category)} type="button"><Trash2 className="size-3.5" aria-hidden="true" />Eliminar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default SettingsPersonalExpenseCategoriesPage

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'

export interface IncomeAdditionalItem {
  id: number | string
  amount: number
  description?: string
}

interface IncomeAdditionalsSectionProps {
  additionals: IncomeAdditionalItem[]
  currency: CurrencyCode
  defaultOpen?: boolean
  onAdd: (input: { amount: number; description?: string }) => Promise<void> | void
  onDelete: (id: number | string) => Promise<void> | void
}

export function IncomeAdditionalsSection({
  additionals,
  currency,
  defaultOpen = false,
  onAdd,
  onDelete,
}: IncomeAdditionalsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [amount, setAmount] = useState(0)
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  async function handleAdd() {
    setError('')

    try {
      await onAdd({ amount, description: description.trim() || undefined })
      setAmount(0)
      setDescription('')
      setIsFormOpen(false)
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo añadir el adicional.',
      )
    }
  }

  const ToggleIcon = isOpen ? ChevronUp : ChevronDown

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="font-semibold text-slate-950 dark:text-white">
          Adicionales
          {additionals.length > 0 ? ` (${additionals.length})` : ''}
        </span>
        <ToggleIcon className="size-5 text-slate-500" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
          {additionals.length > 0 && (
            <ul className="flex flex-col gap-2">
              {additionals.map((additional) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                  key={additional.id}
                >
                  <span className="flex flex-col">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(additional.amount, currency)}
                    </span>
                    {additional.description && (
                      <span className="text-xs text-slate-500">
                        {additional.description}
                      </span>
                    )}
                  </span>
                  <button
                    aria-label="Eliminar adicional"
                    className="text-slate-400 transition hover:text-red-600"
                    onClick={() => onDelete(additional.id)}
                    type="button"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isFormOpen ? (
            <div className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Importe
                </span>
                <input
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  min={0.01}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  step="0.01"
                  type="number"
                  value={amount}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  Descripción{' '}
                  <span className="font-normal text-slate-500">(opcional)</span>
                </span>
                <input
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  maxLength={200}
                  onChange={(event) => setDescription(event.target.value)}
                  type="text"
                  value={description}
                />
              </label>
              {error && (
                <p className="text-sm font-medium text-red-600">{error}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  onClick={handleAdd}
                  type="button"
                >
                  Guardar adicional
                </button>
                <button
                  className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  onClick={() => {
                    setIsFormOpen(false)
                    setError('')
                  }}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-emerald-700 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
              onClick={() => setIsFormOpen(true)}
              type="button"
            >
              <Plus className="size-4" aria-hidden="true" />
              Añadir adicional
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default IncomeAdditionalsSection

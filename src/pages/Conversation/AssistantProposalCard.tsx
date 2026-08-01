import { useState } from 'react'

import type { AssistantProposalRecord } from '../../intelligence/assistant'
import type { CurrencyCode } from '../../types/settings'

interface AssistantProposalCardProps {
  readonly proposal: AssistantProposalRecord
  readonly disabled: boolean
  readonly onConfirm: (edits: Readonly<Record<string, string | number | null>>) => void
  readonly onCancel: () => void
}

const CURRENCY_OPTIONS: readonly CurrencyCode[] = [
  'EUR', 'USD', 'COP', 'MXN', 'GBP', 'ARS', 'BGN', 'CZK', 'DKK', 'HUF', 'PLN', 'RON', 'SEK',
]

const KIND_LABEL: Readonly<Record<AssistantProposalRecord['kind'], string>> = {
  register_income: 'Ingreso detectado',
  register_expense: 'Gasto detectado',
  create_appointment: 'Cita detectada',
}

const STATUS_BADGE: Readonly<Record<AssistantProposalRecord['status'], { label: string; tone: string } | null>> = {
  draft: null,
  awaiting_confirmation: null,
  confirmed: { label: 'Confirmando…', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  executing: { label: 'Guardando…', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  completed: { label: 'Guardado', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  cancelled: { label: 'Cancelado', tone: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  failed: { label: 'No se pudo guardar', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
}

const FIELD_LABEL: Readonly<Record<string, string>> = {
  amount: 'Importe',
  currency: 'Moneda',
  date: 'Fecha',
  description: 'Descripción',
  category: 'Categoría',
  time: 'Hora',
  durationMinutes: 'Duración (min)',
  expectedAmount: 'Importe esperado',
}

function isFieldEditable(status: AssistantProposalRecord['status']): boolean {
  return status === 'draft' || status === 'awaiting_confirmation'
}

export function AssistantProposalCard({ proposal, disabled, onConfirm, onCancel }: AssistantProposalCardProps) {
  const [draft, setDraft] = useState<Record<string, string | number | null>>({ ...proposal.fields })
  const editable = isFieldEditable(proposal.status) && !disabled
  const badge = STATUS_BADGE[proposal.status]

  function updateField(field: string, value: string | number | null) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function handleConfirm() {
    onConfirm(draft)
  }

  const fieldEntries = Object.keys(proposal.fields)

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {KIND_LABEL[proposal.kind]}
        </p>
        {badge ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.tone}`}>{badge.label}</span>
        ) : null}
      </div>

      <dl className="mt-2 grid gap-2 sm:grid-cols-2">
        {fieldEntries.map((field) => {
          const value = draft[field]
          const isMissing = proposal.missingRequiredFields.includes(field)

          return (
            <div key={field}>
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {FIELD_LABEL[field] ?? field}
                {isMissing ? <span className="ml-1 text-rose-600 dark:text-rose-400">*</span> : null}
              </dt>
              <dd className="mt-0.5">
                {field === 'currency' && editable ? (
                  <select
                    aria-label={FIELD_LABEL.currency}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    onChange={(event) => updateField(field, event.target.value)}
                    value={(value as string) ?? ''}
                  >
                    <option value="">Selecciona…</option>
                    {CURRENCY_OPTIONS.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                ) : editable ? (
                  <input
                    aria-label={FIELD_LABEL[field] ?? field}
                    className={[
                      'h-9 w-full rounded-md border bg-white px-2 text-sm dark:bg-slate-900',
                      isMissing
                        ? 'border-rose-400 dark:border-rose-700'
                        : 'border-slate-300 dark:border-slate-600',
                    ].join(' ')}
                    onChange={(event) => {
                      const raw = event.target.value
                      const isNumeric = field === 'amount' || field === 'expectedAmount' || field === 'durationMinutes'
                      updateField(field, raw === '' ? null : isNumeric ? Number(raw) : raw)
                    }}
                    placeholder={isMissing ? 'Obligatorio' : undefined}
                    type={field === 'date' ? 'date' : field === 'time' ? 'time' : isNumeric(field) ? 'number' : 'text'}
                    value={value === null || value === undefined ? '' : String(value)}
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {value === null || value === undefined || value === '' ? '—' : String(value)}
                  </p>
                )}
              </dd>
            </div>
          )
        })}
      </dl>

      {isFieldEditable(proposal.status) ? (
        <div className="mt-3 flex justify-end gap-2">
          <button
            className="h-9 rounded-md px-3 text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60 dark:text-slate-300 dark:hover:text-white"
            disabled={disabled}
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled}
            onClick={handleConfirm}
            type="button"
          >
            Confirmar
          </button>
        </div>
      ) : proposal.status === 'failed' && proposal.failureReason ? (
        <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">{proposal.failureReason}</p>
      ) : null}
    </div>
  )
}

function isNumeric(field: string): boolean {
  return field === 'amount' || field === 'expectedAmount' || field === 'durationMinutes'
}

export default AssistantProposalCard

import { useEffect, useMemo, useRef, useState } from 'react'
import { KeyRound, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { getCurrentLicense } from '../../services/licenseService'
import type { LicenseType } from '../../types/license'
import { AssistantInteractiveDemo } from './AssistantInteractiveDemo'
import { ConversationHeader } from './ConversationHeader'
import { createConversationControllerDependencies } from './conversationComposition'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { useConversation } from './useConversation'

function isFreeLicense(licenseType: LicenseType | null): boolean {
  return licenseType === 'trial' || licenseType === 'demo'
}

function FreeAssistantExperience() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Private Balance"
        title="Copiloto"
      >
        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          to="/settings/license"
        >
          <KeyRound className="size-4" aria-hidden="true" />
          Activar licencia
        </Link>
      </PageHeader>

      <AssistantInteractiveDemo />
    </section>
  )
}

function LicensedConversationPage() {
  const dependencies = useMemo(
    () => createConversationControllerDependencies(),
    [],
  )
  const { state, sendMessage, confirmProposal, cancelProposal, clearContext, removeContextFilter } = useConversation(dependencies)
  const [searchParams, setSearchParams] = useSearchParams()
  const consumedQuery = useRef(false)

  useEffect(() => {
    const query = searchParams.get('query')?.trim()
    if (state.status !== 'ready' || consumedQuery.current || !query) return
    consumedQuery.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('query')
    setSearchParams(next, { replace: true })
    void sendMessage(query)
  }, [searchParams, sendMessage, setSearchParams, state.status])

  const isLoadingConversation =
    state.status === 'idle' ||
    state.status === 'loading'
  const isSending =
    state.status === 'sending'

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Private Balance"
        title="Copiloto"
      />

      <ConversationHeader isSending={isSending} status={state.status} />

      {state.context?.lastQuery ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300" aria-label="Contexto activo del Copiloto">
          {!state.context.hiddenFilters.includes('period') ? <button className="inline-flex min-h-9 items-center gap-1 rounded-md bg-slate-100 px-2 dark:bg-slate-800" aria-label="Quitar filtro de periodo" onClick={() => removeContextFilter('period')} type="button">Periodo: {state.context.period === 'previous_month' ? 'mes anterior' : state.context.period === 'previous_week' ? 'semana anterior' : state.context.period === 'yesterday' ? 'ayer' : 'actual'} <X className="size-3.5" aria-hidden="true" /></button> : null}
          {!state.context.hiddenFilters.includes('currency') ? <button className="inline-flex min-h-9 items-center gap-1 rounded-md bg-slate-100 px-2 dark:bg-slate-800" aria-label="Quitar filtro de moneda" onClick={() => removeContextFilter('currency')} type="button">Moneda: {state.context.currency} <X className="size-3.5" aria-hidden="true" /></button> : null}
          {state.context.lastCategory && !state.context.hiddenFilters.includes('category') ? <button className="inline-flex min-h-9 items-center gap-1 rounded-md bg-slate-100 px-2 dark:bg-slate-800" aria-label="Quitar filtro de categoría" onClick={() => removeContextFilter('category')} type="button">Categoría: {state.context.lastCategory} <X className="size-3.5" aria-hidden="true" /></button> : null}
          <button className="ml-auto inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-slate-200 dark:hover:bg-slate-800" onClick={clearContext} type="button">
            <X className="size-4" aria-hidden="true" />
            Limpiar contexto
          </button>
        </div>
      ) : null}

      {state.errorMessage ? (
        <div
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.errorMessage}
        </div>
      ) : null}

      <MessageList
        isLoadingConversation={isLoadingConversation}
        isSending={isSending}
        messages={state.messages}
        onCancelProposal={cancelProposal}
        onConfirmProposal={(input) => void confirmProposal(input)}
      />

      <MessageComposer
        disabled={isLoadingConversation || isSending}
        onSend={sendMessage}
      />
    </section>
  )
}

export function ConversationPage() {
  const [licenseType, setLicenseType] = useState<LicenseType | null | undefined>(() => (
    typeof window === 'undefined' ? null : undefined
  ))

  useEffect(() => {
    let cancelled = false

    getCurrentLicense()
      .then((license) => {
        if (!cancelled) {
          setLicenseType(license?.licenseType ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLicenseType(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (licenseType === undefined) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">
        Cargando Copiloto...
      </section>
    )
  }

  if (isFreeLicense(licenseType)) {
    return <FreeAssistantExperience />
  }

  return <LicensedConversationPage />
}

export default ConversationPage

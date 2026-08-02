import { useEffect, useMemo, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Link } from 'react-router-dom'

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
        title="Asistente"
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
  const { state, sendMessage, confirmProposal, cancelProposal } = useConversation(dependencies)

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
        title="Asistente"
      />

      <ConversationHeader isSending={isSending} status={state.status} />

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
        Cargando asistente...
      </section>
    )
  }

  if (isFreeLicense(licenseType)) {
    return <FreeAssistantExperience />
  }

  return <LicensedConversationPage />
}

export default ConversationPage

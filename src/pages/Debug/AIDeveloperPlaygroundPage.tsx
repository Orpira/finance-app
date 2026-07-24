import { useEffect, useMemo, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  createAIDeveloperPlaygroundDependencies,
} from './aiDeveloperPlaygroundComposition'
import type {
  AIDeveloperPlaygroundState,
} from './aiDeveloperPlaygroundController'

function stringifyPanel(value: unknown): string {
  if (value === null) {
    return 'Aun sin datos. Ejecuta el pipeline para visualizar esta etapa.'
  }

  return JSON.stringify(value, null, 2)
}

interface JsonPanelProps {
  readonly title: string
  readonly subtitle: string
  readonly value: unknown
}

function JsonPanel({ title, subtitle, value }: JsonPanelProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      <pre className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
        {stringifyPanel(value)}
      </pre>
    </article>
  )
}

const INITIAL_STATE: AIDeveloperPlaygroundState = {
  status: 'idle',
  requestDraft: '',
  submittedAt: null,
  request: null,
  executionResult: null,
  promptContext: null,
  response: null,
  renderedMessage: null,
  error: null,
}

export default function AIDeveloperPlaygroundPage() {
  const dependencies = useMemo(() => createAIDeveloperPlaygroundDependencies(), [])
  const [state, setState] = useState<AIDeveloperPlaygroundState>({
    ...INITIAL_STATE,
    requestDraft: dependencies.controller.getState().requestDraft,
  })

  useEffect(() => {
    const unsubscribe = dependencies.controller.subscribe((nextState) => {
      setState(nextState)
    })

    return () => {
      unsubscribe()
      dependencies.controller.dispose()
    }
  }, [dependencies.controller])

  const requestPanel = state.request === null
    ? null
    : {
      submittedAt: state.submittedAt,
      request: state.request,
    }

  async function handleRun() {
    await dependencies.controller.run()
  }

  return (
    <section className="mx-auto flex w-full max-w-7xl flex-col gap-4 pb-8">
      <PageHeader
        backLabel="Debug"
        backTo="/debug"
        eyebrow="Herramientas de desarrollo"
        title="AI Developer Playground"
      >
        <button
          className="inline-flex min-h-10 items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          disabled={state.status === 'running'}
          onClick={() => {
            void handleRun()
          }}
          type="button"
        >
          {state.status === 'running' ? 'Ejecutando pipeline...' : 'Ejecutar pipeline'}
        </button>
      </PageHeader>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Entorno de inspeccion de solo lectura para validar el pipeline conversacional completo mediante la fachada certificada.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-semibold text-slate-900" htmlFor="developer-playground-request">
          Conversation Request (JSON)
        </label>
        <textarea
          className="mt-2 h-56 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          id="developer-playground-request"
          onChange={(event) => {
            dependencies.controller.updateRequestDraft(event.target.value)
          }}
          value={state.requestDraft}
        />
      </div>

      {state.error === null ? null : (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
          <p className="font-semibold">Error en etapa: {state.error.stage}</p>
          <p className="mt-1">Codigo: {state.error.code}</p>
          <p className="mt-1">Detalle: {state.error.safeMessage}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonPanel
          title="Panel 1 · Conversation Request"
          subtitle="Solicitud enviada, parametros y timestamp de ejecucion"
          value={requestPanel}
        />
        <JsonPanel
          title="Panel 2 · Conversation Execution Result"
          subtitle="Herramientas ejecutadas, orden, resultados y errores"
          value={state.executionResult}
        />
        <JsonPanel
          title="Panel 3 · Prompt Context"
          subtitle="PromptContext serializado, metadatos y trazabilidad"
          value={state.promptContext}
        />
        <JsonPanel
          title="Panel 4 · Conversation Response"
          subtitle="ConversationResponse completo, bloques y metadatos"
          value={state.response}
        />
        <JsonPanel
          title="Panel 5 · Rendered Conversation"
          subtitle="ChatMessage renderizado por reglas determinísticas del mock renderer"
          value={state.renderedMessage}
        />
      </div>
    </section>
  )
}

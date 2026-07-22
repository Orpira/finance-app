import { useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  createAIExecutionInspectorViewModel,
} from '../../intelligence/execution-inspector'
import { getRegisteredAIConversationExecutionTrace } from '../../application/ai-conversation'

type InspectorPageState =
  | { readonly status: 'idle'; readonly trace: null; readonly error: null }
  | { readonly status: 'loading'; readonly trace: null; readonly error: null }
  | { readonly status: 'ready'; readonly trace: NonNullable<ReturnType<typeof getRegisteredAIConversationExecutionTrace>>; readonly error: null }
  | { readonly status: 'error'; readonly trace: null; readonly error: string }

function statusClasses(status: string): string {
  switch (status) {
    case 'SUCCESS':
      return 'bg-emerald-100 text-emerald-800'
    case 'FAILED':
      return 'bg-rose-100 text-rose-800'
    case 'SKIPPED':
      return 'bg-slate-200 text-slate-700'
    default:
      return 'bg-amber-100 text-amber-800'
  }
}

export default function AIExecutionInspectorPage() {
  const [state, setState] = useState<InspectorPageState>({
    status: 'idle',
    trace: null,
    error: null,
  })

  const viewModel = createAIExecutionInspectorViewModel(state.trace)

  async function handleGenerate() {
    setState({ status: 'loading', trace: null, error: null })
    try {
      const trace = getRegisteredAIConversationExecutionTrace()
      if (trace === null) {
        setState({ status: 'error', trace: null, error: 'Todavía no hay una traza real. Envía un mensaje en Conversación y vuelve a cargar esta vista.' })
        return
      }

      setState({ status: 'ready', trace, error: null })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo cargar la traza de ejecución.'
      setState({ status: 'error', trace: null, error: message })
    }
  }

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 pb-8">
      <PageHeader
        backLabel="Debug"
        backTo="/debug"
        eyebrow="Herramientas de observabilidad"
        title="AI Execution Inspector"
      >
        <button
          className="inline-flex min-h-10 items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          disabled={state.status === 'loading'}
          onClick={handleGenerate}
          type="button"
        >
            {state.status === 'loading' ? 'Cargando traza...' : 'Actualizar traza'}
        </button>
      </PageHeader>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Vista de solo lectura. El inspector observa el pipeline y exporta snapshots inmutables de cada etapa.
        </p>
      </div>

      {state.status === 'error' ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          {state.error}
        </div>
      ) : null}

      {viewModel ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trace ID</p>
              <p className="mt-2 break-all text-sm text-slate-900">{viewModel.traceId}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</p>
              <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(viewModel.status)}`}>
                {viewModel.status}
              </span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inicio</p>
              <p className="mt-2 text-sm text-slate-900">{viewModel.startedAt}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duración total</p>
              <p className="mt-2 text-sm text-slate-900">{viewModel.totalDurationLabel}</p>
            </div>
          </div>

          <div className="space-y-4">
            {viewModel.stages.map((stage) => (
              <article key={stage.key} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">{stage.label}</h2>
                    <p className="text-sm text-slate-500">
                      Inicio: {stage.startedAt ?? 'Pendiente'}
                      {' · '}
                      Fin: {stage.finishedAt ?? 'Pendiente'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses(stage.status)}`}>
                      {stage.status}
                    </span>
                    <span className="text-sm font-medium text-slate-600">{stage.durationLabel}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {stage.sections.map((section) => (
                    <section key={`${stage.key}-${section.label}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <h3 className="text-sm font-semibold text-slate-800">{section.label}</h3>
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-700">
                        {section.json}
                      </pre>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Envía un mensaje desde la conversación principal y luego actualiza esta vista para inspeccionar la última traza real del pipeline.
        </div>
      )}
    </section>
  )
}

import { useState } from 'react'
import { ArrowRight, Check, KeyRound, RotateCcw, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import {
  resolveAssistantDemoResponse,
  type AssistantDemoResponse,
} from './assistantInteractiveDemoSandbox'
import { CopilotResponseLayout } from './CopilotResponseLayout'

type DemoPhase = 'intro' | 'sandbox' | 'complete'
type DemoAction = 'edit' | 'cancel' | 'confirm'

interface DemoTurn {
  readonly id: string
  readonly user: string
  readonly response: AssistantDemoResponse
  readonly resultMessage: string | null
}

const SUGGESTED_PROMPTS = [
  'Hoy recibí 120 euros.',
  'Hoy recibí 120 euros por un servicio.',
  'Gasté 30 euros.',
  'Gasté 28 euros en gasolina.',
  'Mañana tengo una cita a las 18:30.',
  '¿Cuánto gané este mes?',
  '¿Qué ingresos siguen sin reportarse?',
] as const

function resolveActionMessage(action: DemoAction, fallback: string): string {
  if (action === 'edit') {
    return 'En la versión completa podrás ajustar los campos antes de confirmar.'
  }

  if (action === 'cancel') {
    return 'Acción cancelada en la demostración.'
  }

  return fallback
}

export function AssistantInteractiveDemo() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<DemoPhase>('intro')
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<readonly DemoTurn[]>([])

  function startDemo() {
    setPhase('sandbox')
    setDraft('')
    setTurns([])
  }

  function submitPrompt(prompt: string) {
    const trimmed = prompt.trim()
    if (!trimmed) return

    const response = resolveAssistantDemoResponse(trimmed)
    setTurns((current) => [
      ...current,
      {
        id: `assistant-demo-turn:${current.length + 1}`,
        user: trimmed,
        response,
        resultMessage: response.kind === 'answer' ? response.result : null,
      },
    ])
    setDraft('')
  }

  function handleAction(turnId: string, action: DemoAction) {
    setTurns((current) => current.map((turn) => (
      turn.id === turnId
        ? { ...turn, resultMessage: resolveActionMessage(action, turn.response.result) }
        : turn
    )))
  }

  if (phase === 'complete') {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
        <div className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900 dark:bg-slate-900">
          <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-2xl font-semibold text-slate-950 dark:text-white">
            El Copiloto está listo para ayudarte.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Con una licencia podrás utilizar el Copiloto con tus propios datos financieros, registrar movimientos mediante lenguaje natural, consultar balances, crear citas y recibir explicaciones sobre tu información.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
              to="/settings/license"
            >
              <KeyRound className="size-4" aria-hidden="true" />
              Activar licencia
            </Link>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => navigate('/')}
              type="button"
            >
              Volver
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <div className="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <ShieldCheck className="size-4" aria-hidden="true" />
        Demostración interactiva
      </div>

      {phase === 'intro' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
            Sandbox guiado del Copiloto.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Esta experiencia funciona en local, no usa proveedores externos, no consume IA y no consulta tu información financiera. Puedes escribir frases y recibir respuestas simuladas con datos ficticios.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
              <span
                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                key={prompt}
              >
                {prompt}
              </span>
            ))}
          </div>
          <button
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            onClick={startDemo}
            type="button"
          >
            Ver demostración
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  key={prompt}
                  onClick={() => submitPrompt(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-64 flex-col gap-3">
            {turns.length === 0 ? (
              <article className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Escribe una frase como "Hoy recibí 120 euros." o toca un ejemplo para probar el sandbox guiado.
              </article>
            ) : turns.map((turn) => (
              <div className="flex flex-col gap-3" key={turn.id}>
                <div className="self-end rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-300">Usuario</p>
                  <p className="mt-1">{turn.user}</p>
                </div>

                <article className="max-w-[92%] rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Copiloto</p>
                  <CopilotResponseLayout
                    evidence={turn.response.details.length > 0
                      ? turn.response.details.map((detail) => `${detail.label}: ${detail.value}`)
                      : ['Datos ficticios del sandbox local.']}
                    explanation="La demostración aplica reglas locales sobre datos ficticios y no consulta información personal."
                    recommendedAction={turn.response.kind === 'proposal'
                      ? 'Revisa la propuesta simulada y elige editar, cancelar o confirmar.'
                      : 'Prueba otra consulta sugerida para continuar la demostración.'}
                    response={turn.response.assistant}
                  />

                  {turn.response.kind === 'proposal' && turn.resultMessage === null ? (
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        className="h-9 rounded-md px-3 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        onClick={() => handleAction(turn.id, 'edit')}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="h-9 rounded-md px-3 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                        onClick={() => handleAction(turn.id, 'cancel')}
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
                        onClick={() => handleAction(turn.id, 'confirm')}
                        type="button"
                      >
                        Confirmar
                      </button>
                    </div>
                  ) : null}

                  {turn.resultMessage ? (
                    <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      <Check className="size-4" aria-hidden="true" />
                      {turn.resultMessage}
                    </p>
                  ) : null}
                </article>
              </div>
            ))}
          </div>

          <form
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            onSubmit={(event) => {
              event.preventDefault()
              submitPrompt(draft)
            }}
          >
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="assistant-demo-message-input">
              Mensaje de demostración
              <textarea
                className="min-h-20 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:ring-emerald-900"
                id="assistant-demo-message-input"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribe una frase... por ejemplo: Hoy recibí 120 euros."
                value={draft}
              />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3">
              <button
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={startDemo}
                type="button"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reiniciar
              </button>
              <div className="flex gap-2">
                <button
                  className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  onClick={() => setPhase('complete')}
                  type="button"
                >
                  Finalizar
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={draft.trim().length === 0}
                  type="submit"
                >
                  <Send className="size-4" aria-hidden="true" />
                  Enviar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

export default AssistantInteractiveDemo

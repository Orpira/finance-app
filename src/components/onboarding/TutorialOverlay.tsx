import { ArrowRight } from 'lucide-react'
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { completeOnboarding } from '../../services/onboardingService'
import { TUTORIAL_STEPS } from './tutorialSteps'

interface TutorialOverlayProps {
  onDone: () => void
}

const SPOTLIGHT_PADDING = 8
const TARGET_SEARCH_RETRY_MS = 150
const TARGET_SEARCH_MAX_ATTEMPTS = 12

function findVisibleTarget(keys: readonly string[]): HTMLElement | null {
  for (const key of keys) {
    const candidates = document.querySelectorAll<HTMLElement>(`[data-onboarding-target="${key}"]`)
    for (const candidate of Array.from(candidates)) {
      if (candidate.getClientRects().length > 0) return candidate
    }
  }
  return null
}

export function TutorialOverlay({ onDone }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const step = TUTORIAL_STEPS[stepIndex]

  async function finish() {
    setIsFinishing(true)
    try {
      await completeOnboarding()
      onDone()
    } finally {
      setIsFinishing(false)
    }
  }

  useLayoutEffect(() => {
    if (!step) {
      completeOnboarding().then(onDone)
      return
    }

    let cancelled = false
    let attempts = 0

    function locate() {
      if (cancelled) return
      const target = findVisibleTarget(step.targetKeys)
      if (target) {
        setRect(target.getBoundingClientRect())
        return
      }
      attempts += 1
      if (attempts >= TARGET_SEARCH_MAX_ATTEMPTS) {
        // Ninguno de los targetKeys de este paso existe en la pantalla actual:
        // se omite en vez de bloquear el tutorial.
        setStepIndex((index) => index + 1)
        return
      }
      window.setTimeout(locate, TARGET_SEARCH_RETRY_MS)
    }

    function start() {
      // Un paso nuevo nunca debe mostrar el resaltado del paso anterior mientras
      // busca su propio elemento.
      setRect(null)
      locate()
    }

    start()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  useEffect(() => {
    if (!step) return

    function recompute() {
      const target = findVisibleTarget(step.targetKeys)
      if (target) setRect(target.getBoundingClientRect())
    }

    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [step])

  useEffect(() => {
    panelRef.current?.focus()
  }, [rect])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') void finish()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!step || !rect) return null

  const isLastStep = stepIndex === TUTORIAL_STEPS.length - 1
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const spotlightStyle: CSSProperties = {
    position: 'fixed',
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
    borderRadius: 12,
    boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.7)',
    transition: reducedMotion
      ? 'none'
      : 'top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease',
  }

  const preferredTooltipTop = rect.bottom + SPOTLIGHT_PADDING + 12
  const tooltipTop =
    preferredTooltipTop < window.innerHeight - 180
      ? preferredTooltipTop
      : Math.max(16, rect.top - SPOTLIGHT_PADDING - 12 - 180)

  function advance() {
    if (isLastStep) {
      void finish()
      return
    }
    setStepIndex((index) => index + 1)
  }

  return (
    <div className="fixed inset-0 z-100" role="presentation">
      <div
        className="pointer-events-none fixed inset-0 border-2 border-emerald-400"
        style={spotlightStyle}
      />
      <div
        aria-modal="true"
        className="fixed inset-0"
        onClick={(event) => {
          if (event.target === event.currentTarget) void finish()
        }}
        role="dialog"
      >
        <div
          className="fixed left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900"
          ref={panelRef}
          style={{
            top: tooltipTop,
            paddingBottom: 'max(env(safe-area-inset-bottom), 0px)',
          }}
          tabIndex={-1}
        >
          <p
            aria-live="polite"
            className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
          >
            Paso {stepIndex + 1} de {TUTORIAL_STEPS.length}
          </p>
          <h2 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
            {step.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              className="h-10 rounded-md px-3 text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
              disabled={isFinishing}
              onClick={() => void finish()}
              type="button"
            >
              Omitir
            </button>
            <button
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
              disabled={isFinishing}
              onClick={advance}
              type="button"
            >
              {isLastStep ? 'Finalizar' : 'Siguiente'}
              {!isLastStep && <ArrowRight className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

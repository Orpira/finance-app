import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

interface DialogFrameProps {
  title: string
  message?: string
  icon: ReactNode
  iconClassName: string
  open: boolean
  initialFocusRef: RefObject<HTMLElement | null>
  onCancel: () => void
  children?: ReactNode
  actions: ReactNode
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function DialogFrame({
  title,
  message,
  icon,
  iconClassName,
  open,
  initialFocusRef,
  onCancel,
  children,
  actions,
}: DialogFrameProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    onCancelRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const animationFrame = window.requestAnimationFrame(() => {
      setEntered(true)
      initialFocusRef.current?.focus()
    })

    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancelRef.current()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) {
        return
      }

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [initialFocusRef])

  const isVisible = open && entered

  return (
    <div
      className={[
        'fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-950/55 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-6 backdrop-blur-sm transition-opacity duration-200 sm:items-center sm:p-6',
        isVisible ? 'opacity-100' : 'opacity-0',
      ].join(' ')}
    >
      <div
        aria-describedby={message ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={[
          'w-full max-w-md transform rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/25 transition-all duration-200 ease-out dark:border-slate-700 dark:bg-slate-900 sm:p-6',
          isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0',
        ].join(' ')}
        ref={panelRef}
        role="dialog"
      >
        <div className="flex items-start gap-3.5">
          <span className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
            {icon}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-lg font-semibold leading-6 text-slate-950 dark:text-white" id={titleId}>
              {title}
            </h2>
            {message && (
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300" id={descriptionId}>
                {message}
              </p>
            )}
          </div>
        </div>

        {children && <div className="mt-5">{children}</div>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {actions}
        </div>
      </div>
    </div>
  )
}

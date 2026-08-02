interface CopilotResponseLayoutProps {
  readonly response: string
  readonly explanation: string
  readonly evidence: readonly string[]
  readonly recommendedAction: string
}

const sections = [
  { key: 'response', label: 'Respuesta' },
  { key: 'explanation', label: 'Explicación' },
  { key: 'evidence', label: 'Evidencias' },
  { key: 'recommendedAction', label: 'Acción recomendada' },
] as const

export function CopilotResponseLayout(props: CopilotResponseLayoutProps) {
  return (
    <div className="mt-2 divide-y divide-slate-200 dark:divide-slate-700">
      {sections.map((section, index) => (
        <section className={index === 0 ? 'pb-2' : index === sections.length - 1 ? 'pt-2' : 'py-2'} key={section.key}>
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">{section.label}</h3>
          {section.key === 'evidence' ? (
            <ul className="mt-1 space-y-1 text-sm leading-6">
              {props.evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{props[section.key]}</p>
          )}
        </section>
      ))}
    </div>
  )
}

export default CopilotResponseLayout

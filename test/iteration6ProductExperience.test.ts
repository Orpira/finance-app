import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'
import { HOME_SECTION_ORDER } from '../src/pages/Home/homeSectionOrder'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('iteration 6 product experience', () => {
  it('uses Copiloto as the single user-facing concept', () => {
    const sources = [
      '../src/app/AppLayout.tsx',
      '../src/pages/Conversation/ConversationPage.tsx',
      '../src/pages/Conversation/MessageBubble.tsx',
      '../src/pages/Conversation/MessageComposer.tsx',
      '../src/pages/Conversation/AssistantInteractiveDemo.tsx',
      '../src/components/onboarding/tutorialSteps.ts',
      '../src/pages/Home/HomePage.tsx',
    ].map(read).join('\n')
    expect(sources).not.toContain("label: 'Asistente'")
    expect(sources).not.toContain('title="Asistente"')
    expect(sources).not.toContain('Asistente IA')
    expect(sources).not.toContain('Asistente Inteligente')
    expect(sources).toContain('Copiloto')
  })

  it('renders the four stable sections for Copilot responses', () => {
    const source = read('../src/pages/Conversation/CopilotResponseLayout.tsx')
    expect(source).toContain('Respuesta')
    expect(source).toContain('Explicación')
    expect(source).toContain('Evidencias')
    expect(source).toContain('Acción recomendada')
  })

  it('keeps Home sections in the agreed control-center order', () => {
    const labels = ['Prioridad principal', 'Resumen financiero', 'Salud financiera', 'Objetivos', 'Agenda', 'Actividad reciente', 'Acciones sugeridas']
    expect(HOME_SECTION_ORDER).toEqual(labels)
  })

  it('exposes a keyboard-accessible local diagnostics screen', () => {
    const page = read('../src/pages/Settings/SettingsDiagnosticsPage.tsx')
    expect(page).toContain('Diagnóstico local')
    expect(page).toContain('aria-live')
    expect(page).toContain('Exportar diagnóstico')
  })

  it('provides global visible focus and reduced-motion behavior', () => {
    const styles = read('../src/index.css')
    expect(styles).toContain(':focus-visible')
    expect(styles).toContain('prefers-reduced-motion: reduce')
  })
})

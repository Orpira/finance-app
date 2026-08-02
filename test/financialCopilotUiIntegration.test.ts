import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

describe('financial copilot UI integration', () => {
  it('Inicio usa el motor común para prioridades, salud, insights y resumen', () => {
    const source = readSource('../src/pages/Home/HomePage.tsx')

    expect(source).toContain('buildFinancialCopilotSnapshot')
    expect(source).toContain('buildFinancialCopilot')
    expect(source).toContain('Prioridades de hoy')
    expect(source).toContain('Salud financiera')
    expect(source).toContain('Resumen inteligente')
    expect(source).not.toContain('function buildSmartInsights')
  })

  it('el Asistente compone el manejador de consultas locales por sesión', () => {
    const source = readSource('../src/pages/Conversation/conversationComposition.ts')

    expect(source).toContain('createLocalFinancialCopilotQueryHandler')
    expect(source).toContain('answerLocalQuery')
  })
})

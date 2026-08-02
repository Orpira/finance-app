import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('pre-release Sprint A product language', () => {
  it('uses clear Spanish labels throughout the financial analysis screen', () => {
    const sources = [
      '../src/pages/Insights/InsightDashboardPage.tsx',
      '../src/pages/Insights/insightDashboardMapper.ts',
      '../src/pages/Insights/insightDashboardController.ts',
      '../src/pages/Insights/insightDashboardUseCase.ts',
      '../src/pages/Insights/insightDashboardValidator.ts',
      '../src/pages/Insights/InsightList.tsx',
      '../src/pages/Insights/InsightStateViews.tsx',
      '../src/pages/Insights/InsightSummary.tsx',
      '../src/pages/More/MorePage.tsx',
    ].map(read).join('\n')

    for (const legacyText of [
      'Insight Engine',
      'Dashboard de insights',
      'Lista de insights',
      'Insights proyectados',
      'Financial Action Plan',
      'Categoria:',
      'Titulo:',
      'Descripcion:',
      'Recomendacion:',
      'Suscripcion',
      'Critica',
      'Ultima actualizacion',
      'Aun no',
      'Codigo de error',
      'read-only',
      'Visualiza insights proyectados desde el motor con estado seguro.',
      'La carga del dashboard excedio el tiempo de espera local.',
      'No fue posible leer los datos financieros del dashboard.',
      'No fue posible ejecutar el motor de insights financieros.',
      'No fue posible generar el plan de accion; se muestran insights parciales.',
      'El snapshot del dashboard no cumple el contrato esperado.',
      'El ViewModel del dashboard no cumple el contrato esperado.',
      'La carga del dashboard fallo por un error inesperado.',
    ]) {
      expect(sources).not.toContain(legacyText)
    }

    expect(sources).toContain('Análisis financiero')
    expect(sources).toContain('Plan de acción financiera')
    expect(sources).toContain('Última actualización')
  })

  it('spells the visible period label consistently in Copilot and reports', () => {
    const sources = [
      '../src/pages/Conversation/AssistantProposalCard.tsx',
      '../src/pages/Conversation/ConversationPage.tsx',
      '../src/pages/Conversation/conversationController.ts',
      '../src/pages/Reports/ReportsPage.tsx',
      '../src/pages/Movements/MovementsPage.tsx',
    ].map(read).join('\n')

    expect(sources).not.toContain("period: 'Periodo'")
    expect(sources).not.toContain('aria-label="Periodo"')
    expect(sources).not.toContain('Periodo:')
    expect(sources).toContain('Período')
  })
})

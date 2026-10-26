import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SeasonGoalCard } from '../src/components/seasons/SeasonGoalCard'
import { getSeasonGoalProgress } from '../src/services/earningPeriodService'
import type { SeasonFinancialResult } from '../src/utils/financeStats'

function renderGoal(result: SeasonFinancialResult) {
  const progress = getSeasonGoalProgress({ economicGoal: 5_000 }, result)
  if (!progress) throw new Error('La fixture debe producir progreso de Meta.')

  return renderToStaticMarkup(
    <SeasonGoalCard currency="EUR" progress={progress} />,
  )
}

describe('SeasonGoalCard', () => {
  it('explica un resultado parcial mediante ingresos netos, egresos y faltante', () => {
    const markup = renderGoal({ netIncome: 4_200, expenses: 900, result: 3_300 })

    expect(markup).toContain('Resultado')
    expect(markup).toContain('Ingresos netos')
    expect(markup).toContain('Egresos')
    expect(markup).toContain('66 %')
    expect(markup).toContain('Faltan')
  })

  it('marca claramente la Meta exacta', () => {
    const markup = renderGoal({ netIncome: 5_500, expenses: 500, result: 5_000 })

    expect(markup).toContain('Meta alcanzada')
    expect(markup).not.toContain('Meta superada en')
    expect(markup).toContain('100 %')
    expect(markup).toContain('aria-valuenow="100"')
  })

  it('presenta los egresos cero sin signo negativo', () => {
    const markup = renderGoal({ netIncome: 5_000, expenses: 0, result: 5_000 })

    expect(markup).not.toContain('-0,00')
  })

  it('muestra el porcentaje superior a cien y limita únicamente la barra', () => {
    const markup = renderGoal({ netIncome: 6_000, expenses: 250, result: 5_750 })

    expect(markup).toContain('115 %')
    expect(markup).toContain('Meta superada en')
    expect(markup).toContain('aria-valuenow="100"')
    expect(markup).toContain('width:100%')
  })

  it('conserva el resultado negativo, amplía el faltante y deja la barra en cero', () => {
    const markup = renderGoal({ netIncome: 500, expenses: 800, result: -300 })

    expect(markup).toContain('-6 %')
    expect(markup).toContain('aria-label="-6 % de progreso de la meta"')
    expect(markup).toContain('Faltan')
    expect(markup).toContain('aria-valuenow="0"')
    expect(markup).toContain('width:0%')
  })

  it('muestra la fecha prevista como fecha civil, sin desplazarla por zona horaria', () => {
    const progress = getSeasonGoalProgress({ economicGoal: 5_000 }, { netIncome: 0, expenses: 0, result: 0 })!
    const markup = renderToStaticMarkup(
      <SeasonGoalCard currency="EUR" plannedEndDate="2026-12-21T23:59:59.999Z" progress={progress} />,
    )
    expect(markup).toContain('21 dic 2026')
  })

  it('compara con el objetivo original usando el mismo resultado (PB-GEO-002)', () => {
    const result = { netIncome: 2_000, expenses: 0, result: 2_000 }
    const current = getSeasonGoalProgress({ economicGoal: 5_000 }, result)!
    const original = getSeasonGoalProgress({ economicGoal: 4_000 }, result)!
    const markup = renderToStaticMarkup(
      <SeasonGoalCard currency="EUR" originalProgress={original} originalSource="season_creation" progress={current} />,
    )
    expect(markup).toContain('Objetivo original')
    expect(markup).toContain('50 % de progreso')
    expect(markup).toContain('40 %')

    const migrated = renderToStaticMarkup(
      <SeasonGoalCard currency="EUR" originalProgress={original} originalSource="migration_baseline" progress={current} />,
    )
    expect(migrated).toContain('Objetivo conocido al actualizar la app')

    const unchanged = renderToStaticMarkup(
      <SeasonGoalCard currency="EUR" originalProgress={current} progress={current} />,
    )
    expect(unchanged).not.toContain('Objetivo original')
  })
})

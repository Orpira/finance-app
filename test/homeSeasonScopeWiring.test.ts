import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Complementa test/homeSeasonScope.test.ts: aquellos tests prueban que la
// fuente canónica (listSeasonRecords/getSeasonStatistics) acumula
// correctamente por temporada activa. Estos prueban que HomePage.tsx
// efectivamente la reutiliza para las tarjetas de Resumen financiero (no
// duplica su propio filtro de mes) — HOME-SEASON-008 (consistencia con
// Meta de temporada) y HOME-SEASON-010 (Personal no depende de temporada).

function readHomePageSource() {
  return readFileSync(
    new URL('../src/pages/Home/HomePage.tsx', import.meta.url),
    'utf8',
  )
}

describe('HomePage.tsx — scope de temporada activa (regresión de código fuente)', () => {
  const source = readHomePageSource()

  it('HOME-SEASON-008: importa y usa listSeasonRecords, la misma fuente que getSeasonStatistics (Meta de temporada), en vez de reimplementar su propio filtro', () => {
    expect(source).toContain('listSeasonRecords')
    // Las tarjetas de Resumen (Ganancia/Ingresos/Egresos/Adicionales) deben
    // derivarse de seasonIncomes/seasonExpenses en modo profesional, no de
    // currentIncomes/currentExpenses (esos siguen siendo mensuales, para el
    // snapshot 'home.current-month' y el Copiloto).
    expect(source).toContain(
      'const summaryIncomes = isBasicUser ? currentIncomes : seasonIncomes',
    )
    expect(source).toContain(
      'const summaryExpenses = isBasicUser ? currentExpenses : seasonExpenses',
    )
    expect(source).toContain(
      'const comparisonIncomes = isBasicUser ? previousIncomes : previousSeasonIncomes',
    )
    expect(source).toContain(
      'const comparisonExpenses = isBasicUser ? previousExpenses : previousSeasonExpenses',
    )
  })

  it('HOME-SEASON-010: el modo Personal (Basic) nunca usa seasonIncomes/seasonExpenses — conserva su scope mensual existente', () => {
    // seasonRecords solo se resuelve cuando !isBasicUser: en modo Personal
    // seasonIncomes/seasonExpenses quedan siempre en [] y summaryIncomes/
    // summaryExpenses caen al branch mensual (currentIncomes/currentExpenses).
    expect(source).toContain('!isBasicUser && period?.id ? listSeasonRecords(period.id)')
  })

  it('el header de Inicio distingue el texto según el modo, en vez de anunciar siempre "mes actual"', () => {
    expect(source).toContain('Resumen financiero de la temporada activa')
    expect(source).toContain('Resumen financiero del mes actual')
  })

  it('las tarjetas comparan contra la temporada anterior (no el mes anterior) en modo profesional', () => {
    expect(source).toContain("scope={isBasicUser ? 'month' : 'season'}")
    expect(source).toContain('getPreviousEarningPeriod')
    expect(source).toContain("scope === 'month' ? 'mes anterior' : 'temporada anterior'")
  })
})

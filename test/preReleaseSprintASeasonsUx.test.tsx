import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import {
  ClosedSeasonCard,
  SeasonHistoryPanel,
} from '../src/pages/Seasons/SeasonsPage'
import { getSeasonOverviewState } from '../src/utils/seasonOverview'
import type { SeasonStatistics } from '../src/services/earningPeriodService'
import type { EarningPeriod } from '../src/types/earningPeriod'

const emptyStats: SeasonStatistics = {
  grossIncome: 0,
  realGain: 0,
  expenses: 0,
  adjustments: 0,
  netGain: 0,
  serviceCount: 0,
  appointmentCount: 0,
  completedAppointmentCount: 0,
  servicesByDay: [],
  expensesByCategory: [],
}

function season(
  id: number,
  status: EarningPeriod['status'],
  endDate?: string,
): EarningPeriod {
  return {
    id,
    name: `Temporada ${id}`,
    percentage: 100,
    startDate: `2026-0${id}-01T00:00:00.000Z`,
    endDate,
    status,
    countryCode: 'ES',
    city: 'Madrid',
    baseCurrency: 'EUR',
    createdAt: `2026-0${id}-01T00:00:00.000Z`,
  }
}

const closed = [
  season(1, 'closed', '2026-03-01T23:59:59.999Z'),
  season(2, 'closed', '2026-05-01T23:59:59.999Z'),
  season(3, 'closed', '2026-04-01T23:59:59.999Z'),
]

describe('Sprint A final - estados de Temporadas (SA-009 a SA-011)', () => {
  it('distingue activa, solo historial y primera temporada', () => {
    expect(getSeasonOverviewState(season(4, 'active'), closed).kind).toBe('active')
    expect(getSeasonOverviewState(null, closed).kind).toBe('history')
    expect(getSeasonOverviewState(null, []).kind).toBe('empty')
  })

  it('muestra únicamente las dos cerradas más recientes por fecha de cierre', () => {
    const state = getSeasonOverviewState(null, closed)

    expect(state.kind).toBe('history')
    if (state.kind !== 'history') return

    expect(state.recent.map((period) => period.id)).toEqual([2, 3])
    expect(state.remaining.map((period) => period.id)).toEqual([1])
  })

  it('ofrece una sola acción principal y acceso al historial restante', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonHistoryPanel
          closed={closed.map((period) => ({ period, stats: emptyStats }))}
          onCreate={() => undefined}
        />
      </MemoryRouter>,
    )

    expect(markup.match(/Nueva temporada/g)).toHaveLength(1)
    expect(markup).toContain('Temporadas recientes')
    expect(markup).toContain('Ver todas las temporadas')
  })

  it('mantiene el historial accesible sin otra acción principal cuando hay una activa', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <SeasonHistoryPanel
          closed={closed.map((period) => ({ period, stats: emptyStats }))}
          onCreate={() => undefined}
          showCreateAction={false}
        />
      </MemoryRouter>,
    )

    expect(markup).toContain('Historial de temporadas')
    expect(markup).toContain('Temporada 2')
    expect(markup).not.toContain('Nueva temporada')
  })

  it('desempata cierres del mismo día mediante el instante real de cierre', () => {
    const sameDay = [
      { ...season(1, 'closed', '2026-05-01T23:59:59.999Z'), closedAt: '2026-05-01T09:00:00.000Z' },
      { ...season(2, 'closed', '2026-05-01T23:59:59.999Z'), closedAt: '2026-05-01T18:00:00.000Z' },
      { ...season(3, 'closed', '2026-05-01T23:59:59.999Z'), closedAt: '2026-05-01T14:00:00.000Z' },
    ]
    const state = getSeasonOverviewState(null, sameDay)

    expect(state.kind).toBe('history')
    if (state.kind !== 'history') return

    expect(state.recent.map((period) => period.id)).toEqual([2, 3])
    expect(state.remaining.map((period) => period.id)).toEqual([1])
  })

  it('presenta cada cerrada como historial atenuado y de solo lectura', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ClosedSeasonCard period={closed[0]} stats={emptyStats} />
      </MemoryRouter>,
    )

    expect(markup).toContain('Cerrada')
    expect(markup).toContain('Historial de temporada cerrada')
    expect(markup).toContain('Ver detalle')
    expect(markup).toContain('bg-slate-50')
    expect(markup).not.toContain('Finalizar temporada')
    expect(markup).not.toContain('Editar temporada')
  })
})
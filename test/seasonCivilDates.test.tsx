import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'

import { ClosedSeasonCard } from '../src/pages/Seasons/SeasonsPage'
import type { SeasonStatistics } from '../src/services/earningPeriodService'
import type { EarningPeriod } from '../src/types/earningPeriod'
import type { SeasonStay } from '../src/types/seasonStay'

function renderMarkup(element: ReactElement) {
  return renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>)
}

const stats: SeasonStatistics = {
  grossIncome: 0, realGain: 0, expenses: 0, adjustments: 0, netGain: 0,
  serviceCount: 0, appointmentCount: 0, completedAppointmentCount: 0, servicesByDay: [], expensesByCategory: [],
}

// Inicio, cierre y fin previsto se guardan como fecha civil con hora UTC
// sintética. Con zona horaria de España, 23:59:59.999Z es ya el día
// siguiente: la UI debe mostrar la fecha civil, no la convertida.
const period: EarningPeriod = {
  id: 1, name: 'Otoño', percentage: 50, status: 'closed', countryCode: 'ES', baseCurrency: 'EUR',
  startDate: '2026-10-01T00:00:00.000Z', endDate: '2026-12-21T23:59:59.999Z', createdAt: '2026-10-01T00:00:00.000Z',
}

function stay(overrides: Partial<SeasonStay>): SeasonStay {
  return {
    id: 1, earningPeriodId: 1, position: 0, city: 'Madrid', cityNormalized: 'madrid', countryCode: 'ES',
    status: 'completed', actualStartAt: '2026-10-01T08:00:00.000Z', actualEndAt: '2026-10-10T08:00:00.000Z',
    locationSource: 'manual', createdAt: '', updatedAt: '', ...overrides,
  }
}

describe('fechas civiles y ubicación de temporadas (PB-GEO-002)', () => {
  it('ClosedSeasonCard no desplaza inicio ni cierre por zona horaria', () => {
    const markup = renderMarkup(<ClosedSeasonCard period={period} stats={stats} />)
    expect(markup).toContain('1 oct 2026')
    expect(markup).toContain('21 dic 2026')
    expect(markup).not.toContain('22 dic 2026')
  })

  it('con itinerario muestra las ciudades realizadas, no la ciudad legacy', () => {
    const markup = renderMarkup(
      <ClosedSeasonCard
        period={{ ...period, city: 'Madrid' }}
        stats={stats}
        stays={[
          stay({ id: 1 }),
          stay({ id: 2, city: 'Toledo', cityNormalized: 'toledo' }),
          stay({ id: 3 }),
          stay({ id: 4, city: 'Sevilla', cityNormalized: 'sevilla', status: 'cancelled', actualStartAt: undefined, actualEndAt: undefined }),
        ]}
      />,
    )
    expect(markup).toContain('Ciudades: Madrid, Toledo')
    expect(markup).not.toContain('Sevilla')
  })

  it('sin estancias rotula la ciudad antigua como histórica', () => {
    const markup = renderMarkup(<ClosedSeasonCard period={{ ...period, city: 'Bilbao' }} stats={stats} stays={[]} />)
    expect(markup).toContain('Ciudad histórica: Bilbao')
  })
})

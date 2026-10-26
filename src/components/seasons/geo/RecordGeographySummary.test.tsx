// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const getRecordGeographyReadModel = vi.fn()
vi.mock('../../../services/recordGeographyService', () => ({
  getRecordGeographyReadModel: (...args: unknown[]) => getRecordGeographyReadModel(...args),
}))

const { RecordGeographySummary } = await import('./RecordGeographySummary')

const toledo = { kind: 'city' as const, label: 'Toledo', city: 'Toledo', countryCode: 'ES' as const, source: 'manual' as const }

describe('RecordGeographySummary', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('un registro legacy sin estancia se presenta como estado normal', async () => {
    getRecordGeographyReadModel.mockResolvedValue({ historicalLocation: { city: 'Madrid', country: 'ES' }, hasOrphanedStayReference: false })
    render(<RecordGeographySummary record={{ earningPeriodId: 7, city: 'Madrid', country: 'ES' }} />)
    expect(await screen.findByText('Sin estancia asignada')).toBeTruthy()
    expect(screen.getByText('Sin destino puntual')).toBeTruthy()
    expect(screen.getByText('Madrid, España')).toBeTruthy()
  })

  it('separa la estancia del destino puntual', async () => {
    getRecordGeographyReadModel.mockResolvedValue({
      seasonStay: {
        id: 3, earningPeriodId: 7, position: 0, city: 'Madrid', cityNormalized: 'madrid', countryCode: 'ES',
        status: 'completed', actualStartAt: '2026-11-01T08:00:00.000Z', actualEndAt: '2026-11-05T08:00:00.000Z',
        locationSource: 'manual', createdAt: '', updatedAt: '',
      },
      travelDestination: toledo,
      historicalLocation: { city: 'Madrid', country: 'ES' },
      hasOrphanedStayReference: false,
    })
    render(<RecordGeographySummary record={{ earningPeriodId: 7, seasonStayId: 3, travelDestination: toledo, city: 'Madrid', country: 'ES' }} />)
    expect(await screen.findByText(/Finalizada/)).toBeTruthy()
    expect(screen.getByText('Toledo, España')).toBeTruthy()
  })

  it('avisa sin alarmar cuando la estancia referida ya no existe', async () => {
    getRecordGeographyReadModel.mockResolvedValue({ historicalLocation: {}, hasOrphanedStayReference: true })
    render(<RecordGeographySummary record={{ seasonStayId: 99 }} />)
    expect(await screen.findByText(/ya no está disponible/)).toBeTruthy()
  })

  it('la variante compacta no muestra nada si no hay estancia ni destino', async () => {
    getRecordGeographyReadModel.mockResolvedValue({ historicalLocation: {}, hasOrphanedStayReference: false })
    const { container } = render(<RecordGeographySummary compact record={{}} />)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(container.textContent).toBe('')
  })
})

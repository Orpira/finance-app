import { describe, expect, it, vi } from 'vitest'

const getActiveEarningPeriod = vi.fn()

vi.mock('../../services/earningPeriodService', () => ({
  getActiveEarningPeriod: (...args: unknown[]) => getActiveEarningPeriod(...args),
}))

const { buildSeasonEndingCandidate } = await import('./seasonEndingRule')

const NOW = new Date('2026-08-30T12:00:00.000Z')

describe('buildSeasonEndingCandidate', () => {
  it('no genera candidato si no hay temporada activa', async () => {
    getActiveEarningPeriod.mockResolvedValue(undefined)
    expect(await buildSeasonEndingCandidate(NOW)).toBeNull()
  })

  it('no genera candidato si la temporada no tiene fecha de fin planificada', async () => {
    getActiveEarningPeriod.mockResolvedValue({ id: 1, status: 'active', name: 'Verano' })
    expect(await buildSeasonEndingCandidate(NOW)).toBeNull()
  })

  it('no genera candidato si faltan más de 7 días', async () => {
    getActiveEarningPeriod.mockResolvedValue({
      id: 1,
      status: 'active',
      name: 'Verano',
      plannedEndDate: '2026-09-15',
    })
    expect(await buildSeasonEndingCandidate(NOW)).toBeNull()
  })

  it('genera un candidato P1 cuando faltan <= 7 días', async () => {
    getActiveEarningPeriod.mockResolvedValue({
      id: 1,
      status: 'active',
      name: 'Verano',
      plannedEndDate: '2026-09-04',
    })

    const candidate = await buildSeasonEndingCandidate(NOW)
    expect(candidate?.priority).toBe('P1')
    expect(candidate?.dedupKey).toBe('season-ending:1')
    expect(candidate?.action?.destination).toBe('/temporadas/1')
  })

  it('revalidate() devuelve false si la temporada ya no está activa', async () => {
    getActiveEarningPeriod.mockResolvedValueOnce({
      id: 1,
      status: 'active',
      name: 'Verano',
      plannedEndDate: '2026-09-04',
    })
    const candidate = await buildSeasonEndingCandidate(NOW)

    getActiveEarningPeriod.mockResolvedValueOnce({
      id: 1,
      status: 'closed',
      name: 'Verano',
      plannedEndDate: '2026-09-04',
    })
    expect(await candidate?.revalidate?.()).toBe(false)
  })
})

import { describe, expect, it, vi } from 'vitest'

const getActiveEarningPeriod = vi.fn()
const getSeasonStatistics = vi.fn()

vi.mock('../../services/earningPeriodService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/earningPeriodService')>()
  return {
    ...actual,
    getActiveEarningPeriod: (...args: unknown[]) => getActiveEarningPeriod(...args),
    getSeasonStatistics: (...args: unknown[]) => getSeasonStatistics(...args),
  }
})

const { buildSeasonGoalRiskCandidate } = await import('./seasonGoalRiskRule')

const NOW = new Date('2026-08-30T12:00:00.000Z')

function activePeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: 'active',
    name: 'Verano',
    startDate: '2026-08-01',
    plannedEndDate: '2026-08-31',
    economicGoal: 1000,
    ...overrides,
  }
}

describe('buildSeasonGoalRiskCandidate', () => {
  it('no genera candidato sin temporada activa', async () => {
    getActiveEarningPeriod.mockResolvedValue(undefined)
    expect(await buildSeasonGoalRiskCandidate(NOW)).toBeNull()
  })

  it('no genera candidato si la meta ya está alcanzada', async () => {
    getActiveEarningPeriod.mockResolvedValue(activePeriod())
    getSeasonStatistics.mockResolvedValue({ realGain: 1000, expenses: 0, netGain: 1000 })
    expect(await buildSeasonGoalRiskCandidate(NOW)).toBeNull()
  })

  it('no genera candidato si el ritmo va acorde al tiempo transcurrido', async () => {
    // 29/30 días transcurridos (~97%), resultado en 90% de la meta → sin riesgo material.
    getActiveEarningPeriod.mockResolvedValue(activePeriod())
    getSeasonStatistics.mockResolvedValue({ realGain: 900, expenses: 0, netGain: 900 })
    expect(await buildSeasonGoalRiskCandidate(NOW)).toBeNull()
  })

  it('genera un candidato P2 cuando el resultado va muy por debajo del tiempo transcurrido', async () => {
    getActiveEarningPeriod.mockResolvedValue(activePeriod())
    getSeasonStatistics.mockResolvedValue({ realGain: 200, expenses: 0, netGain: 200 })

    const candidate = await buildSeasonGoalRiskCandidate(NOW)
    expect(candidate?.priority).toBe('P2')
    expect(candidate?.dedupKey).toBe('season-goal-risk:1')
  })

  it('ADR-034 §14 — revalidate() detecta que un ingreso nuevo resolvió el riesgo', async () => {
    getActiveEarningPeriod.mockResolvedValue(activePeriod())
    getSeasonStatistics.mockResolvedValue({ realGain: 200, expenses: 0, netGain: 200 })
    const candidate = await buildSeasonGoalRiskCandidate(NOW)
    expect(candidate).not.toBeNull()

    getSeasonStatistics.mockResolvedValue({ realGain: 950, expenses: 0, netGain: 950 })
    expect(await candidate?.revalidate?.()).toBe(false)
  })
})

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

const { buildSeasonGoalAchievedCandidate } = await import('./seasonGoalAchievedRule')

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

describe('buildSeasonGoalAchievedCandidate', () => {
  it('no genera candidato si la meta no está alcanzada', async () => {
    getActiveEarningPeriod.mockResolvedValue(activePeriod())
    getSeasonStatistics.mockResolvedValue({ realGain: 500, expenses: 0, netGain: 500 })
    expect(await buildSeasonGoalAchievedCandidate()).toBeNull()
  })

  it('genera un candidato P2 cuando la meta se alcanza o supera', async () => {
    getActiveEarningPeriod.mockResolvedValue(activePeriod())
    getSeasonStatistics.mockResolvedValue({ realGain: 1200, expenses: 0, netGain: 1200 })

    const candidate = await buildSeasonGoalAchievedCandidate()
    expect(candidate?.priority).toBe('P2')
    expect(candidate?.dedupKey).toBe('season-goal-achieved:1')
  })
})

import { describe, expect, it } from 'vitest'

import { getSeasonGoalProgress } from '../src/services/earningPeriodService'

describe('getSeasonGoalProgress', () => {
  it('no crea progreso cuando la temporada no tiene meta', () => {
    expect(getSeasonGoalProgress({}, 500)).toBeNull()
  })

  it('calcula alcanzado, restante y porcentaje sin modificar la meta', () => {
    expect(getSeasonGoalProgress({ economicGoal: 8_500 }, 6_200)).toEqual({
      achieved: 6_200,
      completed: false,
      goal: 8_500,
      percentage: (6_200 / 8_500) * 100,
      remaining: 2_300,
    })
  })

  it('marca el objetivo como conseguido al alcanzar exactamente la meta', () => {
    expect(getSeasonGoalProgress({ economicGoal: 1_000 }, 1_000)).toMatchObject({
      completed: true,
      percentage: 100,
      remaining: 0,
    })
  })

  it('permite superar el cien por ciento y nunca produce restante negativo', () => {
    expect(getSeasonGoalProgress({ economicGoal: 1_000 }, 1_250)).toMatchObject({
      achieved: 1_250,
      completed: true,
      percentage: 125,
      remaining: 0,
    })
  })
})
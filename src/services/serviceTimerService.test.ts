import { describe, expect, it, vi } from 'vitest'

vi.mock('../database/db', () => ({
  db: {
    communicationChannels: { get: vi.fn() },
  },
}))

const { buildInitialServiceTimerState } = await import('./serviceTimerService')

describe('buildInitialServiceTimerState — regresión PB-IS-0007', () => {
  it('nunca inicia el cronómetro para "Jornada por horas" (duration=0, durationLabel ausente)', () => {
    const state = buildInitialServiceTimerState({
      type: 'ingreso',
      duration: 0,
      durationLabel: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      timerStartedAt: undefined,
    })

    expect(state).toEqual({})
  })

  it('sigue iniciando el cronómetro para "Servicio por tiempo" con duración > 0 (regresión de comportamiento existente)', () => {
    const state = buildInitialServiceTimerState({
      type: 'ingreso',
      duration: 60,
      durationLabel: '60',
      createdAt: '2026-01-01T00:00:00.000Z',
      timerStartedAt: undefined,
    })

    expect(state.timerStatus).toBe('running')
    expect(typeof state.timerStartedAt).toBe('string')
    expect(typeof state.timerEndsAt).toBe('string')
  })
})

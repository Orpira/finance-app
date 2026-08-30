import { describe, expect, it, vi } from 'vitest'

const listAppointments = vi.fn()

vi.mock('../../services/appointmentService', () => ({
  listAppointments: (...args: unknown[]) => listAppointments(...args),
}))

const { buildAgendaPendingActionCandidate } = await import('./agendaPendingActionRule')

const NOW = new Date('2026-08-30T12:00:00.000Z')

describe('buildAgendaPendingActionCandidate', () => {
  it('no genera candidato sin citas vencidas', async () => {
    listAppointments.mockResolvedValue([])
    expect(await buildAgendaPendingActionCandidate(NOW)).toBeNull()
  })

  it('genera un candidato P2 cuando hay citas pasadas sin completar', async () => {
    listAppointments.mockResolvedValue([{ id: 1 }, { id: 2 }])

    const candidate = await buildAgendaPendingActionCandidate(NOW)
    expect(candidate?.priority).toBe('P2')
    expect(candidate?.message).toContain('2 citas')
    expect(listAppointments).toHaveBeenCalledWith({ to: NOW.toISOString(), completed: false })
  })

  it('cita reprogramada a una hora futura ya no cuenta como pendiente (revalidate)', async () => {
    listAppointments.mockResolvedValueOnce([{ id: 1 }])
    const candidate = await buildAgendaPendingActionCandidate(NOW)
    expect(candidate).not.toBeNull()

    listAppointments.mockResolvedValueOnce([])
    expect(await candidate?.revalidate?.()).toBe(false)
  })
})

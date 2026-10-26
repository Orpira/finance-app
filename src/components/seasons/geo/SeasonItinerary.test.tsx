// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '../../../types/appointment'
import type { EarningPeriod } from '../../../types/earningPeriod'
import type { SeasonStay } from '../../../types/seasonStay'
import { SeasonGeoDomainError } from '../../../utils/seasonGeoValidation'

const service = {
  cancelPlannedSeasonStay: vi.fn(),
  completeSeasonStay: vi.fn(),
  correctSeasonStay: vi.fn(),
  createPlannedSeasonStay: vi.fn(),
  reorderSeasonStays: vi.fn(),
  switchActiveSeasonStay: vi.fn(),
}
vi.mock('../../../services/seasonStayService', () => ({
  cancelPlannedSeasonStay: (...args: unknown[]) => service.cancelPlannedSeasonStay(...args),
  completeSeasonStay: (...args: unknown[]) => service.completeSeasonStay(...args),
  correctSeasonStay: (...args: unknown[]) => service.correctSeasonStay(...args),
  createPlannedSeasonStay: (...args: unknown[]) => service.createPlannedSeasonStay(...args),
  reorderSeasonStays: (...args: unknown[]) => service.reorderSeasonStays(...args),
  switchActiveSeasonStay: (...args: unknown[]) => service.switchActiveSeasonStay(...args),
}))

const { SeasonItinerary } = await import('./SeasonItinerary')

const season: EarningPeriod = {
  id: 7,
  name: 'Otoño',
  percentage: 50,
  startDate: '2026-10-01T00:00:00.000Z',
  status: 'active',
  countryCode: 'ES',
  baseCurrency: 'EUR',
  createdAt: '2026-10-01T00:00:00.000Z',
}

function stay(overrides: Partial<SeasonStay>): SeasonStay {
  return {
    id: 1,
    earningPeriodId: 7,
    position: 0,
    city: 'Madrid',
    cityNormalized: 'madrid',
    countryCode: 'ES',
    status: 'planned',
    locationSource: 'manual',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

const stays = [
  stay({ id: 1, position: 0, status: 'completed', actualStartAt: '2026-10-01T08:00:00.000Z', actualEndAt: '2026-10-05T08:00:00.000Z' }),
  stay({ id: 2, position: 1, city: 'Toledo', cityNormalized: 'toledo', status: 'active', actualStartAt: '2026-10-07T08:00:00.000Z' }),
  stay({ id: 3, position: 2, city: 'Madrid', status: 'planned' }),
  stay({ id: 4, position: 3, city: 'Sevilla', cityNormalized: 'sevilla', status: 'planned' }),
]

const appointment = { id: 50, dateTime: '2026-11-20T10:00', city: 'Madrid', seasonStayId: 3 } as Appointment
const records = { incomes: [], expenses: [], appointments: [appointment] }

function renderItinerary(overrides: Partial<Parameters<typeof SeasonItinerary>[0]> = {}) {
  const onChanged = vi.fn()
  render(<SeasonItinerary onChanged={onChanged} records={records} season={season} stays={stays} {...overrides} />)
  return { onChanged }
}

describe('SeasonItinerary', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('muestra estados, huecos y visitas repetidas a la misma ciudad', () => {
    renderItinerary()
    expect(screen.getByText(/Estancia actual: Toledo, España/)).toBeTruthy()
    expect(screen.getByText(/Sin estancia entre/)).toBeTruthy()
    expect(screen.getByText('1.ª visita')).toBeTruthy()
    expect(screen.getByText('2.ª visita')).toBeTruthy()
    expect(screen.getAllByText('Prevista')).toHaveLength(2)
    expect(screen.getByText('Finalizada')).toBeTruthy()
  })

  it('sin estancias presenta la ciudad por decidir como estado normal', () => {
    renderItinerary({ stays: [] })
    expect(screen.getByText(/Ciudad por decidir/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('una temporada cerrada es solo consulta', () => {
    renderItinerary({ season: { ...season, status: 'closed' } })
    expect(screen.queryByRole('button', { name: /Añadir ciudad prevista/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Activar/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Corregir/ })).toBeNull()
  })

  it('planifica una ciudad sin fechas', async () => {
    service.createPlannedSeasonStay.mockResolvedValue({})
    const { onChanged } = renderItinerary()
    fireEvent.click(screen.getByRole('button', { name: /Añadir ciudad prevista/ }))
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Valencia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(service.createPlannedSeasonStay).toHaveBeenCalledWith({
      earningPeriodId: 7,
      city: 'Valencia',
      plannedStartDate: undefined,
      plannedEndDate: undefined,
    })
  })

  it('activa una estancia prevista con un instante explícito', async () => {
    service.switchActiveSeasonStay.mockResolvedValue({})
    renderItinerary()
    const sevilla = screen.getByText('Sevilla').closest('li')!
    fireEvent.click(within(sevilla).getByRole('button', { name: /Activar/ }))
    expect(screen.getByText(/La estancia en Toledo terminará exactamente/)).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Activar' }))
    await waitFor(() => expect(service.switchActiveSeasonStay).toHaveBeenCalled())
    expect(service.switchActiveSeasonStay.mock.calls[0][0]).toMatchObject({
      earningPeriodId: 7,
      next: { kind: 'existing', seasonStayId: 4 },
      effectiveAt: expect.stringMatching(/Z$/),
      timeZone: expect.any(String),
    })
  })

  it('cancelar un plan con citas exige motivo y desvinculación explícita', async () => {
    service.cancelPlannedSeasonStay.mockResolvedValue({})
    const { onChanged } = renderItinerary()
    const madridPlan = screen.getAllByText('Madrid').map((node) => node.closest('li')!).find((item) => within(item).queryByText('Prevista'))!
    fireEvent.click(within(madridPlan).getByRole('button', { name: /Cancelar/ }))
    expect(screen.getByText('Citas vinculadas (1)')).toBeTruthy()

    const submit = screen.getByRole('button', { name: 'Cancelar estancia' })
    fireEvent.click(submit)
    expect(await screen.findByText('La cancelación requiere un motivo.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'No iré' } })
    fireEvent.click(submit)
    expect(await screen.findByText(/Confirma que quieres desvincular/)).toBeTruthy()
    expect(service.cancelPlannedSeasonStay).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: /Desvincular estas citas/ }))
    fireEvent.click(submit)
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(service.cancelPlannedSeasonStay).toHaveBeenCalledWith(3, 'No iré', { detachLinkedAppointments: true })
  })

  it('una corrección exige motivo y solo envía lo que cambia', async () => {
    service.correctSeasonStay.mockResolvedValue({})
    renderItinerary()
    const toledo = screen.getByText('Toledo').closest('li')!
    fireEvent.click(within(toledo).getByRole('button', { name: /Corregir/ }))
    fireEvent.change(screen.getByLabelText('Ciudad'), { target: { value: 'Talavera' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
    expect(await screen.findByText('La corrección requiere un motivo.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Error al escribir' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar corrección' }))
    await waitFor(() => expect(service.correctSeasonStay).toHaveBeenCalledWith({
      seasonStayId: 2,
      changes: { city: 'Talavera' },
      reason: 'Error al escribir',
    }))
  })

  it('muestra el error de dominio traducido y mantiene el diálogo abierto', async () => {
    service.switchActiveSeasonStay.mockRejectedValue(new SeasonGeoDomainError('STAY_OVERLAP', 'x'))
    const { onChanged } = renderItinerary()
    fireEvent.click(screen.getByRole('button', { name: /Cambiar de ciudad/ }))
    fireEvent.change(screen.getByLabelText('Nueva ciudad'), { target: { value: 'Bilbao' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/se solapan con otra estancia/)).toBeTruthy()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('reordena solo planes sin fecha enviando el itinerario completo', async () => {
    service.reorderSeasonStays.mockResolvedValue([])
    renderItinerary()
    fireEvent.click(screen.getByRole('button', { name: 'Bajar Madrid en el itinerario' }))
    await waitFor(() => expect(service.reorderSeasonStays).toHaveBeenCalledWith(7, [1, 2, 4, 3]))
  })
})

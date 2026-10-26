// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DialogProvider } from '../../dialogs/DialogProvider'
import type { AppSettings } from '../../../types/settings'
import type { SeasonStay } from '../../../types/seasonStay'
import { SeasonGeoDomainError } from '../../../utils/seasonGeoValidation'

const completeAppointmentAsIncome = vi.fn()
const getAppointmentById = vi.fn()
const getSeasonStayById = vi.fn()
const switchActiveSeasonStay = vi.fn()

class FakeCompletionError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

vi.mock('../../../services/appointmentCompletionService', () => ({
  completeAppointmentAsIncome: (...args: unknown[]) => completeAppointmentAsIncome(...args),
}))
vi.mock('../../../services/appointmentService', () => ({
  getAppointmentById: (...args: unknown[]) => getAppointmentById(...args),
}))
vi.mock('../../../services/seasonStayService', () => ({
  getSeasonStayById: (...args: unknown[]) => getSeasonStayById(...args),
  switchActiveSeasonStay: (...args: unknown[]) => switchActiveSeasonStay(...args),
}))

const { useAppointmentCompletion } = await import('./useAppointmentCompletion')

const settings = { id: 'app' } as AppSettings
const plannedStay: SeasonStay = {
  id: 12,
  earningPeriodId: 7,
  position: 1,
  city: 'Barcelona',
  cityNormalized: 'barcelona',
  countryCode: 'ES',
  status: 'planned',
  locationSource: 'manual',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
}

function Harness() {
  const { complete, dialog } = useAppointmentCompletion()
  const [outcome, setOutcome] = useState('')
  return (
    <>
      <button onClick={async () => setOutcome(await complete(5, settings))} type="button">Finalizar</button>
      <output data-testid="outcome">{outcome}</output>
      {dialog}
    </>
  )
}

function renderHarness() {
  render(<DialogProvider><Harness /></DialogProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Finalizar' }))
}

async function expectOutcome(value: string) {
  await waitFor(() => expect(screen.getByTestId('outcome').textContent).toBe(value))
}

const completed = { status: 'completed', appointment: { id: 5 }, income: { id: 9 }, postCommitWarnings: [] }

describe('useAppointmentCompletion', () => {
  beforeEach(() => {
    getAppointmentById.mockResolvedValue({ id: 5, seasonStayId: 12 })
    getSeasonStayById.mockResolvedValue(plannedStay)
    switchActiveSeasonStay.mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('usa exclusivamente completeAppointmentAsIncome y devuelve el éxito', async () => {
    completeAppointmentAsIncome.mockResolvedValue(completed)
    renderHarness()
    await expectOutcome('completed')
    expect(completeAppointmentAsIncome).toHaveBeenCalledTimes(1)
    expect(completeAppointmentAsIncome).toHaveBeenCalledWith(5, settings, expect.any(Date), {})
  })

  it('trata already_completed como éxito idempotente, sin diálogos', async () => {
    completeAppointmentAsIncome.mockResolvedValue({ status: 'already_completed', appointment: { id: 5 }, postCommitWarnings: [] })
    renderHarness()
    await expectOutcome('already_completed')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('STAY_NOT_STARTED → activar la estancia y reintentar', async () => {
    completeAppointmentAsIncome
      .mockRejectedValueOnce(new SeasonGeoDomainError('STAY_NOT_STARTED', 'x'))
      .mockResolvedValueOnce(completed)
    renderHarness()
    fireEvent.click(await screen.findByRole('button', { name: /Activar y finalizar/ }))
    await expectOutcome('completed')
    expect(switchActiveSeasonStay).toHaveBeenCalledWith(expect.objectContaining({
      earningPeriodId: 7,
      next: { kind: 'existing', seasonStayId: 12 },
    }))
    expect(completeAppointmentAsIncome).toHaveBeenLastCalledWith(5, settings, expect.any(Date), {})
  })

  it('STAY_NOT_STARTED → finalizar sin estancia exige motivo y usa el contrato detach', async () => {
    completeAppointmentAsIncome
      .mockRejectedValueOnce(new SeasonGeoDomainError('STAY_NOT_STARTED', 'x'))
      .mockResolvedValueOnce(completed)
    renderHarness()
    fireEvent.click(await screen.findByRole('button', { name: /Finalizar sin estancia/ }))
    const confirmButton = await screen.findByRole('button', { name: 'Finalizar sin estancia' })
    fireEvent.click(confirmButton)
    expect(await screen.findByText('El motivo es obligatorio.')).toBeTruthy()
    expect(completeAppointmentAsIncome).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  Cambio de planes  ' } })
    fireEvent.click(confirmButton)
    await expectOutcome('completed')
    expect(completeAppointmentAsIncome).toHaveBeenLastCalledWith(5, settings, expect.any(Date), {
      plannedStayResolution: { action: 'detach', reason: 'Cambio de planes' },
    })
    expect(switchActiveSeasonStay).not.toHaveBeenCalled()
  })

  it('STAY_NOT_STARTED → «Ahora no» no persiste nada', async () => {
    completeAppointmentAsIncome.mockRejectedValueOnce(new SeasonGeoDomainError('STAY_NOT_STARTED', 'x'))
    renderHarness()
    fireEvent.click(await screen.findByRole('button', { name: 'Ahora no' }))
    await expectOutcome('cancelled')
    expect(completeAppointmentAsIncome).toHaveBeenCalledTimes(1)
  })

  it('si la activación falla, informa y deja la cita pendiente', async () => {
    completeAppointmentAsIncome.mockRejectedValueOnce(new SeasonGeoDomainError('STAY_NOT_STARTED', 'x'))
    switchActiveSeasonStay.mockRejectedValueOnce(new SeasonGeoDomainError('STAY_OVERLAP', 'x'))
    renderHarness()
    fireEvent.click(await screen.findByRole('button', { name: /Activar y finalizar/ }))
    expect(await screen.findByText(/se solapan.*La cita sigue pendiente/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Aceptar|Entendido|Cerrar/ }))
    await expectOutcome('failed')
    expect(completeAppointmentAsIncome).toHaveBeenCalledTimes(1)
  })

  it('contexto obsoleto: ofrece un reintento seguro que vuelve a llamar al servicio', async () => {
    completeAppointmentAsIncome
      .mockRejectedValueOnce(new FakeCompletionError('APPOINTMENT_PRECONDITION_CHANGED'))
      .mockResolvedValueOnce(completed)
    renderHarness()
    expect(await screen.findByText(/No se guardó nada/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await expectOutcome('completed')
    expect(completeAppointmentAsIncome).toHaveBeenCalledTimes(2)
  })

  it('otros errores se muestran con un mensaje comprensible y no se reintentan', async () => {
    completeAppointmentAsIncome.mockRejectedValueOnce(new FakeCompletionError('APPOINTMENT_SEASON_INVALID'))
    renderHarness()
    expect(await screen.findByText(/no pertenece a una temporada activa/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Aceptar|Entendido|Cerrar/ }))
    await expectOutcome('failed')
    expect(completeAppointmentAsIncome).toHaveBeenCalledTimes(1)
  })

  it('avisa si el ingreso se guardó pero fallaron los recordatorios', async () => {
    completeAppointmentAsIncome.mockResolvedValue({ ...completed, postCommitWarnings: ['REMINDER_CANCELLATION_FAILED'] })
    renderHarness()
    expect(await screen.findByText(/no se pudieron cancelar los recordatorios/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Aceptar|Entendido|Cerrar/ }))
    await expectOutcome('completed')
  })
})

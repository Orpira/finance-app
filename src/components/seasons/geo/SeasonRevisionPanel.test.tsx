// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { EarningPeriod } from '../../../types/earningPeriod'
import type { SeasonRevision } from '../../../types/seasonRevision'

const reviseSeasonPlannedEnd = vi.fn()
const reviseSeasonEconomicGoal = vi.fn()
vi.mock('../../../services/seasonRevisionService', () => ({
  reviseSeasonPlannedEnd: (...args: unknown[]) => reviseSeasonPlannedEnd(...args),
  reviseSeasonEconomicGoal: (...args: unknown[]) => reviseSeasonEconomicGoal(...args),
}))

const { SeasonRevisionPanel } = await import('./SeasonRevisionPanel')
const { describeRevision } = await import('./revisionPresentation')

const season: EarningPeriod = {
  id: 7,
  name: 'Otoño',
  percentage: 50,
  startDate: '2026-10-01T00:00:00.000Z',
  plannedEndDate: '2026-12-31T23:59:59.999Z',
  economicGoal: 5000,
  status: 'active',
  countryCode: 'ES',
  baseCurrency: 'EUR',
  createdAt: '2026-10-01T00:00:00.000Z',
}

const revisions: SeasonRevision[] = [
  { earningPeriodId: 7, sequence: 1, kind: 'economic_goal_revised', source: 'season_creation', previousValue: null, nextValue: 4000, recordedAt: '2026-10-01T09:00:00.000Z' },
  { earningPeriodId: 7, sequence: 2, kind: 'economic_goal_revised', source: 'user_revision', previousValue: 4000, nextValue: 5000, reason: 'Buen arranque', recordedAt: '2026-10-15T09:00:00.000Z' },
]

describe('SeasonRevisionPanel', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('describe el baseline migrado sin atribuirle una historia que no existe', () => {
    const description = describeRevision({
      earningPeriodId: 7, sequence: 1, kind: 'migration_baseline', source: 'migration_baseline',
      previousValue: null, nextValue: { economicGoal: 3000 }, recordedAt: '2026-10-20T00:00:00.000Z',
    }, 'EUR')
    expect(description.title).toMatch(/conocidos al actualizar/)
    expect(description.detail).toMatch(/No representa necesariamente el valor original/)
  })

  it('muestra valores anteriores, nuevos, fecha y motivo de cada revisión', () => {
    render(<SeasonRevisionPanel onChanged={vi.fn()} revisions={revisions} season={season} />)
    expect(screen.getByText('Objetivo económico · Objetivo original')).toBeTruthy()
    expect(screen.getByText(/4000,00\s€ → 5000,00\s€|4\.000,00\s€ → 5\.000,00\s€/)).toBeTruthy()
    expect(screen.getByText(/Motivo: Buen arranque/)).toBeTruthy()
  })

  it('una temporada cerrada no permite revisiones', () => {
    render(<SeasonRevisionPanel onChanged={vi.fn()} revisions={revisions} season={{ ...season, status: 'closed' }} />)
    expect(screen.queryByRole('button', { name: /Revisar/ })).toBeNull()
  })

  it('revisa el objetivo mediante el servicio de revisiones', async () => {
    reviseSeasonEconomicGoal.mockResolvedValue({})
    const onChanged = vi.fn()
    render(<SeasonRevisionPanel onChanged={onChanged} revisions={revisions} season={season} />)
    fireEvent.click(screen.getByRole('button', { name: /Revisar objetivo/ }))
    fireEvent.change(screen.getByLabelText(/Nuevo objetivo/), { target: { value: '6500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(reviseSeasonEconomicGoal).toHaveBeenCalledWith({ earningPeriodId: 7, economicGoal: 6500, reason: undefined })
  })

  it('una ampliación no puede adelantar la fecha; la corrección exige motivo', async () => {
    reviseSeasonPlannedEnd.mockResolvedValue({})
    render(<SeasonRevisionPanel onChanged={vi.fn()} revisions={revisions} season={season} />)
    fireEvent.click(screen.getByRole('button', { name: /Revisar fecha prevista/ }))
    const dateInput = screen.getByLabelText('Nueva fecha prevista')
    fireEvent.change(dateInput, { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))
    expect(await screen.findByText(/Una ampliación debe ser posterior/)).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /Corrección/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))
    expect(await screen.findByText('La corrección requiere un motivo.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/^Motivo/), { target: { value: 'Termina antes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar revisión' }))
    await waitFor(() => expect(reviseSeasonPlannedEnd).toHaveBeenCalledWith({
      earningPeriodId: 7,
      plannedEndDate: '2026-12-01',
      mode: 'correction',
      reason: 'Termina antes',
    }))
  })
})

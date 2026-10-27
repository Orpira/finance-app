// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SeasonStay } from '../../../types/seasonStay'
import { createGeographyDraft, type RecordGeographyDraft } from './recordGeographyForm'

const listSelectableSeasonStays = vi.fn()

vi.mock('../../../services/seasonStayService', () => ({
  listSelectableSeasonStays: (...args: unknown[]) => listSelectableSeasonStays(...args),
}))

const { RecordGeographyFields } = await import('./RecordGeographyFields')

function stay(overrides: Partial<SeasonStay>): SeasonStay {
  return {
    id: 1,
    earningPeriodId: 7,
    position: 0,
    city: 'Madrid',
    cityNormalized: 'madrid',
    countryCode: 'ES',
    status: 'completed',
    actualStartAt: '2026-11-01T08:00:00.000Z',
    actualEndAt: '2026-11-05T08:00:00.000Z',
    timeZone: 'Europe/Madrid',
    locationSource: 'manual',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

const stays = [
  stay({ id: 1 }),
  stay({ id: 2, city: 'Barcelona', cityNormalized: 'barcelona', actualStartAt: '2026-11-05T08:00:00.000Z', actualEndAt: '2026-11-08T08:00:00.000Z' }),
  stay({ id: 3, status: 'active', actualStartAt: '2026-11-08T08:00:00.000Z', actualEndAt: undefined }),
  stay({ id: 4, city: 'Sevilla', cityNormalized: 'sevilla', status: 'planned', actualStartAt: undefined, actualEndAt: undefined }),
]

let latestDraft: RecordGeographyDraft | null = null

function Harness({ isEditing = false, initial, kind = 'income' as const }: {
  isEditing?: boolean
  initial?: RecordGeographyDraft
  kind?: 'income' | 'expense' | 'appointment'
}) {
  const [draft, setDraft] = useState(initial ?? createGeographyDraft(undefined, 'ES'))
  useEffect(() => {
    latestDraft = draft
  }, [draft])
  return (
    <RecordGeographyFields
      draft={draft}
      earningPeriodId={7}
      historicalLocation={{ city: 'Madrid', country: 'ES' }}
      isEditing={isEditing}
      kind={kind}
      onChange={setDraft}
      seasonCountryCode="ES"
      temporalValue="2026-11-09"
    />
  )
}

describe('RecordGeographyFields', () => {
  beforeEach(() => {
    latestDraft = null
    listSelectableSeasonStays.mockImplementation(async ({ recordKind }: { recordKind: string }) => {
      return stays.map((item, index) => {
        const disabledReason = item.id === 3 || (item.id === 4 && recordKind === 'appointment')
          ? undefined
          : item.id === 4 ? 'not_started' : 'outside_interval'
        return {
          stay: item, id: item.id, earningPeriodId: 7, status: item.status, city: item.city,
          // Números de visita como los calcula el dominio: Madrid 1.ª y 2.ª.
          visitNumber: [1, 1, 2, 1][index], label: item.city, selectable: disabledReason === undefined,
          selected: false, disabledReason,
        }
      })
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('consulta el read model de dominio con el tipo de registro y la fecha', async () => {
    render(<Harness />)
    await screen.findByLabelText(/Estancia/)
    expect(listSelectableSeasonStays).toHaveBeenCalledWith(expect.objectContaining({
      recordKind: 'income', earningPeriodId: 7, temporalValue: '2026-11-09',
    }))
  })

  it('al crear empieza sin estancia: nunca asocia una en silencio', async () => {
    render(<Harness />)
    const select = await screen.findByLabelText(/Estancia/) as HTMLSelectElement
    await screen.findByRole('button', { name: /Usar estancia actual/ })
    expect(select.value).toBe('')
    expect(latestDraft?.seasonStayId).toBeNull()
    expect(screen.getByText('No se asociará ninguna estancia salvo que la elijas.')).toBeTruthy()
  })

  it('sugiere la estancia actual de forma identificable y la asocia solo al pulsar', async () => {
    render(<Harness />)
    const suggestion = await screen.findByRole('button', { name: /Usar estancia actual: Madrid, España · 2\.ª visita/ })
    fireEvent.click(suggestion)
    const select = screen.getByLabelText(/Estancia/) as HTMLSelectElement
    await waitFor(() => expect(select.value).toBe('3'))
    expect(latestDraft?.seasonStayId).toBe(3)
    expect(screen.queryByRole('button', { name: /Usar estancia actual/ })).toBeNull()
  })

  it('distingue visitas repetidas y desactiva las no compatibles', async () => {
    render(<Harness />)
    const select = await screen.findByLabelText(/Estancia/) as HTMLSelectElement
    await screen.findByRole('button', { name: /Usar estancia actual/ })
    const options = Array.from(select.options)
    expect(options.find((option) => option.value === '1')?.textContent).toMatch(/Madrid, España · 1\.ª visita/)
    expect(options.find((option) => option.value === '3')?.textContent).toMatch(/Madrid, España · 2\.ª visita/)
    expect(options.find((option) => option.value === '1')?.disabled).toBe(true)
    expect(options.find((option) => option.value === '4')?.disabled).toBe(true)
  })

  it('permite volver a «Sin estancia» tras elegir una', async () => {
    render(<Harness />)
    const select = await screen.findByLabelText(/Estancia/) as HTMLSelectElement
    fireEvent.click(await screen.findByRole('button', { name: /Usar estancia actual/ }))
    await waitFor(() => expect(select.value).toBe('3'))
    fireEvent.change(select, { target: { value: '' } })
    await waitFor(() => expect(latestDraft?.seasonStayId).toBeNull())
  })

  it('al editar no cambia la estancia guardada y la muestra como histórica si ya no es compatible', async () => {
    render(<Harness initial={createGeographyDraft({ seasonStayId: 1 })} isEditing />)
    const select = await screen.findByLabelText(/Estancia/) as HTMLSelectElement
    await screen.findByText(/Estancia histórica/)
    expect(select.value).toBe('1')
    expect(latestDraft?.seasonStayId).toBe(1)
  })

  it('la sincronización de ubicación es una acción explícita en edición', async () => {
    render(<Harness initial={createGeographyDraft({ seasonStayId: 3 })} isEditing />)
    const checkbox = await screen.findByRole('checkbox', { name: /Actualizar la ciudad y el país/ })
    expect(latestDraft?.syncLocationFromStay).toBe(false)
    fireEvent.click(checkbox)
    await waitFor(() => expect(latestDraft?.syncLocationFromStay).toBe(true))
  })

  it('muestra un estado normal cuando la temporada no tiene estancias', async () => {
    listSelectableSeasonStays.mockResolvedValue([])
    render(<Harness />)
    expect(await screen.findByText(/aún no tiene estancias\. Puedes guardar sin estancia/)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('el destino puntual es independiente de la estancia y avisa si es internacional', async () => {
    render(<Harness />)
    await screen.findByLabelText(/Estancia/)
    fireEvent.click(screen.getByRole('checkbox', { name: /Destino puntual/ }))
    fireEvent.change(screen.getByLabelText('Ciudad de destino'), { target: { value: 'Lisboa' } })
    fireEvent.change(screen.getByLabelText('País (opcional)'), { target: { value: 'PT' } })
    expect(screen.getByText(/Destino internacional/)).toBeTruthy()
    await waitFor(() => expect(latestDraft?.destination).toMatchObject({ kind: 'city', label: 'Lisboa', countryCode: 'PT' }))
    // El destino no crea ni elige estancia.
    expect(latestDraft?.seasonStayId).toBeNull()
  })

  it('las citas indican que pueden usar estancias previstas', async () => {
    render(<Harness initial={createGeographyDraft({ seasonStayId: 4 })} isEditing kind="appointment" />)
    expect(await screen.findByText(/Las citas futuras pueden asociarse a una estancia prevista/)).toBeTruthy()
    const select = screen.getByLabelText(/Estancia/) as HTMLSelectElement
    expect(Array.from(select.options).find((option) => option.value === '4')?.disabled).toBe(false)
  })
})

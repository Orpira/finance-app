import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { HomeMainPriority } from '../src/pages/Home/HomeMainPriority'

describe('HomeMainPriority', () => {
  it('no renderiza título, tarjeta ni espacio residual cuando no hay prioridades', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter><HomeMainPriority priorities={[]} /></MemoryRouter>,
    )

    expect(markup).toBe('')
    expect(markup).not.toContain('No hay asuntos urgentes para hoy.')
  })

  it('renderiza únicamente la prioridad principal con su acción', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <HomeMainPriority priorities={[
          { id: 'overdue-pending-income', message: 'Un ingreso lleva más de 7 días sin reportar.', action: { label: 'Revisar ahora', to: '/income/pendientes' } },
          { id: 'today-appointments', message: 'Hoy tienes una cita.', action: { label: 'Ver agenda', to: '/agenda' } },
        ]} />
      </MemoryRouter>,
    )

    expect(markup).toContain('Prioridad principal')
    expect(markup).toContain('Un ingreso lleva más de 7 días sin reportar.')
    expect(markup).toContain('Revisar ahora')
    expect(markup).not.toContain('Hoy tienes una cita.')
    expect(markup).not.toContain('No hay asuntos urgentes para hoy.')
  })
})

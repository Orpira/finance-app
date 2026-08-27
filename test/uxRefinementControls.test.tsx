import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { PeriodNavigator } from '../src/components/PeriodNavigator'
import { MovementCreateSheet } from '../src/pages/Movements/MovementCreateSheet'
import { MovementFiltersSheet } from '../src/pages/Movements/MovementFiltersSheet'
import { readMovementFilters } from '../src/pages/Movements/movementFilters'

describe('UX refinement controls', () => {
  const now = new Date('2026-08-27T12:00:00')
  const defaults = readMovementFilters(new URLSearchParams(), now)

  it('ofrece ingreso y gasto desde una única acción de Movimientos', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <MovementCreateSheet onCancel={() => undefined} />
      </MemoryRouter>,
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('Registrar movimiento')
    expect(markup).toContain('href="/income/nuevo"')
    expect(markup).toContain('href="/expenses/nuevo"')
    expect(markup).toContain('Cancelar')
  })

  it('mantiene todos los criterios dentro de la hoja con acciones explícitas', () => {
    const markup = renderToStaticMarkup(
      <MovementFiltersSheet
        categories={['Servicio', 'Transporte']}
        currencies={['EUR', 'COP']}
        defaultFilters={defaults}
        filters={defaults}
        onApply={() => undefined}
        onCancel={() => undefined}
      />,
    )

    expect(markup).toContain('Filtrar movimientos')
    expect(markup).toContain('Hoy')
    expect(markup).toContain('Semana')
    expect(markup).toContain('Personalizado')
    expect(markup).toContain('Estado de reporte')
    expect(markup).toContain('Restablecer')
    expect(markup).toContain('Aplicar')
  })

  it('bloquea aplicar cuando el rango personalizado es inválido', () => {
    const markup = renderToStaticMarkup(
      <MovementFiltersSheet
        categories={[]}
        currencies={[]}
        defaultFilters={defaults}
        filters={{
          ...defaults,
          period: 'custom',
          dateFrom: '2026-08-30',
          dateTo: '2026-08-20',
        }}
        onApply={() => undefined}
        onCancel={() => undefined}
      />,
    )

    expect(markup).toContain('Selecciona un rango de fechas válido.')
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Aplicar<\/button>/)
  })

  it('nombra las flechas y permite que la etiqueta central abra el selector', () => {
    const markup = renderToStaticMarkup(
      <PeriodNavigator
        label="Agosto 2026"
        onLabelClick={() => undefined}
        onNext={() => undefined}
        onPrevious={() => undefined}
      />,
    )

    expect(markup).toContain('aria-label="Período anterior"')
    expect(markup).toContain('aria-label="Período siguiente"')
    expect(markup).toContain('Agosto 2026')
    expect(markup.match(/<button/g)).toHaveLength(3)
  })
})
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ServiceDurationSelect } from '../src/components/forms/ServiceDurationSelect'

describe('ServiceDurationSelect', () => {
  it('muestra horas y convierte las opciones cuando recibe la unidad del wizard', () => {
    const markup = renderToStaticMarkup(
      <ServiceDurationSelect onChange={() => undefined} unit="hours" value="" />,
    )

    expect(markup).toContain('Duración (Horas)')
    expect(markup).toContain('0,5 horas')
    expect(markup).toContain('1 hora')
    expect(markup).not.toContain('Duración (Minutos)')
  })

  it('mantiene minutos por defecto para los flujos que no especifican unidad', () => {
    const markup = renderToStaticMarkup(
      <ServiceDurationSelect onChange={() => undefined} value="" />,
    )

    expect(markup).toContain('Duración (Minutos)')
    expect(markup).toContain('30 minutos')
  })
})

describe('duración personalizada en ingresos', () => {
  it('reemplaza Salida y solicita minutos positivos enteros incluso con unidad horas', () => {
    const markup = renderToStaticMarkup(
      <ServiceDurationSelect onChange={() => undefined} onCustomMinutesChange={() => undefined} customMinutes={75} unit="hours" value="Personalizado" />,
    )
    expect(markup).toContain('Personalizado')
    expect(markup).not.toContain('Salida')
    expect(markup).toContain('Duración personalizada (minutos)')
    expect(markup).toContain('value="75"')
    expect(markup).toContain('min="1"')
    expect(markup).toContain('step="1"')
  })
})

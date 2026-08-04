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
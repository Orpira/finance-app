import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CurrencyQuoteCard } from './CurrencyQuoteCard'

describe('CurrencyQuoteCard', () => {
  it('renders the local quote controls and an accessible refresh action', () => {
    const markup = renderToStaticMarkup(
      <CurrencyQuoteCard
        defaultCurrency="EUR"
        rateMode="automatic"
        secondaryCurrency="COP"
        title="Cotizaciones"
      />,
    )

    expect(markup).toContain('Cotizaciones')
    expect(markup).toContain('Importe')
    expect(markup).toContain('Moneda base')
    expect(markup).toContain('aria-label="Actualizar cotizaciones"')
    expect(markup).toContain('Consultando cotizaciones...')
  })
})
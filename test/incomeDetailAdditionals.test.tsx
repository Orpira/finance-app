import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { IncomeAdditionalsDetail } from '../src/pages/Income/IncomeDetailPage'

const additionals = [
  {
    id: 1,
    incomeId: 10,
    amount: 15,
    description: 'Desplazamiento',
    createdAt: '2026-08-24T10:00:00.000Z',
  },
  {
    id: 2,
    incomeId: 10,
    amount: 8.5,
    createdAt: '2026-08-24T10:05:00.000Z',
  },
]

describe('IncomeAdditionalsDetail', () => {
  it('muestra los importes y descripciones de los adicionales del ingreso', () => {
    const markup = renderToStaticMarkup(
      <IncomeAdditionalsDetail
        additionals={additionals}
        currency="EUR"
        hidden={false}
      />,
    )

    expect(markup).toContain('Adicionales')
    expect(markup).toContain('2 adicionales')
    expect(markup).toContain('Desplazamiento')
    expect(markup).toContain('Adicional sin descripción')
    expect(markup).toContain('15,00')
    expect(markup).toContain('8,50')
  })

  it('oculta los importes cuando los valores sensibles están protegidos', () => {
    const markup = renderToStaticMarkup(
      <IncomeAdditionalsDetail
        additionals={additionals}
        currency="EUR"
        hidden
      />,
    )

    expect(markup.match(/\*\*\*\*/g)).toHaveLength(2)
    expect(markup).not.toContain('15,00')
    expect(markup).not.toContain('8,50')
  })
})

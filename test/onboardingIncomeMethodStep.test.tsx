import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { WorkModeStep } from '../src/components/onboarding/steps/WorkModeStep'

describe('WorkModeStep', () => {
  it('presenta el método de cálculo del ingreso en lugar de la unidad de duración', () => {
    const markup = renderToStaticMarkup(
      <WorkModeStep currentStep={2} onNext={() => undefined} />,
    )

    expect(markup).toContain('Método de cálculo del ingreso')
    expect(markup).toContain('Servicio por tiempo')
    expect(markup).toContain('Jornada por horas')
    expect(markup).not.toContain('Por minutos')
    expect(markup).not.toContain('Por horas')
  })
})
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { OnboardingProgress } from '../src/components/onboarding/OnboardingProgress'

describe('OnboardingProgress', () => {
  it('renders the effective position and total, not a fixed global count', () => {
    const markup = renderToStaticMarkup(<OnboardingProgress stepNumber={3} totalSteps={5} />)

    expect(markup).toContain('Paso 3 de 5')
  })

  it('exposes progress via ARIA attributes for assistive technologies', () => {
    const markup = renderToStaticMarkup(<OnboardingProgress stepNumber={2} totalSteps={7} />)

    expect(markup).toContain('role="progressbar"')
    expect(markup).toContain('aria-valuenow="2"')
    expect(markup).toContain('aria-valuemin="1"')
    expect(markup).toContain('aria-valuemax="7"')
  })
})

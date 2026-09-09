import { describe, expect, it } from 'vitest'

import {
  getNextOnboardingStepIndex,
  getOnboardingStepPosition,
  getPreviousOnboardingStepIndex,
  getVisibleOnboardingSteps,
  ONBOARDING_STEP_ORDER,
  type OnboardingStepId,
} from '../src/types/onboarding'
import type { UsageMode } from '../src/types/settings'

function walkForward(usageMode: UsageMode | null) {
  const positions: Array<{ stepId: OnboardingStepId; stepNumber: number; totalSteps: number }> = []
  let stepId: OnboardingStepId = 'welcome'

  while (true) {
    const { stepNumber, totalSteps } = getOnboardingStepPosition(stepId, usageMode)
    positions.push({ stepId, stepNumber, totalSteps })

    if (stepId === 'finish') break
    stepId = ONBOARDING_STEP_ORDER[getNextOnboardingStepIndex(stepId, usageMode)]
  }

  return positions
}

describe('getVisibleOnboardingSteps', () => {
  it('excludes work-mode and season for Personal (basic)', () => {
    expect(getVisibleOnboardingSteps('basic')).toEqual([
      'welcome',
      'usage',
      'currency',
      'security',
      'finish',
    ])
  })

  it('includes every step for Profesional', () => {
    expect(getVisibleOnboardingSteps('professional')).toEqual(ONBOARDING_STEP_ORDER)
  })

  it('includes every step for Híbrido', () => {
    expect(getVisibleOnboardingSteps('hybrid')).toEqual(ONBOARDING_STEP_ORDER)
  })

  it('excludes the professional-only steps before a mode is chosen (null)', () => {
    expect(getVisibleOnboardingSteps(null)).toEqual([
      'welcome',
      'usage',
      'currency',
      'security',
      'finish',
    ])
  })
})

// Test 1 y Test 2 (ver historia): Personal no debe mostrar saltos numéricos
// ni pantallas exclusivas de Profesional.
describe('Personal (basic) walkthrough numbering', () => {
  const positions = walkForward('basic')

  it('is continuous from 1 to the effective total with no gaps', () => {
    expect(positions.map((p) => p.stepNumber)).toEqual([1, 2, 3, 4, 5])
    expect(positions.every((p) => p.totalSteps === 5)).toBe(true)
  })

  it('never renders a professional-only step', () => {
    expect(positions.map((p) => p.stepId)).not.toContain('work-mode')
    expect(positions.map((p) => p.stepId)).not.toContain('season')
  })

  it('reaches "finish" as the last step of the effective total (5 of 5, never 7 of 7)', () => {
    const finish = positions.find((p) => p.stepId === 'finish')
    expect(finish).toEqual({ stepId: 'finish', stepNumber: 5, totalSteps: 5 })
  })
})

// Test 3: Profesional debe mantener su numeración continua y completa.
describe('Profesional walkthrough numbering', () => {
  const positions = walkForward('professional')

  it('is continuous across all 7 steps', () => {
    expect(positions.map((p) => p.stepNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(positions.every((p) => p.totalSteps === 7)).toBe(true)
  })

  it('includes the professional-only steps', () => {
    expect(positions.map((p) => p.stepId)).toEqual(ONBOARDING_STEP_ORDER)
  })
})

// Test 4: Híbrido sigue el mismo recorrido de configuración que Profesional.
describe('Híbrido walkthrough numbering', () => {
  const positions = walkForward('hybrid')

  it('is continuous across all 7 steps', () => {
    expect(positions.map((p) => p.stepNumber)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(positions.every((p) => p.totalSteps === 7)).toBe(true)
  })

  it('includes the professional-only steps', () => {
    expect(positions.map((p) => p.stepId)).toEqual(ONBOARDING_STEP_ORDER)
  })
})

// Test 5: "Atrás" en Personal nunca debe visitar un paso de Profesional.
describe('back navigation in Personal (basic)', () => {
  it('walks backward through only the visible Personal steps', () => {
    const trail: OnboardingStepId[] = []
    let stepId: OnboardingStepId = 'security'

    while (true) {
      trail.push(stepId)
      const previousIndex = getPreviousOnboardingStepIndex(stepId, 'basic')
      if (previousIndex === undefined) break
      stepId = ONBOARDING_STEP_ORDER[previousIndex]
    }

    expect(trail).toEqual(['security', 'currency', 'usage', 'welcome'])
    expect(trail).not.toContain('work-mode')
    expect(trail).not.toContain('season')
  })

  it('currency goes back to usage (skipping work-mode/season) in Personal', () => {
    const previousIndex = getPreviousOnboardingStepIndex('currency', 'basic')
    expect(previousIndex).toBe(ONBOARDING_STEP_ORDER.indexOf('usage'))
  })

  it('currency goes back to season in Profesional/Híbrido', () => {
    expect(getPreviousOnboardingStepIndex('currency', 'professional')).toBe(
      ONBOARDING_STEP_ORDER.indexOf('season'),
    )
    expect(getPreviousOnboardingStepIndex('currency', 'hybrid')).toBe(
      ONBOARDING_STEP_ORDER.indexOf('season'),
    )
  })
})

// Test 6 y Test 7: cambiar el tipo de uso a mitad del onboarding debe
// reconstruir el itinerario sin dejar residuos del modo anterior.
describe('switching usage mode mid-onboarding rebuilds the itinerary', () => {
  it('Profesional -> Personal drops the professional-only steps from the active list', () => {
    expect(getVisibleOnboardingSteps('professional')).toContain('work-mode')
    expect(getVisibleOnboardingSteps('basic')).not.toContain('work-mode')

    // 'usage' -> siguiente paso pasa de 'work-mode' (índice 2) a 'currency' (índice 4)
    expect(getNextOnboardingStepIndex('usage', 'professional')).toBe(
      ONBOARDING_STEP_ORDER.indexOf('work-mode'),
    )
    expect(getNextOnboardingStepIndex('usage', 'basic')).toBe(
      ONBOARDING_STEP_ORDER.indexOf('currency'),
    )
  })

  it('Personal -> Profesional restores the professional-only steps to the active list', () => {
    const rebuilt = getVisibleOnboardingSteps('professional')
    expect(rebuilt).toContain('work-mode')
    expect(rebuilt).toContain('season')
    expect(rebuilt).toEqual(ONBOARDING_STEP_ORDER)
  })

  it('recomputes the total steps immediately when the mode changes', () => {
    expect(getOnboardingStepPosition('currency', 'basic').totalSteps).toBe(5)
    expect(getOnboardingStepPosition('currency', 'professional').totalSteps).toBe(7)
  })
})

// Test 8: la pantalla de finalización debe representar el último paso real.
describe('completion step number', () => {
  it('is 5 of 5 for Personal, never 7 of 7', () => {
    expect(getOnboardingStepPosition('finish', 'basic')).toEqual({ stepNumber: 5, totalSteps: 5 })
  })

  it('is 7 of 7 for Profesional/Híbrido', () => {
    expect(getOnboardingStepPosition('finish', 'professional')).toEqual({
      stepNumber: 7,
      totalSteps: 7,
    })
    expect(getOnboardingStepPosition('finish', 'hybrid')).toEqual({
      stepNumber: 7,
      totalSteps: 7,
    })
  })
})

import { describe, expect, it } from 'vitest'
import { AIInteractionLifecycle } from './AIInteractionLifecycle'

describe('AIInteractionLifecycle', () => {
  it('applies the valid main lifecycle flow deterministically', () => {
    const lifecycle = new AIInteractionLifecycle()

    const validated = lifecycle.applyEvent('CREATED', 'VALIDATE')
    const authorized = lifecycle.applyEvent(validated, 'AUTHORIZE')
    const contextBuilt = lifecycle.applyEvent(authorized, 'BUILD_CONTEXT')
    const executing = lifecycle.applyEvent(contextBuilt, 'EXECUTE')
    const completed = lifecycle.applyEvent(executing, 'COMPLETE')

    expect(completed).toBe('COMPLETED')
    expect(lifecycle.isFinalState(completed)).toBe(true)
  })

  it('supports cancellation from EXECUTING', () => {
    const lifecycle = new AIInteractionLifecycle()

    expect(lifecycle.applyEvent('EXECUTING', 'CANCEL')).toBe('CANCELLED')
  })

  it('supports failure from EXECUTING', () => {
    const lifecycle = new AIInteractionLifecycle()

    expect(lifecycle.applyEvent('EXECUTING', 'FAIL')).toBe('FAILED')
  })

  it('rejects invalid transitions explicitly', () => {
    const lifecycle = new AIInteractionLifecycle()

    const validation = lifecycle.validateTransition('CREATED', 'EXECUTE')

    expect(validation.allowed).toBe(false)
    expect(validation.code).toBe('TRANSITION_NOT_ALLOWED')
    expect(() => lifecycle.applyEvent('CREATED', 'EXECUTE')).toThrow(
      '[TRANSITION_NOT_ALLOWED]',
    )
  })

  it('fails closed on unknown states', () => {
    const lifecycle = new AIInteractionLifecycle()

    const validation = lifecycle.validateTransition('UNKNOWN_STATE', 'VALIDATE')

    expect(validation.allowed).toBe(false)
    expect(validation.code).toBe('INVALID_STATE')
  })

  it('fails closed on unknown events', () => {
    const lifecycle = new AIInteractionLifecycle()

    const validation = lifecycle.validateTransition('CREATED', 'UNKNOWN_EVENT')

    expect(validation.allowed).toBe(false)
    expect(validation.code).toBe('INVALID_EVENT')
  })

  it('rejects transitions from final states', () => {
    const lifecycle = new AIInteractionLifecycle()

    const validation = lifecycle.validateTransition('COMPLETED', 'EXECUTE')

    expect(validation.allowed).toBe(false)
    expect(validation.code).toBe('FINAL_STATE_IMMUTABLE')
  })

  it('fails closed when no transitions are registered for a state', () => {
    const lifecycle = new AIInteractionLifecycle([
      { from: 'CREATED', event: 'VALIDATE', to: 'VALIDATED' },
    ])

    const validation = lifecycle.validateTransition('VALIDATED', 'AUTHORIZE')

    expect(validation.allowed).toBe(false)
    expect(validation.code).toBe('TRANSITION_NOT_REGISTERED')
  })
})
import { describe, expect, it } from 'vitest'

import { shouldMountProtectedContent } from '../src/utils/pinGateLifecycle'

describe('PinGate lifecycle', () => {
  it('mantiene montado el contenido tras bloquear una sesión ya desbloqueada', () => {
    expect(shouldMountProtectedContent('locked', true)).toBe(true)
  })

  it('no monta contenido protegido antes del primer desbloqueo', () => {
    expect(shouldMountProtectedContent('locked', false)).toBe(false)
    expect(shouldMountProtectedContent('loading', false)).toBe(false)
  })

  it('monta el contenido durante una sesión desbloqueada', () => {
    expect(shouldMountProtectedContent('unlocked', false)).toBe(true)
  })
})

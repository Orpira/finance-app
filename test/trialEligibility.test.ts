import { describe, expect, it } from 'vitest'

import { resolveTrialDecision } from '../server/trialEligibility'

describe('resolveTrialDecision', () => {
  it('dispositivo sin registro previo decide emitir un trial nuevo', () => {
    const now = new Date('2026-01-10T00:00:00.000Z')

    const result = resolveTrialDecision({ now, existing: null })

    expect(result).toEqual({ decision: 'issue' })
  })

  it('dispositivo con trial vigente decide reactivar con la fila existente', () => {
    const now = new Date('2026-01-10T00:00:00.000Z')
    const existing = {
      issuedAt: '2026-01-05T00:00:00.000Z',
      expiresAt: '2026-01-12T00:00:00.000Z',
    }

    const result = resolveTrialDecision({ now, existing })

    expect(result).toEqual({ decision: 'reactivate', existing })
  })

  it('dispositivo con trial expirado decide expired', () => {
    const now = new Date('2026-01-20T00:00:00.000Z')
    const existing = {
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-08T00:00:00.000Z',
    }

    const result = resolveTrialDecision({ now, existing })

    expect(result).toEqual({ decision: 'expired', existing })
  })

  it('expiresAt exactamente igual a ahora se considera vencido (limite inclusivo)', () => {
    const now = new Date('2026-01-08T00:00:00.000Z')
    const existing = {
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-08T00:00:00.000Z',
    }

    const result = resolveTrialDecision({ now, existing })

    expect(result).toEqual({ decision: 'expired', existing })
  })

  it('reloj manipulado hacia atras (issuedAt en el futuro) decide clock-tampered', () => {
    const now = new Date('2026-01-10T00:00:00.000Z')
    const existing = {
      issuedAt: '2026-01-15T00:00:00.000Z',
      expiresAt: '2026-01-22T00:00:00.000Z',
    }

    const result = resolveTrialDecision({ now, existing })

    expect(result).toEqual({ decision: 'clock-tampered', existing })
  })

  // Marcador vivo del siguiente incremento (ver docs/TRIAL_FLOW.md,
  // "Próximo incremento"): anclar el trial también por email, además de
  // deviceCode, para cerrar el hueco de "borrar datos/reinstalar y
  // reclamar otro trial" documentado en LICENSE_DEVICE_REGISTRY.md.
  it.todo('ancla el trial por email para bloquear reinstalación')
})

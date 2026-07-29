import { describe, expect, it } from 'vitest'

import { deriveTrialState, runTrialFlow } from '../src/services/trialFlow'
import type { TrialAttemptOutcome } from '../src/services/trialService'

describe('deriveTrialState', () => {
  it('sin licencia local, estado inactive, es elegible para el trial', () => {
    expect(deriveTrialState({ status: 'inactive', license: undefined })).toBe(
      'eligible',
    )
  })

  it('con una licencia inactiva ya existente, no es elegible (no es instalacion nueva)', () => {
    expect(
      deriveTrialState({ status: 'inactive', license: { id: 'current' } }),
    ).toBeNull()
  })

  it('con estado active, no es elegible', () => {
    expect(deriveTrialState({ status: 'active', license: undefined })).toBeNull()
  })
})

describe('runTrialFlow', () => {
  it('outcome granted (issued o reactivated ya activados) termina en trial-active', async () => {
    const outcome: TrialAttemptOutcome = {
      outcome: 'granted',
      license: { id: 'current' } as never,
    }

    const result = await runTrialFlow(async () => outcome)

    expect(result).toEqual({ state: 'trial-active' })
  })

  it('outcome expired termina en trial-expired (pantalla de compra)', async () => {
    const outcome: TrialAttemptOutcome = { outcome: 'expired' }

    const result = await runTrialFlow(async () => outcome)

    expect(result).toEqual({ state: 'trial-expired' })
  })

  it('fallos repetidos terminan en error tras exactamente el limite de intentos, nunca en bucle', async () => {
    let callCount = 0
    const alwaysFails = async (): Promise<TrialAttemptOutcome> => {
      callCount += 1
      return { outcome: 'network-error', detail: 'sin conexión' }
    }

    const result = await runTrialFlow(alwaysFails, 2)

    expect(callCount).toBe(2)
    expect(result).toEqual({ state: 'error', detail: 'sin conexión' })
  })

  it('reintenta tras un fallo transitorio y termina en trial-active si el segundo intento concede el trial', async () => {
    let callCount = 0
    const failsOnce = async (): Promise<TrialAttemptOutcome> => {
      callCount += 1
      if (callCount === 1) {
        return { outcome: 'server-error', status: 500, detail: 'boom' }
      }
      return { outcome: 'granted', license: { id: 'current' } as never }
    }

    const result = await runTrialFlow(failsOnce, 2)

    expect(callCount).toBe(2)
    expect(result).toEqual({ state: 'trial-active' })
  })
})

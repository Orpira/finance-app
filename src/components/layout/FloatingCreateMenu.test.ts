import { describe, expect, it } from 'vitest'

import { getFloatingCreateActions } from './floatingCreateActions'

describe('getFloatingCreateActions', () => {
  it('ofrece crear una cita desde el botón flotante en modo Profesional', () => {
    expect(getFloatingCreateActions('professional')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Nueva cita', path: '/agenda/nueva' }),
      ]),
    )
  })

  it('no ofrece citas en modo Básico', () => {
    expect(getFloatingCreateActions('basic')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/agenda/nueva' }),
      ]),
    )
  })

  it('ofrece "Transferir dinero" desde el botón flotante en modo Personal', () => {
    expect(getFloatingCreateActions('basic')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Transferir dinero', path: '/transfers/nuevo' }),
      ]),
    )
  })

  it('no ofrece transferencias entre wallets en modo Profesional (spec §15)', () => {
    expect(getFloatingCreateActions('professional')).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/transfers/nuevo' }),
      ]),
    )
  })
})
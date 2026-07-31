import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getLastInboundAt, setLastInboundAt } = vi.hoisted(() => ({
  getLastInboundAt: vi.fn(),
  setLastInboundAt: vi.fn(),
}))

vi.mock('../server/communication/repositories/serviceWindowRepository', () => ({
  getLastInboundAt,
  setLastInboundAt,
}))

import { getStatus, registerInbound } from '../server/communication/services/serviceWindowService'

beforeEach(() => {
  getLastInboundAt.mockReset()
  setLastInboundAt.mockReset()
  vi.useRealTimers()
})

describe('serviceWindowService', () => {
  it('reporta la ventana cerrada cuando nunca hubo un mensaje entrante', async () => {
    getLastInboundAt.mockResolvedValue(null)
    const status = await getStatus('34600000000')
    expect(status).toEqual({ open: false })
  })

  it('reporta la ventana abierta dentro de las 24 horas siguientes al último inbound', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    getLastInboundAt.mockResolvedValue(oneHourAgo)

    const status = await getStatus('34600000000')

    expect(status.open).toBe(true)
    expect(status.lastInboundAt).toBe(oneHourAgo)
    expect(status.expiresAt).toBeDefined()
  })

  it('reporta la ventana cerrada pasadas las 24 horas', async () => {
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    getLastInboundAt.mockResolvedValue(twentyFiveHoursAgo)

    const status = await getStatus('34600000000')

    expect(status.open).toBe(false)
    expect(status.lastInboundAt).toBe(twentyFiveHoursAgo)
  })

  it('registerInbound delega en el repositorio con la referencia y el timestamp recibidos', async () => {
    await registerInbound('34600000000', '2026-07-31T10:00:00.000Z')
    expect(setLastInboundAt).toHaveBeenCalledWith('34600000000', '2026-07-31T10:00:00.000Z')
  })
})

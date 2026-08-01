import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { dispatchWebhook } from '../server/automation/webhookDispatcher'

const ENVIRONMENT = {
  N8N_AUTOMATION_WEBHOOK_URL: 'https://n8n.example/automation',
  N8N_DEVICE_PROVISIONING_WEBHOOK_URL: 'https://n8n.example/provision',
  N8N_WHATSAPP_WEBHOOK_URL: 'https://n8n.example/whatsapp',
  N8N_INTERNAL_TOKEN: 'internal-token',
}

const EVENT_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  Object.assign(process.env, ENVIRONMENT)
})

afterEach(() => {
  vi.unstubAllGlobals()
  for (const name of Object.keys(ENVIRONMENT)) delete process.env[name]
})

describe('Webhook dispatcher', () => {
  it.each([
    ['income.created', ENVIRONMENT.N8N_AUTOMATION_WEBHOOK_URL],
    ['service.completed', ENVIRONMENT.N8N_AUTOMATION_WEBHOOK_URL],
    ['device.provision.requested', ENVIRONMENT.N8N_DEVICE_PROVISIONING_WEBHOOK_URL],
    ['device.whatsapp.connect.requested', ENVIRONMENT.N8N_WHATSAPP_WEBHOOK_URL],
  ] as const)('enruta %s al webhook configurado', async (event, expectedUrl) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ accepted: true }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    await dispatchWebhook({ event, eventId: EVENT_ID, payload: { event } })

    expect(fetchMock).toHaveBeenCalledWith(
      expectedUrl,
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer internal-token',
          'Content-Type': 'application/json',
          'Idempotency-Key': EVENT_ID,
          'X-Private-Balance-Event-Id': EVENT_ID,
        },
      }),
    )
  })

  describe('sin n8n configurado (integración desactivada)', () => {
    beforeEach(() => {
      delete process.env.N8N_AUTOMATION_WEBHOOK_URL
    })

    it.each([
      'income.created',
      'expense.created',
      'calendar.created',
      'service.completed',
    ] as const)(
      'trata %s como éxito sin llamar a n8n cuando falta N8N_AUTOMATION_WEBHOOK_URL',
      async (event) => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        const result = await dispatchWebhook({ event, eventId: EVENT_ID, payload: { event } })

        expect(fetchMock).not.toHaveBeenCalled()
        expect(result).toEqual({ status: 204, empty: true, successful: true })
      },
    )

    it('no deja pendiente ningún reintento: la respuesta es definitiva y exitosa', async () => {
      vi.stubGlobal('fetch', vi.fn())

      const result = await dispatchWebhook({
        event: 'income.created',
        eventId: EVENT_ID,
        payload: {},
      })

      expect(result.successful).toBe(true)
    })
  })

  describe('eventos de canal WhatsApp sin n8n configurado', () => {
    beforeEach(() => {
      delete process.env.N8N_WHATSAPP_WEBHOOK_URL
    })

    it('sigue fallando de forma explícita (no finge una conexión exitosa)', async () => {
      vi.stubGlobal('fetch', vi.fn())

      await expect(
        dispatchWebhook({
          event: 'device.whatsapp.connect.requested',
          eventId: EVENT_ID,
          payload: {},
        }),
      ).rejects.toThrow(/N8N_WHATSAPP_WEBHOOK_URL/)
    })
  })

  describe('aprovisionamiento de dispositivo sin n8n configurado', () => {
    beforeEach(() => {
      delete process.env.N8N_DEVICE_PROVISIONING_WEBHOOK_URL
    })

    it('sigue fallando de forma explícita (comportamiento sin cambios)', async () => {
      vi.stubGlobal('fetch', vi.fn())

      await expect(
        dispatchWebhook({
          event: 'device.provision.requested',
          eventId: EVENT_ID,
          payload: {},
        }),
      ).rejects.toThrow(/N8N_DEVICE_PROVISIONING_WEBHOOK_URL/)
    })
  })
})

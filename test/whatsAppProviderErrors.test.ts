import { describe, expect, it } from 'vitest'

import { assertProviderCapability } from '../server/automation/providers/whatsapp/capabilityGuard'
import {
  UnsupportedProviderCapabilityError,
  WhatsAppProviderUnavailableError,
  toWhatsAppProviderErrorBody,
} from '../server/automation/providers/whatsapp/errors'
import { EvolutionWhatsAppProvider } from '../server/automation/providers/whatsapp/EvolutionWhatsAppProvider'
import type { WhatsAppProvider, WhatsAppProviderCapabilities } from '../server/automation/providers/whatsapp/WhatsAppProvider'

function fakeProvider(capabilities: Partial<WhatsAppProviderCapabilities>): WhatsAppProvider {
  return {
    name: 'meta-cloud',
    getCapabilities: () => ({
      supportsQr: false,
      supportsPairingCode: false,
      supportsTemplates: false,
      supportsMessageStatus: false,
      supportsInboundWebhooks: false,
      supportsCoexistence: false,
      ...capabilities,
    }),
    dispatchChannelEvent: async () => {
      throw new Error('no usado en este test')
    },
  }
}

describe('assertProviderCapability', () => {
  it('no lanza cuando el proveedor sí admite la capacidad', () => {
    const provider = new EvolutionWhatsAppProvider()
    expect(() => assertProviderCapability(provider, 'supportsQr')).not.toThrow()
  })

  it('rechaza QR cuando el proveedor activo no admite esa capacidad, sin fingir compatibilidad', () => {
    const provider = fakeProvider({ supportsQr: false })
    expect(() => assertProviderCapability(provider, 'supportsQr'))
      .toThrow(UnsupportedProviderCapabilityError)
  })
})

describe('toWhatsAppProviderErrorBody', () => {
  it('expone solo code y message, sin URLs, tokens ni respuesta cruda del proveedor', () => {
    const error = new WhatsAppProviderUnavailableError('No se pudo contactar con el proveedor de WhatsApp.')
    const body = toWhatsAppProviderErrorBody(error, 'evolution')

    expect(body).toEqual({
      success: false,
      provider: 'evolution',
      error: {
        code: 'WHATSAPP_PROVIDER_UNAVAILABLE',
        message: 'No se pudo contactar con el proveedor de WhatsApp.',
      },
    })
    expect(Object.keys(body)).toEqual(['success', 'provider', 'error'])
  })
})

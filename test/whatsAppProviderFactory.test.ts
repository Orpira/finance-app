import { afterEach, describe, expect, it } from 'vitest'

import { getConfiguredWhatsAppProviderName } from '../server/automation/providers/whatsapp/config'
import { EvolutionWhatsAppProvider } from '../server/automation/providers/whatsapp/EvolutionWhatsAppProvider'
import {
  ProviderNotImplementedError,
  UnsupportedWhatsAppProviderError,
  WhatsAppProviderConfigurationError,
} from '../server/automation/providers/whatsapp/errors'
import {
  createWhatsAppProvider,
  resolveActiveWhatsAppProvider,
} from '../server/automation/providers/whatsapp/WhatsAppProviderFactory'
import type { WhatsAppProviderName } from '../server/automation/providers/whatsapp/WhatsAppProvider'

afterEach(() => {
  delete process.env.WHATSAPP_PROVIDER
})

describe('Configuración WHATSAPP_PROVIDER', () => {
  it('usa evolution por defecto cuando la variable no está definida', () => {
    expect(getConfiguredWhatsAppProviderName()).toBe('evolution')
  })

  it('acepta evolution explícito', () => {
    process.env.WHATSAPP_PROVIDER = 'evolution'
    expect(getConfiguredWhatsAppProviderName()).toBe('evolution')
  })

  it('acepta meta-cloud como valor válido aunque no esté implementado', () => {
    process.env.WHATSAPP_PROVIDER = 'meta-cloud'
    expect(getConfiguredWhatsAppProviderName()).toBe('meta-cloud')
  })

  it('rechaza un valor inválido sin caer en evolution por defecto', () => {
    process.env.WHATSAPP_PROVIDER = 'whatsapp-web-fake'
    expect(() => getConfiguredWhatsAppProviderName()).toThrow(WhatsAppProviderConfigurationError)
  })

  it('el mensaje de error no expone secretos, solo el valor inválido y las opciones', () => {
    process.env.WHATSAPP_PROVIDER = 'whatsapp-web-fake'
    try {
      getConfiguredWhatsAppProviderName()
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppProviderConfigurationError)
      expect((error as Error).message).toContain('whatsapp-web-fake')
      expect((error as Error).message).not.toMatch(/token|secret|bearer/i)
    }
  })
})

describe('WhatsAppProviderFactory', () => {
  it('resuelve evolution como EvolutionWhatsAppProvider', () => {
    const provider = createWhatsAppProvider('evolution')
    expect(provider).toBeInstanceOf(EvolutionWhatsAppProvider)
    expect(provider.name).toBe('evolution')
  })

  it('informa que meta-cloud no está implementado, sin hacer fallback a evolution', () => {
    expect(() => createWhatsAppProvider('meta-cloud')).toThrow(ProviderNotImplementedError)
  })

  it('rechaza un nombre de proveedor desconocido', () => {
    expect(() => createWhatsAppProvider('unknown-provider' as WhatsAppProviderName))
      .toThrow(UnsupportedWhatsAppProviderError)
  })

  it('resolveActiveWhatsAppProvider respeta WHATSAPP_PROVIDER sin fallback silencioso', () => {
    process.env.WHATSAPP_PROVIDER = 'meta-cloud'
    expect(() => resolveActiveWhatsAppProvider()).toThrow(ProviderNotImplementedError)
  })

  it('resolveActiveWhatsAppProvider usa evolution cuando la variable está ausente', () => {
    expect(resolveActiveWhatsAppProvider()).toBeInstanceOf(EvolutionWhatsAppProvider)
  })
})

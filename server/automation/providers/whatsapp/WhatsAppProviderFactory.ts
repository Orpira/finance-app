import { getConfiguredWhatsAppProviderName } from './config.js'
import { EvolutionWhatsAppProvider } from './EvolutionWhatsAppProvider.js'
import { MetaCloudWhatsAppProvider } from './MetaCloudWhatsAppProvider.js'
import { UnsupportedWhatsAppProviderError } from './errors.js'
import type { WhatsAppProvider, WhatsAppProviderName } from './WhatsAppProvider.js'

export function createWhatsAppProvider(providerName: WhatsAppProviderName): WhatsAppProvider {
  switch (providerName) {
    case 'evolution':
      return new EvolutionWhatsAppProvider()
    case 'meta-cloud':
      return new MetaCloudWhatsAppProvider()
    default:
      throw new UnsupportedWhatsAppProviderError(providerName)
  }
}

export function resolveActiveWhatsAppProvider(): WhatsAppProvider {
  return createWhatsAppProvider(getConfiguredWhatsAppProviderName())
}

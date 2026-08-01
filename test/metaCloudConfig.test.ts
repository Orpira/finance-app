import { afterEach, describe, expect, it } from 'vitest'

import { getMetaCloudConfig } from '../server/communication/config/metaCloudConfig'
import { CommunicationConfigurationError } from '../server/communication/errors/communicationErrors'

const META_ENV_KEYS = [
  'WHATSAPP_CLOUD_ENABLED', 'WHATSAPP_CLOUD_ALLOW_REAL_SEND', 'WHATSAPP_CLOUD_WEBHOOK_ENABLED',
  'WHATSAPP_CLOUD_FORWARD_INBOUND_TO_N8N', 'META_APP_ID', 'META_APP_SECRET', 'META_ACCESS_TOKEN',
  'META_VERIFY_TOKEN', 'META_WABA_ID', 'META_PHONE_NUMBER_ID', 'META_GRAPH_API_VERSION',
  'N8N_COMMUNICATION_API_KEY', 'WHATSAPP_MESSAGE_RETENTION_DAYS', 'WHATSAPP_IDEMPOTENCY_RETENTION_DAYS',
  'VERCEL_ENV',
]

function setFullValidConfig() {
  process.env.WHATSAPP_CLOUD_ENABLED = 'true'
  process.env.META_APP_SECRET = 'app-secret'
  process.env.META_ACCESS_TOKEN = 'access-token'
  process.env.META_VERIFY_TOKEN = 'verify-token'
  process.env.META_PHONE_NUMBER_ID = '1234567890'
  process.env.META_GRAPH_API_VERSION = 'v21.0'
  process.env.N8N_COMMUNICATION_API_KEY = 'n8n-key'
}

afterEach(() => {
  for (const key of META_ENV_KEYS) delete process.env[key]
})

describe('getMetaCloudConfig — deshabilitado', () => {
  it('no exige ninguna variable Meta cuando WHATSAPP_CLOUD_ENABLED está ausente', () => {
    const config = getMetaCloudConfig()
    expect(config.enabled).toBe(false)
  })

  it('no exige ninguna variable Meta cuando WHATSAPP_CLOUD_ENABLED=false', () => {
    process.env.WHATSAPP_CLOUD_ENABLED = 'false'
    expect(() => getMetaCloudConfig()).not.toThrow()
    expect(getMetaCloudConfig().enabled).toBe(false)
  })

  it('allowRealSend es false por defecto', () => {
    expect(getMetaCloudConfig().allowRealSend).toBe(false)
  })
})

describe('getMetaCloudConfig — habilitado', () => {
  it('expone todas las variables cuando la configuración está completa', () => {
    setFullValidConfig()
    const config = getMetaCloudConfig()
    expect(config.enabled).toBe(true)
    if (!config.enabled) throw new Error('unreachable')
    expect(config.phoneNumberId).toBe('1234567890')
    expect(config.graphApiVersion).toBe('v21.0')
    expect(config.n8nCommunicationApiKey).toBe('n8n-key')
  })

  it.each([
    'META_APP_SECRET', 'META_ACCESS_TOKEN', 'META_VERIFY_TOKEN',
    'META_PHONE_NUMBER_ID', 'META_GRAPH_API_VERSION', 'N8N_COMMUNICATION_API_KEY',
  ])('rechaza la configuración si falta %s', (missingKey) => {
    setFullValidConfig()
    delete process.env[missingKey]
    expect(() => getMetaCloudConfig()).toThrow(CommunicationConfigurationError)
  })

  it('el mensaje de error nombra la variable faltante sin exponer las presentes', () => {
    setFullValidConfig()
    delete process.env.META_ACCESS_TOKEN
    try {
      getMetaCloudConfig()
      expect.unreachable()
    } catch (error) {
      expect((error as Error).message).toContain('META_ACCESS_TOKEN')
      expect((error as Error).message).not.toContain('app-secret')
      expect((error as Error).message).not.toContain('verify-token')
    }
  })

  it('rechaza META_GRAPH_API_VERSION="latest" en producción (VERCEL_ENV=production)', () => {
    setFullValidConfig()
    process.env.META_GRAPH_API_VERSION = 'latest'
    process.env.VERCEL_ENV = 'production'
    expect(() => getMetaCloudConfig()).toThrow(CommunicationConfigurationError)
  })

  it('permite META_GRAPH_API_VERSION="latest" fuera de producción', () => {
    setFullValidConfig()
    process.env.META_GRAPH_API_VERSION = 'latest'
    expect(() => getMetaCloudConfig()).not.toThrow()
  })

  it('retención por defecto: idempotencia 30 días, mensajes 0 días', () => {
    setFullValidConfig()
    const config = getMetaCloudConfig()
    expect(config.idempotencyRetentionDays).toBe(30)
    expect(config.messageRetentionDays).toBe(0)
  })
})

describe('getMetaCloudConfig — parseo estricto de booleanos', () => {
  it('WHATSAPP_CLOUD_ALLOW_REAL_SEND="true" produce allowRealSend=true', () => {
    setFullValidConfig()
    process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND = 'true'
    expect(getMetaCloudConfig().allowRealSend).toBe(true)
  })

  it('WHATSAPP_CLOUD_ALLOW_REAL_SEND="false" produce allowRealSend=false', () => {
    setFullValidConfig()
    process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND = 'false'
    expect(getMetaCloudConfig().allowRealSend).toBe(false)
  })

  it('acepta "TRUE"/"False" sin distinguir mayúsculas', () => {
    setFullValidConfig()
    process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND = 'TRUE'
    expect(getMetaCloudConfig().allowRealSend).toBe(true)
    process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND = 'False'
    expect(getMetaCloudConfig().allowRealSend).toBe(false)
  })

  it('tolera espacios en blanco alrededor del valor', () => {
    setFullValidConfig()
    process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND = '  true  '
    expect(getMetaCloudConfig().allowRealSend).toBe(true)
  })

  it.each(['1', 'yes', '0', 'no', 'TRUE1', 'verdadero', ' '])(
    'rechaza explícitamente un valor no reconocido (%s) en vez de degradar a false en silencio',
    (invalidValue) => {
      setFullValidConfig()
      process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND = invalidValue
      if (invalidValue.trim() === '') {
        // Cadena vacía tras trim se trata como "ausente": usa el valor por defecto.
        expect(getMetaCloudConfig().allowRealSend).toBe(false)
        return
      }
      expect(() => getMetaCloudConfig()).toThrow(CommunicationConfigurationError)
    },
  )

  it('un valor no reconocido de WHATSAPP_CLOUD_ENABLED también falla explícitamente', () => {
    process.env.WHATSAPP_CLOUD_ENABLED = 'enabled'
    expect(() => getMetaCloudConfig()).toThrow(CommunicationConfigurationError)
  })

  it('la ausencia de WHATSAPP_CLOUD_ALLOW_REAL_SEND usa el valor por defecto (false) sin lanzar', () => {
    setFullValidConfig()
    delete process.env.WHATSAPP_CLOUD_ALLOW_REAL_SEND
    expect(() => getMetaCloudConfig()).not.toThrow()
    expect(getMetaCloudConfig().allowRealSend).toBe(false)
  })
})

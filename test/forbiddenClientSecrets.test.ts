import { describe, expect, it } from 'vitest'

import { findExposedClientSecrets } from '../src/config/forbiddenClientSecrets'

describe('findExposedClientSecrets', () => {
  it('bloquea VITE_OPENAI_API_KEY explícita', () => {
    expect(findExposedClientSecrets({ VITE_OPENAI_API_KEY: 'sk-real-key' })).toEqual([
      'VITE_OPENAI_API_KEY',
    ])
  })

  it('bloquea cualquier VITE_OPENAI_*_KEY/SECRET/TOKEN futura por patrón', () => {
    expect(
      findExposedClientSecrets({
        VITE_OPENAI_ORG_SECRET: 'x',
        VITE_OPENAI_REFRESH_TOKEN: 'y',
        VITE_OPENAI_SESSION_KEY: 'z',
      }),
    ).toEqual(['VITE_OPENAI_ORG_SECRET', 'VITE_OPENAI_REFRESH_TOKEN', 'VITE_OPENAI_SESSION_KEY'])
  })

  it('no bloquea configuración no sensible de OpenAI', () => {
    expect(
      findExposedClientSecrets({
        VITE_AI_PROVIDER: 'openai',
        VITE_AI_OPENAI_MODEL: 'gpt-4o-mini',
        VITE_OPENAI_TIMEOUT_MS: '12000',
        VITE_OPENAI_BASE_URL: 'https://api.openai.com/v1',
      }),
    ).toEqual([])
  })

  it('sigue bloqueando Meta/n8n/Evolution (comportamiento histórico)', () => {
    expect(
      findExposedClientSecrets({
        VITE_META_ACCESS_TOKEN: 'a',
        VITE_N8N_WEBHOOK_URL: 'b',
        VITE_EVOLUTION_API_KEY: 'c',
        VITE_PRIVATE_BALANCE_TOKEN: 'd',
      }),
    ).toEqual([
      'VITE_META_ACCESS_TOKEN',
      'VITE_N8N_WEBHOOK_URL',
      'VITE_EVOLUTION_API_KEY',
      'VITE_PRIVATE_BALANCE_TOKEN',
    ])
  })

  it('ignora variables vacías', () => {
    expect(findExposedClientSecrets({ VITE_OPENAI_API_KEY: '' })).toEqual([])
  })

  it('no reporta variables públicas normales', () => {
    expect(
      findExposedClientSecrets({
        VITE_API_BASE_URL: 'https://example.com',
        VITE_NEON_AUTH_URL: 'https://example.com/auth',
      }),
    ).toEqual([])
  })
})

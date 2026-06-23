import { Capacitor } from '@capacitor/core'

export interface PlayIntegrityResult {
  available: boolean
  passed: boolean
  reason?: string
}

export interface RuntimeIntegrityResult {
  platform: 'android' | 'ios' | 'web'
  isNative: boolean
  isAndroid: boolean
  playIntegrity: PlayIntegrityResult
}

export async function checkPlayIntegrity(): Promise<PlayIntegrityResult> {
  if (!Capacitor.isNativePlatform()) {
    return {
      available: false,
      passed: true,
      reason: 'Play Integrity no está disponible en web/PWA.',
    }
  }

  if (Capacitor.getPlatform() !== 'android') {
    return {
      available: false,
      passed: true,
      reason: 'Play Integrity solo aplica a Android.',
    }
  }

  return {
    available: false,
    passed: true,
    reason:
      'Play Integrity está preparado, pero requiere backend y nonce firmado para validación fuerte.',
  }
}

export async function getRuntimeIntegrityStatus(): Promise<RuntimeIntegrityResult> {
  const platform = Capacitor.getPlatform() as RuntimeIntegrityResult['platform']

  return {
    platform,
    isNative: Capacitor.isNativePlatform(),
    isAndroid: platform === 'android',
    playIntegrity: await checkPlayIntegrity(),
  }
}

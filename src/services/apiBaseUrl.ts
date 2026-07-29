import { Capacitor } from '@capacitor/core'

function isLocalDevelopmentUrl(url: URL) {
  return url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

// Resuelve la base de la API contra la que hablan TODOS los endpoints de
// licencias/trial. Que exista un único lugar que decida esto evita que dos
// llamadas del mismo flujo (p.ej. trial-start y license-activate) terminen
// apuntando a entornos distintos por divergencia entre implementaciones.
export function getPrivateBalanceApiUrl(path: string): string {
  const configuredApiUrl =
    typeof import.meta.env.VITE_API_BASE_URL === 'string'
      ? import.meta.env.VITE_API_BASE_URL.trim()
      : ''
  const runtimeOrigin = new URL(globalThis.location.origin)
  const shouldUseConfiguredApi =
    Capacitor.isNativePlatform() || isLocalDevelopmentUrl(runtimeOrigin)
  const baseUrl = shouldUseConfiguredApi
    ? configuredApiUrl || runtimeOrigin.href
    : runtimeOrigin.href

  return `${baseUrl.replace(/\/$/, '')}${path}`
}

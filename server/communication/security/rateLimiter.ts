/**
 * Limitador de tasa en memoria de proceso, aplicado a intentos de
 * autenticación fallidos contra el backend de comunicaciones.
 *
 * Limitación conocida: en Vercel serverless cada instancia fría arranca con
 * el contador vacío, así que esto NO es un límite distribuido ni resistente
 * a reintentos desde múltiples instancias en paralelo. Es una capa de
 * defensa en profundidad adicional a la comparación de clave en tiempo
 * constante, no el mecanismo principal de protección. La mitigación real en
 * producción debe aplicarse a nivel de borde (firewall/WAF de Vercel). Ver
 * docs/whatsapp/meta-cloud-security.md.
 */

interface WindowState {
  count: number
  windowStartedAt: number
}

const attemptsByKey = new Map<string, WindowState>()

export interface RateLimitOptions {
  windowMs: number
  maxAttempts: number
}

export function isRateLimited(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): boolean {
  const state = attemptsByKey.get(key)
  if (!state || now - state.windowStartedAt > options.windowMs) {
    return false
  }
  return state.count >= options.maxAttempts
}

export function registerAttempt(
  key: string,
  options: RateLimitOptions,
  now: number = Date.now(),
): void {
  const state = attemptsByKey.get(key)
  if (!state || now - state.windowStartedAt > options.windowMs) {
    attemptsByKey.set(key, { count: 1, windowStartedAt: now })
    return
  }
  state.count += 1
}

export function resetRateLimiter(): void {
  attemptsByKey.clear()
}

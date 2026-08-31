/**
 * ADR-034 Fase 1.5 §26-27 — al tocar una notificación Android solo se permite navegar a una ruta
 * interna de la app. Nunca a un esquema arbitrario (`javascript:`, `data:`) ni a una URL externa.
 */
const INTERNAL_DESTINATION_PATTERN = /^\/[a-zA-Z0-9\-_/.]*(?:\?[a-zA-Z0-9\-_.=&%]*)?$/

export function isValidInternalDestination(destination: unknown): destination is string {
  if (typeof destination !== 'string' || destination.length === 0) return false
  if (destination.startsWith('//')) return false
  return INTERNAL_DESTINATION_PATTERN.test(destination)
}

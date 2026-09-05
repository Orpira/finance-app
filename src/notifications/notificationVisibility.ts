import type { NotificationSource } from './types'

/**
 * Fase 1 (ADR-034 §30) solo genera notificaciones de agenda/temporada
 * mientras el contexto activo es profesional — `runNotificationEvaluation`
 * corta toda evaluación de estas reglas con `usesProfessionalAgenda`
 * (notificationEvaluationRunner.ts). Por construcción, hoy TODA notificación
 * de estas fuentes es exclusivamente profesional; no existe ninguna regla
 * que emita 'financial'/'security'/'system'/'copilot' todavía.
 *
 * Las notificaciones no persisten su propio contexto (auditado en el
 * Bloque 3 de la especificación de modos de uso): en vez de una migración
 * de esquema, se filtran en lectura por `source`, que ya es 100% preciso
 * para las reglas existentes. Si se añade una notificación 'goal' para el
 * espacio Personal (metas independientes por contexto), esta lista debe
 * revisarse junto con el punto de generación en notificationEvaluationRunner.ts.
 */
const PROFESSIONAL_ONLY_NOTIFICATION_SOURCES: ReadonlySet<NotificationSource> = new Set([
  'agenda',
  'season',
  'goal',
])

export function isNotificationSourceVisibleInContext(
  source: NotificationSource,
  activeContext: 'basic' | 'professional',
): boolean {
  if (activeContext === 'professional') return true
  return !PROFESSIONAL_ONLY_NOTIFICATION_SOURCES.has(source)
}

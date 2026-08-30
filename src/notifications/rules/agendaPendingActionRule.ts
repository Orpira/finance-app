import { listAppointments } from '../../services/appointmentService'
import type { NotificationCandidate } from '../types'

/**
 * ADR-034 Fase 1 §4/§25 — "Acciones pendientes reales" en Agenda: citas cuya hora ya pasó
 * y siguen sin marcarse como completadas. Deliberadamente distinto de reminderService.ts
 * (que ya cubre "tu cita es en X minutos" vía Capacitor Local Notifications / alertas
 * in-app) para no duplicar esa alarma — esta regla mira hacia atrás, no hacia adelante.
 */
export async function buildAgendaPendingActionCandidate(now = new Date()): Promise<NotificationCandidate | null> {
  const overdue = await listAppointments({ to: now.toISOString(), completed: false })
  if (overdue.length === 0) return null

  return {
    type: 'AGENDA_PENDING_ACTION',
    priority: 'P2',
    source: 'agenda',
    title: 'Citas pendientes de confirmar',
    message:
      overdue.length === 1
        ? 'Tienes una cita pasada pendiente de marcar como completada.'
        : `Tienes ${overdue.length} citas pasadas pendientes de marcar como completadas.`,
    dedupKey: 'agenda-pending-action',
    action: { label: 'Ver Agenda', destination: '/agenda' },
    privacy: 'generic',
    revalidate: async () => {
      const stillOverdue = await listAppointments({ to: new Date().toISOString(), completed: false })
      return stillOverdue.length > 0
    },
  }
}

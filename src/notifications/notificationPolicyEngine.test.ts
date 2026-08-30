import { describe, expect, it } from 'vitest'

import { evaluateNotificationCandidate } from './notificationPolicyEngine'
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationDefaults'
import type {
  CopilotNotification,
  NotificationCandidate,
  NotificationPolicyContext,
  NotificationPreferences,
} from './types'

const NOW = new Date('2026-08-30T12:00:00.000Z')

function candidate(overrides: Partial<NotificationCandidate> = {}): NotificationCandidate {
  return {
    type: 'SEASON_GOAL_RISK',
    priority: 'P2',
    source: 'goal',
    title: 'Meta de temporada',
    message: 'Con el ritmo actual, la proyección está por debajo de la Meta de temporada.',
    dedupKey: 'season-goal-risk:1',
    cooldownMs: 24 * 60 * 60 * 1000,
    ...overrides,
  }
}

function context(overrides: Partial<NotificationPolicyContext> = {}): NotificationPolicyContext {
  return {
    now: NOW,
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    activeByDedupKey: undefined,
    deliveredTodayForPriority: 0,
    deliveredTodayNonCritical: 0,
    ...overrides,
  }
}

function preferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...overrides }
}

function existingNotification(overrides: Partial<CopilotNotification> = {}): CopilotNotification {
  return {
    id: 'existing-1',
    type: 'SEASON_GOAL_RISK',
    priority: 'P2',
    source: 'goal',
    title: 'Meta de temporada',
    message: 'Con el ritmo actual...',
    dedupKey: 'season-goal-risk:1',
    createdAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString(),
    status: 'new',
    privacy: 'generic',
    ...overrides,
  }
}

describe('evaluateNotificationCandidate — ADR-034 Notification Policy Engine', () => {
  it('1. entrega un candidato válido', async () => {
    const decision = await evaluateNotificationCandidate(candidate(), context())
    expect(decision.decision).toBe('deliver')
    if (decision.decision === 'deliver') {
      expect(decision.notification.status).toBe('new')
      expect(decision.notification.dedupKey).toBe('season-goal-risk:1')
    }
  })

  it('2. suprime si el interruptor general está desactivado', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate(),
      context({ preferences: preferences({ copilotNotificationsEnabled: false }) }),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'disabled' })
  })

  it('3. suprime si la categoría está desactivada', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate(),
      context({ preferences: preferences({ financialInsightsEnabled: false }) }),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'category_disabled' })
  })

  it('4. suprime un candidato expirado', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ expiresAt: new Date(NOW.getTime() - 1000).toISOString() }),
      context(),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'expired' })
  })

  it('5. suprime P1 sin action', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ priority: 'P1', type: 'SEASON_ENDING' }),
      context(),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'invalid_action' })
  })

  it('entrega P1 cuando sí tiene action', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ priority: 'P1', action: { label: 'Ver temporada', destination: '/temporadas/1' } }),
      context(),
    )
    expect(decision.decision).toBe('deliver')
  })

  it('6. suprime por baja confianza', async () => {
    const decision = await evaluateNotificationCandidate(candidate({ confidence: 0.5 }), context())
    expect(decision).toEqual({ decision: 'suppress', reason: 'low_confidence' })
  })

  it('entrega con confianza suficiente', async () => {
    const decision = await evaluateNotificationCandidate(candidate({ confidence: 0.9 }), context())
    expect(decision.decision).toBe('deliver')
  })

  it('7. suprime duplicado (misma dedupKey aún sin resolver)', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate(),
      context({ activeByDedupKey: existingNotification({ status: 'seen' }) }),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'duplicate' })
  })

  it('8. suprime durante cooldown (dismissed pero dentro de la ventana)', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate(),
      context({
        activeByDedupKey: existingNotification({
          status: 'dismissed',
          cooldownUntil: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
        }),
      }),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'cooldown' })
  })

  it('permite una nueva notificación una vez pasado el cooldown', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate(),
      context({
        activeByDedupKey: existingNotification({
          status: 'dismissed',
          cooldownUntil: new Date(NOW.getTime() - 1000).toISOString(),
        }),
      }),
    )
    expect(decision.decision).toBe('deliver')
  })

  it('9a. suprime si se alcanzó el límite de frecuencia por prioridad', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ priority: 'P2' }),
      context({ deliveredTodayForPriority: 2 }),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'frequency_limit' })
  })

  it('9b. suprime si se alcanzó el límite no-crítico global (5/día)', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ priority: 'P2' }),
      context({ deliveredTodayForPriority: 0, deliveredTodayNonCritical: 5 }),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'frequency_limit' })
  })

  it('P0 nunca se suprime por límite de frecuencia', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ priority: 'P0', type: 'SECURITY_INTEGRITY', source: 'security' }),
      context({ deliveredTodayForPriority: 999, deliveredTodayNonCritical: 999 }),
    )
    expect(decision.decision).toBe('deliver')
  })

  it('10. aplaza (defer) en horario silencioso', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate(),
      context({
        now: new Date('2026-08-30T23:30:00.000Z'),
        preferences: preferences({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00' }),
      }),
    )
    expect(decision).toEqual({ decision: 'defer', reason: 'quiet_hours' })
  })

  it('11. P0 se entrega igualmente durante el horario silencioso', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ priority: 'P0', type: 'SECURITY_INTEGRITY', source: 'security' }),
      context({
        now: new Date('2026-08-30T23:30:00.000Z'),
        preferences: preferences({ quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00' }),
      }),
    )
    expect(decision.decision).toBe('deliver')
  })

  it('12. suprime un candidato obsoleto detectado por revalidate()', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ revalidate: () => false }),
      context(),
    )
    expect(decision).toEqual({ decision: 'suppress', reason: 'stale' })
  })

  it('13. entrega si revalidate() confirma que sigue vigente', async () => {
    const decision = await evaluateNotificationCandidate(
      candidate({ revalidate: async () => true }),
      context(),
    )
    expect(decision.decision).toBe('deliver')
  })

  it('ADR-034 §14 — "Meta en riesgo" seguido de un ingreso que la resuelve: revalidate cancela el aviso', async () => {
    let seasonStillAtRisk = true
    const dynamicCandidate = candidate({ revalidate: () => seasonStillAtRisk })

    const first = await evaluateNotificationCandidate(dynamicCandidate, context())
    expect(first.decision).toBe('deliver')

    seasonStillAtRisk = false
    const second = await evaluateNotificationCandidate(dynamicCandidate, context())
    expect(second).toEqual({ decision: 'suppress', reason: 'stale' })
  })

  it('usa el id inyectado vía options.createId', async () => {
    const decision = await evaluateNotificationCandidate(candidate(), context(), {
      createId: () => 'fixed-id',
    })
    expect(decision.decision).toBe('deliver')
    if (decision.decision === 'deliver') {
      expect(decision.notification.id).toBe('fixed-id')
    }
  })
})

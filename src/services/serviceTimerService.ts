import { db } from '../database/db'
import type { ServiceIncome, ServiceTimerStatus } from '../types/service'
import { isServiceIncome } from '../utils/incomeTypes'
import { calculateEffectiveDuration } from '../utils/serviceDuration'
import {
  createAutomationOutboxRecord,
  enqueueAutomationEvent,
  scheduleAutomationOutboxFlush,
} from './automationOutboxService'
import { getOrCreateDeviceIdentity } from './deviceIdentityService'
import { notifyServiceCompleted } from './serviceTimerNotificationService'

const ACTIVE_TIMER_STATUSES: ServiceTimerStatus[] = ['pending', 'running']

function isValidDate(value: string | undefined) {
  return Boolean(value) && !Number.isNaN(Date.parse(value as string))
}

function addMinutes(isoDate: string, minutes: number) {
  return new Date(new Date(isoDate).getTime() + minutes * 60_000).toISOString()
}

function resolveTimerStartAt(input: Pick<ServiceIncome, 'createdAt' | 'timerStartedAt'>, nowIso: string) {
  if (isValidDate(input.timerStartedAt)) return input.timerStartedAt as string
  if (isValidDate(input.createdAt)) return input.createdAt as string
  return nowIso
}

export function buildInitialServiceTimerState(
  income: Pick<ServiceIncome, 'type' | 'duration' | 'durationLabel' | 'createdAt' | 'timerStartedAt'>,
  nowIso = new Date().toISOString(),
) {
  if (!isServiceIncome(income)) return {}

  const effectiveDuration = calculateEffectiveDuration(income)
  if (effectiveDuration <= 0) return {}

  const timerStartedAt = resolveTimerStartAt(income, nowIso)

  return {
    timerStatus: 'running' as const,
    timerStartedAt,
    timerEndsAt: addMinutes(timerStartedAt, effectiveDuration),
  }
}

export function isServiceTimerDue(income: Pick<ServiceIncome, 'timerStatus' | 'timerEndsAt'>, now = new Date()) {
  if (!income.timerEndsAt || !ACTIVE_TIMER_STATUSES.includes((income.timerStatus ?? 'running') as ServiceTimerStatus)) {
    return false
  }

  const timerEndTime = Date.parse(income.timerEndsAt)
  if (Number.isNaN(timerEndTime)) return false

  return timerEndTime <= now.getTime()
}

async function hasConnectedWhatsAppChannel() {
  const channel = await db.communicationChannels.get('whatsapp')
  return channel?.status === 'connected'
}

function buildServiceCompletedPayload(income: ServiceIncome, completedAt: string, effectiveDuration: number) {
  return {
    message: '✅ Servicio Finalizado',
    income: {
      id: income.id,
      date: income.date,
      completedAt,
      duration: effectiveDuration,
      durationLabel: income.durationLabel,
      totalAmount: income.totalAmount,
      currency: income.currency,
      city: income.city,
      paymentType: income.paymentType,
      notes: income.notes,
    },
  }
}

export async function listTrackedServiceIncomes() {
  const trackedStatuses = new Set<ServiceTimerStatus>([
    'pending',
    'running',
    'completed',
    'notified',
  ])

  return db.services
    .where('timerStatus')
    .anyOf(Array.from(trackedStatuses))
    .toArray()
}

export async function markServiceTimerCompleted(incomeId: number, completedAt = new Date()) {
  const income = await db.services.get(incomeId)
  if (!income || !income.id) return null

  const currentStatus = income.timerStatus
  if (!currentStatus || !ACTIVE_TIMER_STATUSES.includes(currentStatus)) {
    return income
  }

  const completedAtIso = completedAt.toISOString()
  const effectiveDuration = calculateEffectiveDuration(income)

  await db.services.update(income.id, {
    timerStatus: 'completed',
    timerCompletedAt: completedAtIso,
    timerStoppedAt: income.timerStoppedAt ?? completedAtIso,
    actualDuration: income.actualDuration ?? effectiveDuration,
  })

  let updatedIncome = await db.services.get(income.id)
  if (!updatedIncome) return null

  const canNotifyWhatsApp = await hasConnectedWhatsAppChannel()
  if (canNotifyWhatsApp && !updatedIncome.whatsappNotifiedAt) {
    const identity = await getOrCreateDeviceIdentity()
    const notifiedAt = new Date().toISOString()

    await enqueueAutomationEvent(
      createAutomationOutboxRecord('service.completed', {
        userCode: identity.userCode,
        deviceCode: identity.deviceCode,
        ...buildServiceCompletedPayload(updatedIncome, completedAtIso, effectiveDuration),
      }),
    )
    scheduleAutomationOutboxFlush()

    await db.services.update(income.id, {
      timerStatus: 'notified',
      whatsappNotifiedAt: notifiedAt,
    })
    updatedIncome = await db.services.get(income.id)
  }

  if (updatedIncome) {
    void notifyServiceCompleted(updatedIncome)
  }

  return updatedIncome
}

export async function dismissServiceTimer(incomeId: number) {
  const income = await db.services.get(incomeId)
  if (!income || !income.id) return null

  await db.services.update(income.id, {
    timerStatus: 'dismissed',
  })

  return db.services.get(income.id)
}
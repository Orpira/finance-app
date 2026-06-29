import { db } from '../database/db'
import type {
  AutomationOutboxRecord,
  PrivateBalanceEvent,
} from '../types/automation'
import { sendAutomationEvent } from './automationHubService'

const MAX_BATCH_SIZE = 20
const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1000
const BASE_RETRY_DELAY_MS = 15_000

let flushPromise: Promise<void> | undefined
let scheduledFlushId: number | undefined
let initialized = false

function createEventId() {
  if (typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0'))

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-')
}

function retryDelay(attempts: number) {
  const exponentialDelay = BASE_RETRY_DELAY_MS * 2 ** Math.min(attempts, 12)
  const jitter = Math.floor(Math.random() * 5_000)

  return Math.min(exponentialDelay + jitter, MAX_RETRY_DELAY_MS)
}

export function createAutomationOutboxRecord(
  event: PrivateBalanceEvent,
  data: Record<string, unknown>,
): AutomationOutboxRecord {
  const now = new Date().toISOString()

  return {
    eventId: createEventId(),
    event,
    createdAt: now,
    schemaVersion: 1,
    data,
    attempts: 0,
    nextAttemptAt: now,
  }
}

export function enqueueAutomationEvent(record: AutomationOutboxRecord) {
  return db.automationOutbox.add(record)
}

function scheduleNextFlush(delayMs = 0) {
  if (scheduledFlushId !== undefined) {
    globalThis.clearTimeout(scheduledFlushId)
  }

  scheduledFlushId = globalThis.setTimeout(() => {
    scheduledFlushId = undefined
    void flushAutomationOutbox()
  }, delayMs)
}

async function flushDueEvents() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return
  }

  const now = new Date().toISOString()
  const pendingEvents = await db.automationOutbox
    .where('nextAttemptAt')
    .belowOrEqual(now)
    .limit(MAX_BATCH_SIZE)
    .toArray()

  for (const pendingEvent of pendingEvents) {
    const result = await sendAutomationEvent(pendingEvent)

    if (result.delivered) {
      await db.automationOutbox.delete(pendingEvent.eventId)
      if (pendingEvent.event === 'device.provision.requested') {
        const identity = await db.deviceIdentity.get('current')
        if (identity?.deviceCode === pendingEvent.data.deviceCode) {
          const now = new Date().toISOString()
          await db.deviceIdentity.update('current', {
            provisioningStatus: 'provisioned',
            provisionedAt: now,
            lastProvisioningError: undefined,
            updatedAt: now,
          })
          if (import.meta.env.DEV) {
            console.info('[Private Balance] Evento provisioning enviado')
          }
        }
      }
      continue
    }

    const attempts = pendingEvent.attempts + 1
    const attemptedAt = new Date()
    await db.automationOutbox.update(pendingEvent.eventId, {
      attempts,
      lastAttemptAt: attemptedAt.toISOString(),
      lastError: result.error?.slice(0, 300),
      nextAttemptAt: new Date(
        attemptedAt.getTime() + retryDelay(attempts),
      ).toISOString(),
    })
    if (pendingEvent.event === 'device.provision.requested') {
      const identity = await db.deviceIdentity.get('current')
      if (identity?.deviceCode === pendingEvent.data.deviceCode) {
        await db.deviceIdentity.update('current', {
          provisioningStatus: 'error',
          lastProvisioningError: result.error?.slice(0, 300),
          updatedAt: attemptedAt.toISOString(),
        })
      }
    }
  }

  const nextEvent = await db.automationOutbox.orderBy('nextAttemptAt').first()
  if (nextEvent) {
    const delay = Math.max(
      1_000,
      new Date(nextEvent.nextAttemptAt).getTime() - Date.now(),
    )
    scheduleNextFlush(Math.min(delay, MAX_RETRY_DELAY_MS))
  }
}

export function flushAutomationOutbox() {
  if (!flushPromise) {
    flushPromise = flushDueEvents().finally(() => {
      flushPromise = undefined
    })
  }

  return flushPromise
}

export function scheduleAutomationOutboxFlush() {
  scheduleNextFlush(0)
}

export function initializeAutomationOutbox() {
  if (initialized) return
  initialized = true

  globalThis.addEventListener('online', scheduleAutomationOutboxFlush)
  scheduleAutomationOutboxFlush()
}

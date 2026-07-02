import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'
import { Preferences } from '@capacitor/preferences'

import { db } from '../database/db'
import type {
  DeviceIdentity,
  DeviceIdentityPlatform,
} from '../types/deviceIdentity'
import { sendAutomationEvent } from './automationHubService'
import {
  createAutomationOutboxRecord,
  enqueueAutomationEvent,
  scheduleAutomationOutboxFlush,
} from './automationOutboxService'

const DEVICE_IDENTITY_ID = 'current' as const
const DEVICE_IDENTITY_STORAGE_KEY = 'privateBalance.deviceIdentity'
const INDEXED_DB_TIMEOUT_MS = 2_000

let identityRequest: Promise<DeviceIdentity> | undefined
let provisioningRequest: Promise<DeviceIdentity> | undefined

function createSecureUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  if (typeof globalThis.crypto?.getRandomValues !== 'function') {
    throw new Error('Este dispositivo no ofrece generación aleatoria segura.')
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

function getPlatform(): DeviceIdentityPlatform {
  const platform = Capacitor.getPlatform()
  return platform === 'web' || platform === 'android' || platform === 'ios'
    ? platform
    : 'unknown'
}

async function getRuntimeMetadata() {
  const platform = getPlatform()
  let deviceName: string | undefined
  let appVersion: string | undefined

  try {
    const info = await Device.getInfo()
    deviceName = info.name?.trim() || (platform !== 'web' ? info.model.trim() : undefined)
  } catch {
    // Optional metadata must never prevent identity creation.
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const info = await App.getInfo()
      appVersion = info.version.trim() || undefined
    } catch {
      // Optional metadata must never prevent identity creation.
    }
  }

  return { platform, deviceName, appVersion }
}

function logDevelopment(message: string, identity: DeviceIdentity) {
  if (import.meta.env.DEV) {
    console.info(`[Private Balance] ${message}`, {
      userCode: identity.userCode,
      deviceCode: identity.deviceCode,
      platform: identity.platform,
    })
  }
}

function isDeviceIdentity(value: unknown): value is DeviceIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const identity = value as Partial<DeviceIdentity>
  return identity.id === DEVICE_IDENTITY_ID &&
    typeof identity.userCode === 'string' && identity.userCode.startsWith('PB-USER-') &&
    typeof identity.deviceCode === 'string' && identity.deviceCode.length > 0 &&
    ['web', 'android', 'ios', 'unknown'].includes(identity.platform ?? '') &&
    typeof identity.createdAt === 'string' &&
    typeof identity.updatedAt === 'string'
}

function readLocalStorageIdentity() {
  try {
    const value = globalThis.localStorage?.getItem(DEVICE_IDENTITY_STORAGE_KEY)
    if (!value) return null

    const parsed = JSON.parse(value) as unknown
    return isDeviceIdentity(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function readPreferencesIdentity() {
  if (!Capacitor.isNativePlatform()) return null

  try {
    const { value } = await Preferences.get({ key: DEVICE_IDENTITY_STORAGE_KEY })
    if (!value) return null

    const parsed = JSON.parse(value) as unknown
    return isDeviceIdentity(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function readIndexedDbIdentity() {
  try {
    const identity = await withTimeout(
      db.deviceIdentity.get(DEVICE_IDENTITY_ID),
      INDEXED_DB_TIMEOUT_MS,
    )
    return isDeviceIdentity(identity) ? identity : null
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(
      () => reject(new Error('IndexedDB no respondió a tiempo.')),
      timeoutMs,
    )

    promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId)
        resolve(value)
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId)
        reject(error)
      },
    )
  })
}

async function persistIdentityCopies(identity: DeviceIdentity) {
  const serialized = JSON.stringify(identity)
  let persisted = false

  try {
    globalThis.localStorage?.setItem(DEVICE_IDENTITY_STORAGE_KEY, serialized)
    persisted = true
  } catch {
    // Native Preferences may still persist the identity.
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await Preferences.set({ key: DEVICE_IDENTITY_STORAGE_KEY, value: serialized })
      persisted = true
    } catch {
      // IndexedDB or localStorage may already have persisted the identity.
    }
  }

  try {
    await withTimeout(
      db.deviceIdentity.put(identity),
      INDEXED_DB_TIMEOUT_MS,
    )
    persisted = true
  } catch {
    // localStorage and native Preferences remain available as fallbacks.
  }

  if (!persisted) {
    throw new Error('No se pudo guardar de forma persistente la identidad del dispositivo.')
  }
}

function withRuntimeMetadata(
  identity: DeviceIdentity,
  metadata: Awaited<ReturnType<typeof getRuntimeMetadata>>,
): DeviceIdentity {
  const deviceName = metadata.deviceName ?? identity.deviceName
  const appVersion = metadata.appVersion ?? identity.appVersion

  if (
    identity.platform === metadata.platform &&
    identity.deviceName === deviceName &&
    identity.appVersion === appVersion
  ) {
    return identity
  }

  return {
    ...identity,
    platform: metadata.platform,
    deviceName,
    appVersion,
    updatedAt: new Date().toISOString(),
  }
}

async function recoverStoredIdentity() {
  const indexedDbIdentity = await readIndexedDbIdentity()
  if (indexedDbIdentity) {
    logDevelopment('Identidad recuperada desde IndexedDB', indexedDbIdentity)
    return indexedDbIdentity
  }

  const localStorageIdentity = readLocalStorageIdentity()
  if (localStorageIdentity) {
    logDevelopment('Identidad recuperada desde localStorage', localStorageIdentity)
    return localStorageIdentity
  }

  const preferencesIdentity = await readPreferencesIdentity()
  if (preferencesIdentity) {
    logDevelopment('Identidad recuperada desde Capacitor Preferences', preferencesIdentity)
    return preferencesIdentity
  }

  return null
}

export async function getDeviceIdentity() {
  return recoverStoredIdentity()
}

async function resolveDeviceIdentity() {
  const metadata = await getRuntimeMetadata()
  const stored = await recoverStoredIdentity()

  if (stored) {
    const updated = withRuntimeMetadata(stored, metadata)
    await persistIdentityCopies(updated)
    return updated
  }

  const now = new Date().toISOString()
  const created: DeviceIdentity = {
    id: DEVICE_IDENTITY_ID,
    userCode: `PB-USER-${createSecureUuid()}`,
    deviceCode: `PB-DEVICE-${createSecureUuid()}`,
    ...metadata,
    provisioningStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  await persistIdentityCopies(created)
  logDevelopment('Nueva identidad creada', created)
  return created
}

export function getOrCreateDeviceIdentity() {
  if (!identityRequest) {
    identityRequest = resolveDeviceIdentity().finally(() => {
      identityRequest = undefined
    })
  }

  return identityRequest
}

async function saveProvisioningResult(
  identity: DeviceIdentity,
  changes: Partial<DeviceIdentity>,
) {
  const current = await db.deviceIdentity.get(DEVICE_IDENTITY_ID)
  if (!current || current.deviceCode !== identity.deviceCode) return identity

  const updated: DeviceIdentity = {
    ...current,
    ...changes,
    updatedAt: new Date().toISOString(),
  }
  await db.deviceIdentity.put(updated)
  await persistIdentityCopies(updated)
  return updated
}

async function provisionCurrentIdentity() {
  const identity = await getOrCreateDeviceIdentity()
  if (identity.provisioningStatus === 'provisioned') return identity

  const existingEvent = await db.automationOutbox
    .where('event')
    .equals('device.provision.requested')
    .filter((record) => record.data.deviceCode === identity.deviceCode)
    .first()

  if (existingEvent) {
    scheduleAutomationOutboxFlush()
    return identity
  }

  const record = createAutomationOutboxRecord('device.provision.requested', {
    userCode: identity.userCode,
    deviceCode: identity.deviceCode,
    deviceName: identity.deviceName,
    platform: identity.platform,
    appVersion: identity.appVersion,
  })
  const result = await sendAutomationEvent(record)

  if (result.delivered) {
    const provisioned = await saveProvisioningResult(identity, {
      provisioningStatus: 'provisioned',
      provisionedAt: new Date().toISOString(),
      lastProvisioningError: undefined,
    })
    logDevelopment('Evento provisioning enviado', provisioned)
    return provisioned
  }

  await enqueueAutomationEvent(record)
  scheduleAutomationOutboxFlush()
  return saveProvisioningResult(identity, {
    provisioningStatus: 'pending',
    lastProvisioningError: result.error?.slice(0, 300),
  })
}

export function provisionDeviceIdentity() {
  if (!provisioningRequest) {
    provisioningRequest = provisionCurrentIdentity().finally(() => {
      provisioningRequest = undefined
    })
  }

  return provisioningRequest
}

export async function resetDeviceIdentityForDebugOnly() {
  if (!import.meta.env.DEV) {
    throw new Error('La identidad solo se puede regenerar en desarrollo.')
  }

  await db.transaction('rw', [db.deviceIdentity, db.automationOutbox], async () => {
    await db.deviceIdentity.delete(DEVICE_IDENTITY_ID)
    await db.automationOutbox
      .where('event')
      .equals('device.provision.requested')
      .delete()
  })
  try {
    globalThis.localStorage?.removeItem(DEVICE_IDENTITY_STORAGE_KEY)
  } catch {
    // Debug reset continues with the remaining stores.
  }
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key: DEVICE_IDENTITY_STORAGE_KEY })
  }
  identityRequest = undefined
  provisioningRequest = undefined
}

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'

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

export async function getDeviceIdentity() {
  const identity = (await db.deviceIdentity.get(DEVICE_IDENTITY_ID)) ?? null

  if (identity) {
    logDevelopment('Identidad recuperada', identity)
  }

  return identity
}

async function resolveDeviceIdentity() {
  const metadata = await getRuntimeMetadata()

  return db.transaction('rw', db.deviceIdentity, async () => {
    const stored = await db.deviceIdentity.get(DEVICE_IDENTITY_ID)

    if (stored) {
      const metadataChanged =
        stored.platform !== metadata.platform ||
        stored.deviceName !== metadata.deviceName ||
        stored.appVersion !== metadata.appVersion

      if (!metadataChanged) {
        logDevelopment('Identidad recuperada', stored)
        return stored
      }

      const updated: DeviceIdentity = {
        ...stored,
        ...metadata,
        updatedAt: new Date().toISOString(),
      }
      await db.deviceIdentity.put(updated)
      logDevelopment('Identidad recuperada', updated)
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
    await db.deviceIdentity.add(created)
    logDevelopment('Identidad creada', created)
    return created
  })
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
  identityRequest = undefined
  provisioningRequest = undefined
}

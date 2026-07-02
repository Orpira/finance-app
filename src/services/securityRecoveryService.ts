import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

import { db } from '../database/db'

const DEVICE_IDENTITY_STORAGE_KEY = 'privateBalance.deviceIdentity'

export async function resetLocalAppForPinRecovery() {
  await db.delete()

  Object.keys(localStorage)
    .filter((key) => key.startsWith('finance-app:'))
    .forEach((key) => localStorage.removeItem(key))
  localStorage.removeItem(DEVICE_IDENTITY_STORAGE_KEY)

  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key: DEVICE_IDENTITY_STORAGE_KEY })
  }

  sessionStorage.clear()
}

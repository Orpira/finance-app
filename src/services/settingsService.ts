import {
  DEFAULT_SETTINGS_ID,
  createDefaultSettings,
  db,
} from '../database/db'
import type { AppSettings } from '../types/settings'
import { resolveUsageMode, toLegacyUserType } from '../utils/usageMode'

const SETTINGS_STORAGE_KEY = 'finance-app:settings'

export type UpdateSettingsInput = Partial<
  Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'>
>

export interface UpdateSettingsOptions {
  nextEarningPeriodName?: string
  allowSeasonPercentageChange?: boolean
  allowUsageModeChange?: boolean
  allowWorkModeChange?: boolean
}

function syncSettingsToLocalStorage(settings: AppSettings) {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

function notifySettingsChange(settings: AppSettings) {
  window.dispatchEvent(new CustomEvent<AppSettings>('finance-app:settings-changed', {
    detail: settings,
  }))
}

function getSettingsFromLocalStorage() {
  const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)

  if (!storedSettings) {
    return null
  }

  try {
    return normalizeSettings(JSON.parse(storedSettings) as AppSettings)
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY)
    return null
  }
}

export function applyTheme(theme: AppSettings['theme']) {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDarkTheme =
    theme === 'dark' || (theme === 'system' && prefersDark)

  root.dataset.theme = theme
  root.classList.toggle('dark', shouldUseDarkTheme)
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const usageMode = resolveUsageMode(settings)
  const pinHash = typeof settings.pinHash === 'string' && settings.pinHash.length > 0
    ? settings.pinHash
    : undefined
  const defaults = createDefaultSettings()

  return {
    ...defaults,
    ...settings,
    // Merge por campo: un registro persistido de antes de que existiera una preferencia nueva
    // (p. ej. las de entrega Android de Fase 1.5) no debe heredar `undefined` para ese campo —
    // debe recibir su propio valor por defecto en vez de que el spread superficial de arriba
    // reemplace todo el objeto notificationPreferences.
    notificationPreferences: {
      ...defaults.notificationPreferences,
      ...settings.notificationPreferences,
    },
    id: DEFAULT_SETTINGS_ID,
    usageMode,
    userType: toLegacyUserType(usageMode),
    pinEnabled: Boolean(settings.pinEnabled && pinHash),
    pinHash,
  }
}

export function normalizeRestoredSettings(settings: AppSettings): AppSettings {
  return normalizeSettings(settings)
}

export async function getSettings() {
  const settings = await db.settings.get(DEFAULT_SETTINGS_ID)

  if (settings) {
    const normalizedSettings = normalizeSettings(settings)
    await db.settings.put(normalizedSettings)
    syncSettingsToLocalStorage(normalizedSettings)
    applyTheme(normalizedSettings.theme)

    return normalizedSettings
  }

  const localSettings = getSettingsFromLocalStorage()

  if (localSettings) {
    await db.settings.put(localSettings)
    applyTheme(localSettings.theme)

    return localSettings
  }

  const defaultSettings = createDefaultSettings()
  await db.settings.put(defaultSettings)
  syncSettingsToLocalStorage(defaultSettings)
  applyTheme(defaultSettings.theme)

  return defaultSettings
}

export async function updateSettings(
  updates: UpdateSettingsInput,
  options: UpdateSettingsOptions = {},
) {
  const currentSettings = await getSettings()
  const requestedUsageMode = resolveUsageMode({
    usageMode: updates.usageMode,
    userType: updates.userType,
  })
  const modeWasUpdated =
    updates.usageMode !== undefined || updates.userType !== undefined
  const usageMode = modeWasUpdated
    ? requestedUsageMode
    : currentSettings.usageMode

  if (
    modeWasUpdated &&
    usageMode !== currentSettings.usageMode &&
    currentSettings.onboarding.completed &&
    !options.allowUsageModeChange
  ) {
    throw new Error(
      'El tipo de uso solo puede configurarse durante el primer inicio.',
    )
  }

  if (
    updates.workedTimeUnit !== undefined &&
    updates.workedTimeUnit !== currentSettings.workedTimeUnit &&
    currentSettings.onboarding.completed &&
    !options.allowWorkModeChange
  ) {
    throw new Error(
      'La modalidad de trabajo solo puede configurarse durante el primer inicio.',
    )
  }

  const nextSettings: AppSettings = {
    ...currentSettings,
    ...updates,
    usageMode,
    userType: toLegacyUserType(usageMode),
    updatedAt: new Date().toISOString(),
  }
  const incomePercentageChanged =
    updates.incomePercentage !== undefined &&
    updates.incomePercentage !== currentSettings.incomePercentage

  if (incomePercentageChanged && !options.allowSeasonPercentageChange) {
    throw new Error(
      'Para cambiar el porcentaje debes cerrar la temporada actual y crear una nueva.',
    )
  }

  await db.settings.put(nextSettings)
  syncSettingsToLocalStorage(nextSettings)
  applyTheme(nextSettings.theme)
  notifySettingsChange(nextSettings)

  return nextSettings
}

export function enablePin(pinHash: string) {
  return updateSettings({
    pinEnabled: true,
    pinHash,
  })
}

export function disablePin() {
  return updateSettings({
    pinEnabled: false,
    pinHash: undefined,
  })
}

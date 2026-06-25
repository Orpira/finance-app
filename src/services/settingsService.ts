import {
  DEFAULT_SETTINGS_ID,
  createDefaultSettings,
  db,
} from '../database/db'
import type { AppSettings } from '../types/settings'

const SETTINGS_STORAGE_KEY = 'finance-app:settings'

export type UpdateSettingsInput = Partial<
  Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'>
>

export interface UpdateSettingsOptions {
  nextEarningPeriodName?: string
  allowSeasonPercentageChange?: boolean
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
  return {
    ...createDefaultSettings(),
    ...settings,
    id: DEFAULT_SETTINGS_ID,
  }
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
  const nextSettings: AppSettings = {
    ...currentSettings,
    ...updates,
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

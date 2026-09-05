import { beforeEach, describe, expect, it, vi } from 'vitest'

// settingsService.getSettings/updateSettings tienen efectos secundarios de
// UI (localStorage, tema) ajenos a la lógica de activación que se prueba
// aquí. Esta suite evita jsdom en general (ver test/homeSeasonScope.test.ts),
// así que se stubean mínimamente en vez de arrastrar un entorno DOM completo.
vi.stubGlobal('localStorage', {
  getItem: () => null,
  removeItem: () => {},
  setItem: () => {},
})
vi.stubGlobal('window', {
  dispatchEvent: () => true,
  matchMedia: () => ({ matches: false }),
})
vi.stubGlobal('document', {
  documentElement: { classList: { toggle: () => {} }, dataset: {} as Record<string, string> },
})

// Bloque 1 (activación Híbrida para instalaciones existentes): estos tests
// ejercitan settingsService.activateHybridMode/setActiveContext contra un
// mock mínimo de Dexie (mismo patrón que test/homeSeasonScope.test.ts), sin
// tocar ningún registro de ingresos/gastos — solo la fila de settings.

interface SettingsRow {
  id: string
  usageMode: 'basic' | 'professional' | 'hybrid'
  activeContext?: 'basic' | 'professional'
  userType?: string
  onboarding: { completed: boolean; currentStep: number; version: number }
  [key: string]: unknown
}

let settingsRow: SettingsRow | undefined
const financialGoals: Array<{ id: string; usageMode?: 'basic' | 'professional' }> = []

function createSettingsTable() {
  return {
    async get(id: string) {
      return id === settingsRow?.id ? settingsRow : undefined
    },
    async put(row: SettingsRow) {
      settingsRow = row
      return row.id
    },
  }
}

vi.mock('../src/database/db', () => ({
  DEFAULT_SETTINGS_ID: 'app',
  createDefaultSettings: () => ({
    id: 'app',
    defaultCurrency: 'EUR',
    secondaryCurrency: 'USD',
    incomePercentage: 100,
    city: '',
    country: 'ES',
    theme: 'system',
    usageMode: 'professional',
    userType: 'primary',
    onboarding: { completed: true, currentStep: 6, version: 1 },
    notificationPreferences: {},
  }),
  get db() {
    return {
      settings: createSettingsTable(),
      financialGoals: {
        async toArray() { return financialGoals },
        async bulkPut(goals: typeof financialGoals) {
          financialGoals.splice(0, financialGoals.length, ...goals)
        },
      },
      async transaction(_mode: unknown, _tables: unknown, callback: () => unknown) {
        return callback()
      },
    }
  },
}))

const { getSettings, activateHybridMode, setActiveContext } = await import(
  '../src/services/settingsService'
)

function seedSettings(overrides: Partial<SettingsRow>) {
  settingsRow = {
    id: 'app',
    usageMode: 'professional',
    userType: 'primary',
    onboarding: { completed: true, currentStep: 6, version: 1 },
    defaultCurrency: 'EUR',
    secondaryCurrency: 'USD',
    incomePercentage: 100,
    city: '',
    country: 'ES',
    theme: 'system',
    notificationPreferences: {},
    ...overrides,
  }
}

beforeEach(() => {
  settingsRow = undefined
  financialGoals.length = 0
})

describe('activateHybridMode', () => {
  it('turns a basic install into hybrid, defaulting activeContext to basic', async () => {
    seedSettings({ usageMode: 'basic', userType: 'basic' })

    const updated = await activateHybridMode()

    expect(updated.usageMode).toBe('hybrid')
    expect(updated.activeContext).toBe('basic')

    // Persisted, not just returned — a fresh read sees the same thing.
    const reloaded = await getSettings()
    expect(reloaded.usageMode).toBe('hybrid')
    expect(reloaded.activeContext).toBe('basic')
  })

  it('turns a professional install into hybrid, defaulting activeContext to professional', async () => {
    seedSettings({ usageMode: 'professional', userType: 'primary' })

    const updated = await activateHybridMode()

    expect(updated.usageMode).toBe('hybrid')
    expect(updated.activeContext).toBe('professional')
  })

  it('is a no-op when already hybrid (idempotent, no accidental context reset)', async () => {
    seedSettings({ usageMode: 'hybrid', activeContext: 'basic' })

    const updated = await activateHybridMode()

    expect(updated.usageMode).toBe('hybrid')
    expect(updated.activeContext).toBe('basic')
  })

  it('does not touch onboarding.completed or any other unrelated field', async () => {
    seedSettings({ usageMode: 'basic', defaultCurrency: 'USD' })

    const updated = await activateHybridMode()

    expect(updated.onboarding.completed).toBe(true)
    expect(updated.defaultCurrency).toBe('USD')
  })
})

describe('setActiveContext', () => {
  it('rejects switching context on a non-hybrid install', async () => {
    seedSettings({ usageMode: 'professional' })

    await expect(setActiveContext('basic')).rejects.toThrow(
      'Solo se puede cambiar de espacio en instalaciones con modo Híbrido.',
    )
  })

  it('switches the active workspace on a hybrid install and persists it', async () => {
    seedSettings({ usageMode: 'hybrid', activeContext: 'professional' })

    const updated = await setActiveContext('basic')
    expect(updated.activeContext).toBe('basic')

    const reloaded = await getSettings()
    expect(reloaded.activeContext).toBe('basic')
  })
})

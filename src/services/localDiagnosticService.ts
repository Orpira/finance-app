import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

import { db } from '../database/db'

const ACTIVITY_STORAGE_KEY = 'private-balance:diagnostic-activity:v1'

export interface LocalDiagnosticError {
  readonly code: 'TABLE_COUNT_FAILED' | 'STORAGE_ESTIMATE_FAILED'
  readonly component: string
}

export interface LocalDiagnosticReport {
  readonly generatedAt: string
  readonly appVersion: string
  readonly platform: string
  readonly schemaVersion: number
  readonly integrity: 'healthy' | 'degraded'
  readonly storage: { readonly usageBytes: number | null; readonly quotaBytes: number | null }
  readonly recordCounts: Readonly<Record<string, number>>
  readonly lastBackupAt: string | null
  readonly lastRestoreAt: string | null
  readonly errors: readonly LocalDiagnosticError[]
}

export interface DiagnosticActivity {
  readonly lastBackupAt: string | null
  readonly lastRestoreAt: string | null
}

interface DiagnosticTable {
  readonly name: string
  count(): Promise<number>
}

export interface CollectLocalDiagnosticsInput {
  readonly now: () => string
  readonly appVersion: string
  readonly platform: string
  readonly schemaVersion: number
  readonly estimateStorage: () => Promise<{ readonly usage?: number; readonly quota?: number }>
  readonly tables: readonly DiagnosticTable[]
  readonly activity: DiagnosticActivity
}

export async function collectLocalDiagnostics(input: CollectLocalDiagnosticsInput): Promise<LocalDiagnosticReport> {
  const recordCounts: Record<string, number> = {}
  const errors: LocalDiagnosticError[] = []
  for (const table of input.tables) {
    try {
      recordCounts[table.name] = await table.count()
    } catch {
      errors.push({ code: 'TABLE_COUNT_FAILED', component: table.name })
    }
  }

  let storage: LocalDiagnosticReport['storage'] = { usageBytes: null, quotaBytes: null }
  try {
    const estimate = await input.estimateStorage()
    storage = { usageBytes: estimate.usage ?? null, quotaBytes: estimate.quota ?? null }
  } catch {
    errors.push({ code: 'STORAGE_ESTIMATE_FAILED', component: 'storage' })
  }

  return {
    generatedAt: input.now(),
    appVersion: input.appVersion,
    platform: input.platform,
    schemaVersion: input.schemaVersion,
    integrity: errors.length === 0 ? 'healthy' : 'degraded',
    storage,
    recordCounts,
    lastBackupAt: input.activity.lastBackupAt,
    lastRestoreAt: input.activity.lastRestoreAt,
    errors,
  }
}

export function buildSafeDiagnosticExport(report: LocalDiagnosticReport) {
  return {
    format: 'private-balance-support-diagnostic-v1',
    privacy: 'No incluye datos financieros personales.',
    ...report,
  } as const
}

export function getDiagnosticActivity(): DiagnosticActivity {
  if (typeof window === 'undefined') return { lastBackupAt: null, lastRestoreAt: null }
  try {
    const stored = JSON.parse(window.localStorage.getItem(ACTIVITY_STORAGE_KEY) ?? '{}') as Partial<DiagnosticActivity>
    return { lastBackupAt: stored.lastBackupAt ?? null, lastRestoreAt: stored.lastRestoreAt ?? null }
  } catch {
    return { lastBackupAt: null, lastRestoreAt: null }
  }
}

export function recordDiagnosticActivity(kind: 'backup' | 'restore', at = new Date().toISOString()): void {
  if (typeof window === 'undefined') return
  const current = getDiagnosticActivity()
  const next: DiagnosticActivity = kind === 'backup'
    ? { ...current, lastBackupAt: at }
    : { ...current, lastRestoreAt: at }
  window.localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(next))
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'unknown'
  return /android/i.test(navigator.userAgent) ? 'android' : 'web'
}

async function resolveAppVersion(): Promise<string> {
  const fallbackVersion = import.meta.env.VITE_APP_VERSION || 'development'

  if (!Capacitor.isNativePlatform()) return fallbackVersion

  try {
    const info = await App.getInfo()
    const version = info.version.trim()
    const build = info.build.trim()

    if (!version) return fallbackVersion
    return build ? `${version} (${build})` : version
  } catch {
    return fallbackVersion
  }
}

export async function getLocalDiagnosticReport(): Promise<LocalDiagnosticReport> {
  await db.open()
  return collectLocalDiagnostics({
    now: () => new Date().toISOString(),
    appVersion: await resolveAppVersion(),
    platform: detectPlatform(),
    schemaVersion: db.verno,
    estimateStorage: async () => (
      typeof navigator !== 'undefined' && navigator.storage?.estimate
        ? navigator.storage.estimate()
        : {}
    ),
    tables: db.tables.map((table) => ({ name: table.name, count: () => table.count() })),
    activity: getDiagnosticActivity(),
  })
}

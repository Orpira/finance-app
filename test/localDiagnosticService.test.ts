import { describe, expect, it } from 'vitest'

import {
  buildSafeDiagnosticExport,
  collectLocalDiagnostics,
} from '../src/services/localDiagnosticService'

describe('local diagnostics', () => {
  it('collects only schema and record counts from the local database', async () => {
    const report = await collectLocalDiagnostics({
      now: () => '2026-08-02T12:00:00.000Z',
      appVersion: '0.9.0',
      platform: 'web',
      schemaVersion: 30,
      estimateStorage: async () => ({ usage: 2048, quota: 4096 }),
      tables: [
        { name: 'services', count: async () => 3 },
        { name: 'expenses', count: async () => 2 },
      ],
      activity: { lastBackupAt: '2026-08-01T10:00:00.000Z', lastRestoreAt: null },
    })

    expect(report.integrity).toBe('healthy')
    expect(report.recordCounts).toEqual({ services: 3, expenses: 2 })
    expect(report.storage).toEqual({ usageBytes: 2048, quotaBytes: 4096 })
  })

  it('exports support-safe metadata without financial records or local errors details', () => {
    const exported = buildSafeDiagnosticExport({
      generatedAt: '2026-08-02T12:00:00.000Z', appVersion: '0.9.0', platform: 'web',
      schemaVersion: 30, integrity: 'degraded', storage: { usageBytes: 10, quotaBytes: 20 },
      recordCounts: { services: 1 }, lastBackupAt: null, lastRestoreAt: null,
      errors: [{ code: 'TABLE_COUNT_FAILED', component: 'services' }],
    })
    const json = JSON.stringify(exported)
    expect(json).toContain('TABLE_COUNT_FAILED')
    expect(json).not.toContain('amount')
    expect(json).not.toContain('description')
    expect(json).not.toContain('records')
    expect(exported.privacy).toBe('No incluye datos financieros personales.')
  })
})

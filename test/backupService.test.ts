import { describe, expect, it } from 'vitest'

import {
  buildBackupFilename,
  getDelayUntilNextDailyBackupCheck,
  shouldCreateDailyBackup,
} from '../src/services/backupService'

describe('automatic backup scheduling', () => {
  it('runs again after local midnight even if 24 hours have not elapsed', () => {
    expect(
      shouldCreateDailyBackup(
        '2026-07-05T23:58:00',
        new Date(2026, 6, 6, 0, 1, 0),
      ),
    ).toBe(true)
  })

  it('does not run twice on the same local day', () => {
    expect(
      shouldCreateDailyBackup(
        '2026-07-06T00:05:00',
        new Date(2026, 6, 6, 23, 59, 0),
      ),
    ).toBe(false)
  })

  it('schedules the next check at the next local midnight', () => {
    expect(
      getDelayUntilNextDailyBackupCheck(new Date(2026, 6, 6, 21, 30, 0)),
    ).toBe(9_000_000)
  })

  it('names encrypted backups with creation date and time', () => {
    expect(buildBackupFilename('2026-07-06T00:00:05.000Z')).toBe(
      'private-balance-backup-2026-07-06-00-00-05.json.enc',
    )
  })
})
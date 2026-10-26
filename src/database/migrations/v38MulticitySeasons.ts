import type { Transaction } from 'dexie'

import type { EarningPeriod } from '../../types/earningPeriod'
import type { SeasonRevision } from '../../types/seasonRevision'

/**
 * Records the values inherited by legacy seasons without inferring an
 * itinerary. Historical records intentionally remain unassigned to a stay.
 */
export async function migrateMulticitySeasonsV38(transaction: Transaction) {
  const periods = await transaction
    .table<EarningPeriod, number>('earningPeriods')
    .toArray()
  const revisionTable = transaction.table<SeasonRevision, number>('seasonRevisions')

  const revisions: SeasonRevision[] = periods.flatMap((period) => {
    if (!period.id) return []
    return [{
      earningPeriodId: period.id,
      sequence: 1,
      kind: 'migration_baseline' as const,
      source: 'migration_baseline' as const,
      previousValue: null,
      nextValue: {
        plannedEndDate: period.plannedEndDate,
        economicGoal: period.economicGoal,
      },
      recordedAt: period.updatedAt ?? period.createdAt ?? new Date(0).toISOString(),
    }]
  })

  if (revisions.length > 0) await revisionTable.bulkAdd(revisions)
}

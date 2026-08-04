import type { Transaction } from 'dexie'

import type { EarningPeriod } from '../../types/earningPeriod'

export function migrateSeasonPlanningV31(transaction: Transaction) {
  return transaction
    .table<EarningPeriod, number>('earningPeriods')
    .toCollection()
    .modify((period) => {
      if (
        period.economicGoal !== undefined &&
        (!Number.isFinite(period.economicGoal) || period.economicGoal <= 0)
      ) {
        delete period.economicGoal
      }

      if (
        period.plannedEndDate !== undefined &&
        (Number.isNaN(Date.parse(period.plannedEndDate)) ||
          period.plannedEndDate.slice(0, 10) < period.startDate.slice(0, 10))
      ) {
        delete period.plannedEndDate
      }
    })
}
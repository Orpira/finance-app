export type FinancialListEmptyReason =
  | 'no-active-season'
  | 'no-records'
  | 'no-filter-results'

export function getFinancialListEmptyReason({
  totalRecords,
  requiresActiveSeason,
  hasActiveSeason,
}: {
  readonly totalRecords: number
  readonly requiresActiveSeason: boolean
  readonly hasActiveSeason: boolean
}): FinancialListEmptyReason {
  if (requiresActiveSeason && !hasActiveSeason) return 'no-active-season'
  return totalRecords === 0 ? 'no-records' : 'no-filter-results'
}

import type { AppSettings } from '../../types/settings'
import { isBasicMode } from '../../utils/usageMode'

export function getIncomeListModeFeatures(
  settings: Pick<AppSettings, 'usageMode' | 'userType'> | null,
) {
  const professionalFeaturesEnabled = Boolean(
    settings && !isBasicMode(settings),
  )

  return {
    showAdditionals: professionalFeaturesEnabled,
    showOperationalStatus: professionalFeaturesEnabled,
  }
}

interface IncomeReportingVisibilityInput {
  readonly showUnreportedIncome: boolean
  readonly hasSelectableIncomes?: boolean
  readonly hasSelectedIncomes?: boolean
  readonly isSelectable?: boolean
  readonly canReport?: boolean
  readonly isReported?: boolean
}

export function getIncomeReportingVisibility({
  showUnreportedIncome,
  hasSelectableIncomes = false,
  hasSelectedIncomes = false,
  isSelectable = false,
  canReport = false,
  isReported = false,
}: IncomeReportingVisibilityInput) {
  return {
    showSelectVisible: showUnreportedIncome && hasSelectableIncomes,
    showSelectionSummary: showUnreportedIncome && hasSelectedIncomes,
    showIndividualSelection: showUnreportedIncome && isSelectable,
    showReportBadge: canReport && (showUnreportedIncome || isReported),
  }
}
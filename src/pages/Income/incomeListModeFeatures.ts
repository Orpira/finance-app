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
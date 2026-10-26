import type { SeasonRevision, SeasonStayCorrectionSnapshot } from '../../../types/seasonRevision'
import type { CurrencyCode } from '../../../types/settings'
import { formatCurrency } from '../../../utils/currency'
import { formatCivilDate, formatStayPeriod } from './stayPresentation'

const SOURCE_LABELS: Record<string, string> = {
  season_creation: 'Valor inicial',
  user_extension: 'Ampliación',
  user_correction: 'Corrección',
  user_revision: 'Revisión',
}

function describeStaySnapshot(snapshot: SeasonStayCorrectionSnapshot) {
  return `${snapshot.city} · ${formatStayPeriod({ status: 'planned', ...snapshot })}`
}

export function describeRevision(revision: SeasonRevision, currency: CurrencyCode) {
  switch (revision.kind) {
    case 'migration_baseline': {
      const parts: string[] = []
      if (revision.nextValue.plannedEndDate) parts.push(`fecha prevista ${formatCivilDate(revision.nextValue.plannedEndDate)}`)
      if (revision.nextValue.economicGoal !== undefined) parts.push(`objetivo ${formatCurrency(revision.nextValue.economicGoal, currency)}`)
      return {
        title: 'Valores conocidos al actualizar la app',
        detail: `${parts.join(' · ') || 'Sin fecha prevista ni objetivo'}. No representa necesariamente el valor original.`,
      }
    }
    case 'planned_end_date_revised':
      return {
        title: `Fecha prevista · ${SOURCE_LABELS[revision.source] ?? revision.source}`,
        detail: revision.previousValue === null
          ? formatCivilDate(revision.nextValue)
          : `${formatCivilDate(revision.previousValue)} → ${formatCivilDate(revision.nextValue)}`,
      }
    case 'economic_goal_revised':
      return {
        title: `Objetivo económico · ${revision.source === 'season_creation' ? 'Objetivo original' : 'Revisión'}`,
        detail: revision.previousValue === null
          ? formatCurrency(revision.nextValue, currency)
          : `${formatCurrency(revision.previousValue, currency)} → ${formatCurrency(revision.nextValue, currency)}`,
      }
    case 'season_stay_corrected':
      return {
        title: `Corrección de estancia · ${revision.nextValue.city}`,
        detail: `${describeStaySnapshot(revision.previousValue)} → ${describeStaySnapshot(revision.nextValue)}`,
      }
  }
}


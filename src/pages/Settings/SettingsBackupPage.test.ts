import { describe, expect, it } from 'vitest'

import { getBackupImportFeedback } from './backupImportFeedback'

describe('getBackupImportFeedback', () => {
  it('dirige al historial cuando el backup solo contiene temporadas cerradas', () => {
    expect(
      getBackupImportFeedback({
        appointments: 3,
        closedEarningPeriods: 2,
        earningPeriods: 2,
        expenses: 2,
        hasActiveEarningPeriod: false,
        services: 179,
      }),
    ).toEqual({
      actionLabel: 'Ver historial restaurado',
      actionTo: '/temporadas',
      detail:
        'El backup no contiene una temporada activa. Los registros restaurados están en el historial de temporadas y permanecen en modo solo consulta.',
      message: 'Backup restaurado: 179 ingreso(s), 2 egreso(s) y 3 cita(s).',
    })
  })

  it('dirige a ingresos cuando existe una temporada activa', () => {
    const feedback = getBackupImportFeedback({
      appointments: 0,
      closedEarningPeriods: 1,
      earningPeriods: 2,
      expenses: 0,
      hasActiveEarningPeriod: true,
      services: 4,
    })

    expect(feedback.actionTo).toBe('/income')
    expect(feedback.actionLabel).toBe('Ver ingresos restaurados')
  })
})
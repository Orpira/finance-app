import type { BackupImportSummary } from '../../services/backupService'

export function getBackupImportFeedback(summary: BackupImportSummary) {
  const historicalOnly =
    summary.earningPeriods > 0 && !summary.hasActiveEarningPeriod

  return {
    actionLabel: historicalOnly
      ? 'Ver historial restaurado'
      : 'Ver ingresos restaurados',
    actionTo: historicalOnly ? '/temporadas' : '/income',
    detail: historicalOnly
      ? 'El backup no contiene una temporada activa. Los registros restaurados están en el historial de temporadas y permanecen en modo solo consulta.'
      : 'Los registros restaurados ya están disponibles en la aplicación.',
    message: `Backup restaurado: ${summary.services} ingreso(s), ${summary.expenses} egreso(s) y ${summary.appointments} cita(s).`,
  }
}
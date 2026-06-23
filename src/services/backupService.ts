import {
  db,
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  type DatabaseSnapshot,
} from '../database/db'
import type { Appointment } from '../types/appointment'
import type { CutoffReport } from '../types/cutoffReport'
import type { EarningPeriod } from '../types/earningPeriod'
import type { ExchangeRate } from '../types/exchangeRate'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import { downloadText } from '../utils/download'
import {
  decryptJsonPayload,
  encryptJsonPayload,
  type EncryptedPayload,
} from './encryptionService'
import {
  downloadLatestBackupFromAppFolder,
  isGoogleDriveConnected,
  uploadBackupToAppFolder,
} from './googleDriveBackupService'
import { getSettings, updateSettings } from './settingsService'
import { migrateLegacyRecordsToSeasons } from './earningPeriodService'

export interface BackupData {
  version: string
  generatedAt: string
  appName: 'Private Balance'
  services: ServiceIncome[]
  expenses: Expense[]
  appointments: Appointment[]
  settings: Awaited<ReturnType<typeof getSettings>>
  exchangeRates: ExchangeRate[]
  cutoffReports?: CutoffReport[]
  earningPeriods?: EarningPeriod[]
}

export interface EncryptedBackupFile {
  encryptedPayload: EncryptedPayload
  filename: string
  generatedAt: string
}

interface EncryptedBackupDocument {
  filename?: string
  generatedAt: string
  payloadEncrypted: EncryptedPayload
}

const BACKUP_VERSION = '2'
const AUTOMATIC_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000

function buildBackupFilename(generatedAt: string) {
  const date = generatedAt.slice(0, 10)
  const time = generatedAt.slice(11, 16).replace(':', '-')

  return `private-balance-backup-${date}-${time}.json.enc`
}

function buildBackupStatus(status: 'success' | 'error', message: string) {
  return `${new Date().toISOString()} | ${status} | ${message}`
}

function buildEncryptedBackupDocument(encryptedBackup: EncryptedBackupFile) {
  return {
    filename: encryptedBackup.filename,
    generatedAt: encryptedBackup.generatedAt,
    payloadEncrypted: encryptedBackup.encryptedPayload,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error desconocido.'
}

export async function exportBackup() {
  const snapshot = await exportDatabaseSnapshot()
  const content = JSON.stringify(snapshot, null, 2)

  await downloadText(content, 'backup.json', 'application/json')
}

export async function importBackup(file: File) {
  const content = await file.text()
  const snapshot = JSON.parse(content) as DatabaseSnapshot

  await importDatabaseSnapshot(snapshot)
  await migrateLegacyRecordsToSeasons()
}

function backupDataToSnapshot(backupData: BackupData): DatabaseSnapshot {
  return {
    appointments: backupData.appointments ?? [],
    exchangeRates: backupData.exchangeRates ?? [],
    expenses: backupData.expenses ?? [],
    exportedAt: backupData.generatedAt,
    services: backupData.services ?? [],
    settings: backupData.settings ? [backupData.settings] : [],
    cutoffReports: backupData.cutoffReports ?? [],
    earningPeriods: backupData.earningPeriods ?? [],
  }
}

export async function generateBackupData(): Promise<BackupData> {
  const [
    services,
    expenses,
    appointments,
    settings,
    exchangeRates,
    cutoffReports,
    earningPeriods,
  ] =
    await Promise.all([
      db.services.toArray(),
      db.expenses.toArray(),
      db.appointments.toArray(),
      getSettings(),
      db.exchangeRates.toArray(),
      db.cutoffReports.toArray(),
      db.earningPeriods.toArray(),
    ])

  return {
    version: BACKUP_VERSION,
    generatedAt: new Date().toISOString(),
    appName: 'Private Balance',
    services,
    expenses,
    appointments,
    settings,
    exchangeRates,
    cutoffReports,
    earningPeriods,
  }
}

export async function encryptBackup(
  data: BackupData,
  passwordOrKey: string,
): Promise<EncryptedBackupFile> {
  const encryptedPayload = await encryptJsonPayload(data, passwordOrKey)

  return {
    encryptedPayload,
    filename: buildBackupFilename(data.generatedAt),
    generatedAt: data.generatedAt,
  }
}

export async function exportEncryptedBackup(passwordOrKey: string) {
  const backupData = await generateBackupData()
  const encryptedBackup = await encryptBackup(backupData, passwordOrKey)
  const content = JSON.stringify(buildEncryptedBackupDocument(encryptedBackup), null, 2)

  await downloadText(
    content,
    encryptedBackup.filename,
    'application/octet-stream',
  )

  return encryptedBackup
}

export async function decryptBackup(
  encryptedBackup: EncryptedBackupDocument,
  passwordOrKey: string,
) {
  if (!encryptedBackup.payloadEncrypted) {
    throw new Error('El archivo no contiene un backup cifrado válido.')
  }

  const backupData = await decryptJsonPayload<BackupData>(
    encryptedBackup.payloadEncrypted,
    passwordOrKey,
  )

  if (
    backupData.appName !== 'Private Balance' ||
    !backupData.generatedAt ||
    !backupData.version
  ) {
    throw new Error('El contenido descifrado no es un backup válido.')
  }

  return backupData
}

export async function restoreBackupData(backupData: BackupData) {
  await importDatabaseSnapshot(backupDataToSnapshot(backupData))
  await migrateLegacyRecordsToSeasons()
}

export async function importEncryptedBackup(file: File, passwordOrKey: string) {
  const content = await file.text()
  const encryptedBackup = JSON.parse(content) as EncryptedBackupDocument
  const backupData = await decryptBackup(encryptedBackup, passwordOrKey)

  await restoreBackupData(backupData)

  return backupData
}

export async function shouldRunAutomaticBackup() {
  const settings = await getSettings()

  if (!settings.driveBackupEnabled) {
    return false
  }

  if (!settings.backupEncryptionKey.trim() || !isGoogleDriveConnected()) {
    return false
  }

  if (!settings.googleDriveLastBackupAt) {
    return true
  }

  const lastBackupTime = new Date(settings.googleDriveLastBackupAt).getTime()

  if (Number.isNaN(lastBackupTime)) {
    return true
  }

  return Date.now() - lastBackupTime >= AUTOMATIC_BACKUP_INTERVAL_MS
}

export async function runDriveBackupNow() {
  const settings = await getSettings()
  const encryptionKey = settings.backupEncryptionKey.trim()

  if (!encryptionKey) {
    throw new Error('Configura una clave de cifrado para el backup.')
  }

  if (!isGoogleDriveConnected()) {
    throw new Error('Conecta Google Drive antes de subir backups.')
  }

  const backupData = await generateBackupData()
  const encryptedBackup = await encryptBackup(backupData, encryptionKey)
  const content = JSON.stringify(buildEncryptedBackupDocument(encryptedBackup), null, 2)

  await uploadBackupToAppFolder({
    content,
    filename: encryptedBackup.filename,
    generatedAt: encryptedBackup.generatedAt,
  })

  await updateSettings({
    googleDriveConnected: true,
    googleDriveLastBackupAt: encryptedBackup.generatedAt,
    googleDriveLastBackupStatus: buildBackupStatus(
      'success',
      `Backup subido a Drive: ${encryptedBackup.filename}`,
    ),
  })

  return encryptedBackup
}

export async function restoreLatestDriveBackup() {
  const settings = await getSettings()
  const encryptionKey = settings.backupEncryptionKey.trim()

  if (!encryptionKey) {
    throw new Error('Configura la clave de cifrado para restaurar.')
  }

  if (!isGoogleDriveConnected()) {
    throw new Error('Conecta Google Drive antes de restaurar backups.')
  }

  const latestBackup = await downloadLatestBackupFromAppFolder()
  const encryptedBackup = JSON.parse(
    latestBackup.content,
  ) as EncryptedBackupDocument
  const backupData = await decryptBackup(encryptedBackup, encryptionKey)

  await restoreBackupData(backupData)
  await updateSettings({
    googleDriveLastBackupStatus: buildBackupStatus(
      'success',
      `Backup restaurado: ${latestBackup.file.name}`,
    ),
  })

  return backupData
}

export async function runAutomaticDriveBackupIfNeeded() {
  const shouldRun = await shouldRunAutomaticBackup()

  if (!shouldRun) {
    return {
      skipped: true,
    }
  }

  try {
    const encryptedBackup = await runDriveBackupNow()

    return {
      encryptedBackup,
      skipped: false,
    }
  } catch (error) {
    await updateSettings({
      googleDriveLastBackupStatus: buildBackupStatus(
        'error',
        getErrorMessage(error),
      ),
    })

    throw error
  }
}

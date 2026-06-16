import {
  Cloud,
  FileJson,
  Link2Off,
  RotateCcw,
  Send,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  exportBackup,
  exportEncryptedBackup,
  importBackup,
  importEncryptedBackup,
  restoreLatestDriveBackup,
  runDriveBackupNow,
} from '../../services/backupService'
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  isGoogleDriveConnected,
} from '../../services/googleDriveBackupService'
import { getSettings, updateSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'

type BackupStatus = 'idle' | 'running' | 'success' | 'error'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export function SettingsBackupPage() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle')
  const [backupMessage, setBackupMessage] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const encryptedFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      const currentSettings = await getSettings()
      const connected = isGoogleDriveConnected()
      const normalizedSettings =
        currentSettings.googleDriveConnected === connected
          ? currentSettings
          : await updateSettings({ googleDriveConnected: connected })

      if (isMounted) {
        setSettings(normalizedSettings)
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [])

  async function updateLocalSettings(updates: Partial<AppSettings>) {
    const updatedSettings = await updateSettings(updates)

    setSettings(updatedSettings)
    setBackupStatus('idle')
    setBackupMessage('')
  }

  function getEncryptionKey() {
    const encryptionKey = settings?.backupEncryptionKey.trim() ?? ''

    if (!encryptionKey) {
      throw new Error('Configura una clave de cifrado antes de continuar.')
    }

    return encryptionKey
  }

  async function handleConnectGoogleDrive() {
    if (!settings) {
      return
    }

    setBackupStatus('running')
    setBackupMessage('Abriendo autorización de Google...')

    try {
      const result = await connectGoogleDrive(settings.googleDriveClientId)
      const updatedSettings = await updateSettings({
        googleDriveConnected: true,
        googleDriveLastBackupStatus: `Conectado a Google Drive App Folder | scope ${result.scope}`,
      })

      setSettings(updatedSettings)
      setBackupStatus('success')
      setBackupMessage('Google Drive App Folder conectado correctamente.')
    } catch (error) {
      const updatedSettings = await updateSettings({
        googleDriveConnected: false,
      })

      setSettings(updatedSettings)
      setBackupStatus('error')
      setBackupMessage(
        getErrorMessage(error, 'No se pudo conectar Google Drive.'),
      )
    }
  }

  async function handleDisconnectGoogleDrive() {
    disconnectGoogleDrive()
    const updatedSettings = await updateSettings({
      driveBackupEnabled: false,
      googleDriveConnected: false,
      googleDriveLastBackupStatus: 'Google Drive desconectado',
    })

    setSettings(updatedSettings)
    setBackupStatus('idle')
    setBackupMessage('Google Drive desconectado.')
  }

  async function handleUploadDriveBackupNow() {
    setBackupStatus('running')
    setBackupMessage('')

    try {
      await runDriveBackupNow()
      setSettings(await getSettings())
      setBackupStatus('success')
      setBackupMessage('Backup cifrado subido a Google Drive App Folder.')
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo subir el backup.')
      const updatedSettings = await updateSettings({
        googleDriveLastBackupStatus: `Manual | error | ${message}`,
      })

      setSettings(updatedSettings)
      setBackupStatus('error')
      setBackupMessage(message)
    }
  }

  async function handleRestoreLatestDriveBackup() {
    const shouldRestore = window.confirm(
      'Restaurar reemplazará los datos locales actuales por el último backup cifrado de Google Drive. ¿Continuar?',
    )

    if (!shouldRestore) {
      return
    }

    setBackupStatus('running')
    setBackupMessage('')

    try {
      await restoreLatestDriveBackup()
      window.location.reload()
    } catch (error) {
      setBackupStatus('error')
      setBackupMessage(
        getErrorMessage(error, 'No se pudo restaurar el último backup.'),
      )
    }
  }

  async function handleExportEncryptedBackup() {
    setBackupStatus('running')
    setBackupMessage('')

    try {
      await exportEncryptedBackup(getEncryptionKey())
      setBackupStatus('success')
      setBackupMessage('Backup cifrado generado correctamente.')
    } catch (error) {
      setBackupStatus('error')
      setBackupMessage(
        getErrorMessage(error, 'No se pudo exportar el backup cifrado.'),
      )
    }
  }

  async function handleExportPlainBackup() {
    setBackupStatus('running')
    setBackupMessage('')

    try {
      await exportBackup()
      setBackupStatus('success')
      setBackupMessage('Backup sin cifrar exportado correctamente.')
    } catch {
      setBackupStatus('error')
      setBackupMessage('No se pudo exportar el backup sin cifrar.')
    }
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setBackupStatus('running')
    setBackupMessage('')

    try {
      await importBackup(file)
      window.location.reload()
    } catch {
      setBackupStatus('error')
      setBackupMessage('No se pudo importar el backup.')
    } finally {
      event.target.value = ''
    }
  }

  async function handleImportEncryptedBackup(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setBackupStatus('running')
    setBackupMessage('')

    try {
      await importEncryptedBackup(file, getEncryptionKey())
      window.location.reload()
    } catch (error) {
      setBackupStatus('error')
      setBackupMessage(
        getErrorMessage(error, 'No se pudo importar el backup cifrado.'),
      )
    } finally {
      event.target.value = ''
    }
  }

  const isRunning = backupStatus === 'running'
  const isConnected = settings?.googleDriveConnected ?? false

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Backup"
        title="Respaldo de datos"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Cloud className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Backup en la nube
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Usa Google Drive App Folder con el scope limitado
              `drive.appdata`. Los datos se cifran antes de salir del
              dispositivo.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Google OAuth Client ID
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              disabled={!settings || isRunning}
              onChange={(event) =>
                updateLocalSettings({ googleDriveClientId: event.target.value })
              }
              placeholder="Client ID de OAuth"
              value={settings?.googleDriveClientId ?? ''}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Clave de cifrado
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              disabled={!settings || isRunning}
              onChange={(event) =>
                updateLocalSettings({ backupEncryptionKey: event.target.value })
              }
              type="password"
              value={settings?.backupEncryptionKey ?? ''}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-3">
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Backup automático
                </span>
                <span className="mt-1 block text-sm text-slate-500">
                  Intentar subida diaria al abrir la app.
                </span>
              </span>
              <input
                checked={settings?.driveBackupEnabled ?? false}
                className="size-5 accent-emerald-700"
                disabled={!settings || !isConnected || isRunning}
                onChange={(event) =>
                  updateLocalSettings({
                    driveBackupEnabled: event.target.checked,
                  })
                }
                type="checkbox"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Frecuencia
              </span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                disabled={!settings || isRunning}
                onChange={() =>
                  updateLocalSettings({ driveBackupFrequency: 'daily' })
                }
                value={settings?.driveBackupFrequency ?? 'daily'}
              >
                <option value="daily">Diario</option>
              </select>
            </label>
          </div>

          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-medium text-slate-700">Estado de conexión</p>
            <p className="mt-1 text-slate-500">
              {isConnected ? 'Conectado' : 'No conectado'}
            </p>
            <p className="mt-3 font-medium text-slate-700">
              Último backup realizado
            </p>
            <p className="mt-1 break-words text-slate-500">
              {settings?.googleDriveLastBackupAt ?? 'Sin ejecutar'}
            </p>
            <p className="mt-3 font-medium text-slate-700">
              Último estado del backup
            </p>
            <p className="mt-1 break-words text-slate-500">
              {settings?.googleDriveLastBackupStatus ??
                'Sin estado registrado'}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!settings || isRunning}
              onClick={handleConnectGoogleDrive}
              type="button"
            >
              <Cloud className="size-4" aria-hidden="true" />
              Conectar con Google Drive
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!settings || isRunning || !isConnected}
              onClick={handleDisconnectGoogleDrive}
              type="button"
            >
              <Link2Off className="size-4" aria-hidden="true" />
              Desconectar Google Drive
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!settings || isRunning || !isConnected}
              onClick={handleUploadDriveBackupNow}
              type="button"
            >
              <Send className="size-4" aria-hidden="true" />
              Subir backup ahora
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300 px-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!settings || isRunning || !isConnected}
              onClick={handleRestoreLatestDriveBackup}
              type="button"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Restaurar último backup
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Backup local cifrado
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Exporta o restaura archivos `.json.enc` usando la clave de
              cifrado local.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!settings || isRunning}
            onClick={handleExportEncryptedBackup}
            type="button"
          >
            <FileJson className="size-4" aria-hidden="true" />
            Generar backup cifrado
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRunning}
            onClick={() => encryptedFileInputRef.current?.click()}
            type="button"
          >
            <Upload className="size-4" aria-hidden="true" />
            Importar backup cifrado
          </button>
          <input
            accept=".enc,application/octet-stream,application/json,.json"
            className="hidden"
            onChange={handleImportEncryptedBackup}
            ref={encryptedFileInputRef}
            type="file"
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Importar backup JSON clásico
        </h2>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRunning}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload className="size-4" aria-hidden="true" />
            Importar backup JSON
          </button>
          <input
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportBackup}
            ref={fileInputRef}
            type="file"
          />
        </div>

        {backupMessage ? (
          <p
            className={[
              'mt-3 text-sm font-medium',
              backupStatus === 'error' ? 'text-rose-600' : 'text-emerald-700',
            ].join(' ')}
          >
            {backupMessage}
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Backup sin cifrar
        </h2>
        <p className="mt-1 text-sm text-amber-800">
          Esta opción descarga un JSON legible con datos sensibles. Úsala solo
          para migraciones puntuales o almacenamiento local controlado.
        </p>
        <button
          className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isRunning}
          onClick={handleExportPlainBackup}
          type="button"
        >
          <FileJson className="size-4" aria-hidden="true" />
          Exportar backup sin cifrar
        </button>
      </section>
    </section>
  )
}

export default SettingsBackupPage

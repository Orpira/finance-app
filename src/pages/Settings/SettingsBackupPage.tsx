import { FileJson, Upload } from 'lucide-react'
import { type ChangeEvent, useRef, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { exportBackup, importBackup } from '../../services/backupService'

type BackupStatus = 'idle' | 'exporting' | 'success' | 'error'

export function SettingsBackupPage() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle')
  const [backupMessage, setBackupMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleExportBackup() {
    setBackupStatus('exporting')
    setBackupMessage('')

    try {
      await exportBackup()
      setBackupStatus('success')
      setBackupMessage('Backup exportado correctamente.')
    } catch {
      setBackupStatus('error')
      setBackupMessage('No se pudo exportar el backup.')
    }
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setBackupStatus('exporting')
    setBackupMessage('')

    try {
      await importBackup(file)
      window.location.reload()
    } catch {
      setBackupStatus('error')
      setBackupMessage('No se pudo importar el backup.')
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Backup"
        title="Respaldo de datos"
      />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Exportar o importar backup
        </h2>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={backupStatus === 'exporting'}
            onClick={handleExportBackup}
            type="button"
          >
            <FileJson className="size-4" aria-hidden="true" />
            backup.json
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={backupStatus === 'exporting'}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload className="size-4" aria-hidden="true" />
            Importar backup
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
    </section>
  )
}

export default SettingsBackupPage

import { Database, Download, RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  getLocalDiagnosticReport,
  type LocalDiagnosticReport,
} from '../../services/localDiagnosticService'

function formatBytes(value: number | null): string {
  if (value === null) return 'No disponible'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string | null): string {
  if (!value) return 'Sin registro'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function SettingsDiagnosticsPage() {
  const [report, setReport] = useState<LocalDiagnosticReport | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const refresh = useCallback(async () => {
    setStatus('loading')
    try {
      setReport(await getLocalDiagnosticReport())
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    let active = true
    getLocalDiagnosticReport()
      .then((nextReport) => {
        if (!active) return
        setReport(nextReport)
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => { active = false }
  }, [])

  async function exportReport() {
    if (!report) return
    const { downloadDiagnosticReport } = await import('../../services/diagnosticExportService')
    await downloadDiagnosticReport(report)
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader backLabel="Configuración" backTo="/settings" eyebrow="Soporte" title="Diagnóstico local">
        <button
          aria-label="Actualizar diagnóstico local"
          className="inline-flex size-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          disabled={status === 'loading'}
          onClick={() => void refresh()}
          title="Actualizar diagnóstico"
          type="button"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </PageHeader>

      <div aria-live="polite">
        {status === 'loading' ? <p className="text-sm text-slate-500">Revisando la base local...</p> : null}
        {status === 'error' ? <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">No se pudo completar el diagnóstico local.</p> : null}
      </div>

      {report ? (
        <>
          <section aria-labelledby="diagnostic-status" className="border-y border-slate-200 py-5 dark:border-slate-800">
            <h2 className="flex items-center gap-2 text-base font-semibold" id="diagnostic-status">
              <ShieldCheck aria-hidden="true" className="size-5 text-emerald-700" />
              Estado del sistema
            </h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div><dt className="text-xs text-slate-500">Integridad</dt><dd className="font-semibold">{report.integrity === 'healthy' ? 'Correcta' : 'Requiere revisión'}</dd></div>
              <div><dt className="text-xs text-slate-500">Versión</dt><dd className="font-semibold">{report.appVersion}</dd></div>
              <div><dt className="text-xs text-slate-500">Plataforma</dt><dd className="font-semibold">{report.platform}</dd></div>
              <div><dt className="text-xs text-slate-500">Esquema local</dt><dd className="font-semibold">v{report.schemaVersion}</dd></div>
              <div><dt className="text-xs text-slate-500">Espacio utilizado</dt><dd className="font-semibold">{formatBytes(report.storage.usageBytes)}</dd></div>
              <div><dt className="text-xs text-slate-500">Espacio disponible</dt><dd className="font-semibold">{formatBytes(report.storage.quotaBytes)}</dd></div>
              <div><dt className="text-xs text-slate-500">Último backup</dt><dd className="font-semibold">{formatDate(report.lastBackupAt)}</dd></div>
              <div><dt className="text-xs text-slate-500">Última restauración</dt><dd className="font-semibold">{formatDate(report.lastRestoreAt)}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="diagnostic-counts">
            <h2 className="flex items-center gap-2 text-base font-semibold" id="diagnostic-counts"><Database aria-hidden="true" className="size-5 text-sky-700" />Registros por módulo</h2>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(report.recordCounts).map(([name, count]) => (
                <div className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800" key={name}><dt className="text-sm text-slate-600 dark:text-slate-300">{name}</dt><dd className="font-semibold">{count}</dd></div>
              ))}
            </dl>
          </section>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <p className="max-w-xl text-sm text-slate-500">El archivo contiene metadatos técnicos y conteos. No incluye importes, descripciones ni movimientos.</p>
            <button className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2" onClick={() => void exportReport()} type="button">
              <Download aria-hidden="true" className="size-4" />
              Exportar diagnóstico
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

export default SettingsDiagnosticsPage

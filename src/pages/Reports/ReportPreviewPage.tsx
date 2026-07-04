import { FileText, Share2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { useDialog } from '../../components/dialogs/useDialog'

interface ReportPreview {
  html: string
  text: string
  title: string
}

function getStoredReportPreview(): ReportPreview | null {
  const storedReport = window.sessionStorage.getItem('report-preview')

  if (!storedReport) {
    return null
  }

  try {
    const parsedReport = JSON.parse(storedReport) as Partial<ReportPreview>

    if (!parsedReport.html || !parsedReport.text || !parsedReport.title) {
      return null
    }

    return {
      html: parsedReport.html,
      text: parsedReport.text,
      title: parsedReport.title,
    }
  } catch {
    return null
  }
}

function openPrintReport(title: string, html: string) {
  const printWindow = window.open('', '_blank', 'noopener,noreferrer')

  if (!printWindow) {
    return false
  }

  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.document.title = title
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 250)
  return true
}

export function ReportPreviewPage() {
  const { alert } = useDialog()
  const report = useMemo(() => getStoredReportPreview(), [])

  async function handlePrintReport() {
    if (!report || openPrintReport(report.title, report.html)) {
      return
    }

    await alert({
      type: 'error',
      title: 'No se pudo abrir la impresión',
      message: 'No se pudo abrir la ventana de impresión.',
    })
  }

  async function handleShareReport() {
    if (!report) {
      return
    }

    try {
      const { shareReportPdf } = await import('../../services/reportShareService')

      await shareReportPdf({
        fileName: report.title,
        html: report.html,
        text: report.text,
        title: report.title,
      })
    } catch {
      await alert({
        type: 'error',
        title: 'No se pudo compartir el reporte',
        message: 'No se pudo compartir el PDF del reporte.',
      })
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        backLabel="Reportes"
        backTo="/reports"
        eyebrow="Vista previa"
        title={report?.title ?? 'Reporte'}
      >
        {report ? (
          <>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={handleShareReport}
              type="button"
            >
              <Share2 className="size-4" aria-hidden="true" />
              Compartir PDF
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
              onClick={handlePrintReport}
              type="button"
            >
              <FileText className="size-4" aria-hidden="true" />
              Generar PDF
            </button>
          </>
        ) : null}
      </PageHeader>

      {report ? (
        <iframe
          className="h-[calc(100dvh-12rem)] min-h-[28rem] w-full rounded-lg border border-slate-200 bg-white shadow-sm"
          srcDoc={report.html}
          title={`Vista previa ${report.title}`}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <p>No hay una vista previa de reporte disponible.</p>
          <Link
            className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            to="/reports"
          >
            Volver a reportes
          </Link>
        </div>
      )}
    </section>
  )
}

export default ReportPreviewPage

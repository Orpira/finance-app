import { buildSafeDiagnosticExport, type LocalDiagnosticReport } from './localDiagnosticService'
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export async function downloadDiagnosticReport(report: LocalDiagnosticReport): Promise<void> {
  const content = JSON.stringify(buildSafeDiagnosticExport(report), null, 2)
  const fileName = `private-balance-diagnostic-${report.generatedAt.slice(0, 10)}.json`
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      path: fileName,
    })
    await Share.share({ title: 'Diagnóstico de Private Balance', files: [file.uri] })
    return
  }
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

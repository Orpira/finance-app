export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadText(content: string, fileName: string, type: string) {
  downloadBlob(new Blob([content], { type }), fileName)
}

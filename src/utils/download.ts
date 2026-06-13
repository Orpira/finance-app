import { Capacitor, registerPlugin } from '@capacitor/core'

interface FileDownloadPlugin {
  saveFile(options: {
    base64Data: string
    fileName: string
    mimeType: string
  }): Promise<{ uri?: string }>
}

const FileDownload = registerPlugin<FileDownloadPlugin>('FileDownload')

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('No se pudo preparar el archivo.'))
    reader.onload = () => {
      const result = String(reader.result)
      const [, base64Data = ''] = result.split(',')

      resolve(base64Data)
    }
    reader.readAsDataURL(blob)
  })
}

async function downloadBlobNative(blob: Blob, fileName: string) {
  await FileDownload.saveFile({
    base64Data: await blobToBase64(blob),
    fileName,
    mimeType: blob.type || 'application/octet-stream',
  })
}

function downloadBlobWeb(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

export async function downloadBlob(blob: Blob, fileName: string) {
  if (Capacitor.isNativePlatform()) {
    await downloadBlobNative(blob, fileName)
    return
  }

  downloadBlobWeb(blob, fileName)
}

export async function downloadText(
  content: string,
  fileName: string,
  type: string,
) {
  await downloadBlob(new Blob([content], { type }), fileName)
}

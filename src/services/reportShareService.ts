import { Directory, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface ShareReportPdfOptions {
  fileName: string
  html: string
  text: string
  title: string
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function createReportPdfFromText(options: ShareReportPdfOptions) {
  const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 14
  const maxWidth = pageWidth - margin * 2
  const lineHeight = 6
  let cursorY = 18

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.text(options.title, margin, cursorY)
  cursorY += 10

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)

  const lines = options.text.split('\n')
  const contentLines = lines[0] === options.title ? lines.slice(1) : lines

  contentLines.forEach((line) => {
    const wrappedLines = pdf.splitTextToSize(line || ' ', maxWidth) as string[]

    wrappedLines.forEach((wrappedLine) => {
      if (cursorY > pageHeight - margin) {
        pdf.addPage()
        cursorY = margin
      }

      pdf.text(wrappedLine, margin, cursorY)
      cursorY += lineHeight
    })
  })

  return pdf
}

function createRenderContainer(html: string) {
  const parsedDocument = new DOMParser().parseFromString(html, 'text/html')
  const container = document.createElement('div')
  const page = document.createElement('div')
  const style = document.createElement('style')
  const sourceStyles = Array.from(parsedDocument.querySelectorAll('style'))
    .map((styleElement) => styleElement.textContent ?? '')
    .join('\n')

  style.textContent = `
    ${sourceStyles}
    .pdf-render-page {
      background: #ffffff;
      box-sizing: border-box;
      color: #0f172a;
      font-family: Inter, Arial, sans-serif;
      font-size: 12px;
      line-height: 1.45;
      min-height: 1123px;
      padding: 68px;
      width: 794px;
    }
    .pdf-render-page * {
      box-sizing: border-box;
    }
    .pdf-render-page table {
      break-inside: auto;
      page-break-inside: auto;
    }
    .pdf-render-page tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  `
  page.className = 'pdf-render-page'
  page.innerHTML = parsedDocument.body.innerHTML

  container.style.background = '#ffffff'
  container.style.left = '-10000px'
  container.style.position = 'fixed'
  container.style.top = '0'
  container.style.width = '794px'
  container.append(style, page)
  document.body.append(container)

  return {
    page,
    remove: () => container.remove(),
  }
}

async function createReportPdfFromHtml(options: ShareReportPdfOptions) {
  if (!options.html) {
    return createReportPdfFromText(options)
  }

  const pdf = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
  const renderContainer = createRenderContainer(options.html)
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  try {
    const canvas = await html2canvas(renderContainer.page, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      windowWidth: 794,
    })
    const pageSliceHeight = Math.floor((canvas.width * pageHeight) / pageWidth)
    let sourceY = 0
    let pageIndex = 0

    while (sourceY < canvas.height) {
      const sliceHeight = Math.min(pageSliceHeight, canvas.height - sourceY)
      const sliceCanvas = document.createElement('canvas')
      const sliceContext = sliceCanvas.getContext('2d')

      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeight

      if (sliceContext) {
        sliceContext.fillStyle = '#ffffff'
        sliceContext.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        sliceContext.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        )
      }

      if (pageIndex > 0) {
        pdf.addPage()
      }

      const sliceImage = sliceCanvas.toDataURL('image/png')
      const slicePageHeight = (sliceHeight * pageWidth) / canvas.width

      pdf.addImage(sliceImage, 'PNG', 0, 0, pageWidth, slicePageHeight)

      sourceY += sliceHeight
      pageIndex += 1
    }

    return pdf
  } finally {
    renderContainer.remove()
  }
}

async function createReportPdf(options: ShareReportPdfOptions) {
  try {
    return await createReportPdfFromHtml(options)
  } catch {
    return createReportPdfFromText(options)
  }
}

function downloadPdfWeb(blob: Blob, fileName: string) {
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

async function sharePdfWeb(blob: Blob, fileName: string, title: string) {
  const file = new File([blob], fileName, { type: 'application/pdf' })
  const canShareFiles =
    typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  if (canShareFiles && typeof navigator.share === 'function') {
    await navigator.share({
      files: [file],
      title,
    })
    return
  }

  downloadPdfWeb(blob, fileName)
}

export async function shareReportPdf(options: ShareReportPdfOptions) {
  const pdf = await createReportPdf(options)
  const fileName = `${sanitizeFileName(options.fileName) || 'reporte'}.pdf`

  if (Capacitor.isNativePlatform()) {
    const base64Data = pdf.output('datauristring').split(',')[1] ?? ''
    const savedFile = await Filesystem.writeFile({
      data: base64Data,
      directory: Directory.Cache,
      path: fileName,
    })

    await Share.share({
      dialogTitle: 'Compartir reporte',
      files: [savedFile.uri],
      title: options.title,
    })
    return
  }

  await sharePdfWeb(pdf.output('blob'), fileName, options.title)
}

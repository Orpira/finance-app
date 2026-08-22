import { beforeEach, describe, expect, it, vi } from 'vitest'

const writeFileMock = vi.fn()
const shareMock = vi.fn()
let isNativePlatform = true

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNativePlatform,
  },
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: (...args: unknown[]) => writeFileMock(...args),
  },
}))

vi.mock('@capacitor/share', () => ({
  Share: {
    share: (...args: unknown[]) => shareMock(...args),
  },
}))

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => {
    throw new Error('html render unavailable')
  }),
}))

const { shareReportPdf } = await import('./reportShareService')

beforeEach(() => {
  vi.clearAllMocks()
  isNativePlatform = true
  writeFileMock.mockResolvedValue({ uri: 'file:///cache/reporte.pdf' })
  shareMock.mockResolvedValue({})
})

describe('shareReportPdf', () => {
  it('devuelve success cuando Android comparte el PDF', async () => {
    await expect(
      shareReportPdf({ fileName: 'Reporte', html: '', text: 'Contenido', title: 'Reporte' }),
    ).resolves.toBe('success')
  })

  it('devuelve cancelled cuando el selector se cancela voluntariamente', async () => {
    shareMock.mockRejectedValueOnce(new DOMException('Share canceled', 'AbortError'))

    await expect(
      shareReportPdf({ fileName: 'Reporte', html: '', text: 'Contenido', title: 'Reporte' }),
    ).resolves.toBe('cancelled')
  })

  it('propaga un error real de Android Share', async () => {
    shareMock.mockRejectedValueOnce(new Error('Filesystem unavailable'))

    await expect(
      shareReportPdf({ fileName: 'Reporte', html: '', text: 'Contenido', title: 'Reporte' }),
    ).rejects.toThrow('Filesystem unavailable')
  })
})

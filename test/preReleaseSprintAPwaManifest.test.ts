import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

interface ManifestIcon {
  readonly src: string
  readonly type: string
  readonly sizes: string
  readonly purpose?: string
}

interface WebManifest {
  readonly name: string
  readonly display: string
  readonly icons: readonly ManifestIcon[]
}

const manifest = JSON.parse(
  readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'),
) as WebManifest
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const appleTouchIcon = readFileSync(new URL('../public/apple-touch-icon.png', import.meta.url))

describe('pre-release Sprint A PWA manifest', () => {
  it('declares install icons with paths and MIME types matching their files', () => {
    expect(manifest.name).toBe('Private Balance')
    expect(manifest.display).toBe('standalone')
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)

    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\/icons\/icon-\d+\.webp$/)
      expect(icon.type).toBe('image/webp')
      expect(icon.sizes).toMatch(/^\d+x\d+$/)
      expect(icon.purpose).toContain('any')
    }
  })

  it('declares a valid 180x180 Apple Touch Icon from public assets', () => {
    expect(indexHtml).toContain(
      '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
    )
    expect(appleTouchIcon.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect(appleTouchIcon.readUInt32BE(16)).toBe(180)
    expect(appleTouchIcon.readUInt32BE(20)).toBe(180)
  })
})

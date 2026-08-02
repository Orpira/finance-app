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
})

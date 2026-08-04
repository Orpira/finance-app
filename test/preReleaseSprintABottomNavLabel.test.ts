import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL('../src/app/AppLayout.tsx', import.meta.url),
  'utf8',
)

/**
 * Live measurement at 390px (mobileV, the narrowest supported width) showed
 * the "Configuración" bottom-nav label needing 69px of a 72px grid column
 * (nav `px-1` item padding plus `gap-1` between the five columns left only
 * 64px), clipping it to "Configurac…" while every shorter sibling label
 * rendered in full. Removing the item's own horizontal padding and tightening
 * the grid gap to `gap-0.5` reclaims exactly the missing width (measured
 * 73px column, label fits at 69px, zero clipping) without touching wording,
 * icons or the five-column grid.
 */
describe('pre-release Sprint A - bottom nav label fit', () => {
  it('gives the mobile bottom-nav items enough width for the longest label', () => {
    const gridMatch = source.match(/"mx-auto grid max-w-5xl grid-cols-5[^"]*"/)
    expect(gridMatch).not.toBeNull()
    expect(gridMatch![0]).toContain('gap-0.5')

    const navItemMatch = source.match(/'flex min-h-14 flex-col[^']*'/)
    expect(navItemMatch).not.toBeNull()
    expect(navItemMatch![0]).toContain('px-0 ')
  })
})

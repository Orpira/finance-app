import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL('../src/app/AppLayout.tsx', import.meta.url),
  'utf8',
)

/**
 * Live measurement at 390px (mobileV, the narrowest supported width) showed
 * the "Configuración" bottom-nav label needing 69px of a 72px grid column.
 * The final design keeps five equal columns, lets every grid item shrink below
 * its intrinsic label width and confines each link and label to that column.
 * This prevents the last item from escaping narrow Android viewports while
 * preserving the full-width layout and horizontal safe-area insets.
 */
describe('pre-release Sprint A - bottom nav label fit', () => {
  it('gives the mobile bottom-nav items enough width for the longest label', () => {
    const gridMatch = source.match(/"mx-auto grid w-full max-w-5xl grid-cols-5[^"]*"/)
    expect(gridMatch).not.toBeNull()
    expect(gridMatch![0]).toContain('gap-0.5')

    expect(source).toContain('pl-[max(env(safe-area-inset-left),0.5rem)]')
    expect(source).toContain('pr-[max(env(safe-area-inset-right),0.5rem)]')
    expect(source).toContain('<li className="min-w-0" key={path}>')

    const navItemMatch = source.match(/'flex min-h-14 w-full min-w-0 flex-col[^']*'/)
    expect(navItemMatch).not.toBeNull()
    expect(navItemMatch![0]).toContain('overflow-hidden')

    const labelMatch = source.match(/<span className="([^"]*)">\{label\}<\/span>/)
    expect(labelMatch).not.toBeNull()
    expect(labelMatch![1]).toContain('w-full')
    expect(labelMatch![1]).toContain('truncate')
  })
})

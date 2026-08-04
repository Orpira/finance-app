import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL('../src/routes/index.tsx', import.meta.url),
  'utf8',
)

/**
 * Live audit confirmed: with no catch-all route, navigating to any unknown
 * URL (a stale bookmark, a typo, a removed deep link) rendered a fully blank
 * white page with zero focusable elements — a dead end for every input
 * method, not a designed empty state. The fix is a `path="*"` route nested
 * under the same `<AppLayout />` parent so the shell and a way back to
 * Inicio always render.
 */
describe('pre-release Sprint A - unknown route fallback', () => {
  it('routes any unmatched path to a NotFoundPage inside the AppLayout shell', () => {
    expect(source).toContain("import NotFoundPage from '../pages/NotFound/NotFoundPage'")

    const layoutRouteMatch = source.match(
      /<Route element=\{<AppLayout \/>\}>([\s\S]*?)<\/Route>\s*<\/Routes>/,
    )
    expect(layoutRouteMatch).not.toBeNull()

    const layoutChildren = layoutRouteMatch![1]
    expect(layoutChildren).toContain('<Route path="*" element={<NotFoundPage />} />')

    const catchAllTag = '<Route path="*" element={<NotFoundPage />} />'
    const catchAllIndex = layoutChildren.indexOf(catchAllTag)
    const remainderAfterCatchAll = layoutChildren.slice(catchAllIndex + catchAllTag.length)
    expect(remainderAfterCatchAll).not.toContain('<Route')
  })
})

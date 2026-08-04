import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL('../src/app/AppLayout.tsx', import.meta.url),
  'utf8',
)

/**
 * Tailwind spacing scale: `w-N` / `ml-N` resolve to `N * 0.25rem`. The
 * desktop sidebar is `fixed`, so it never shrinks `<main>`'s containing
 * block; `<main>` must subtract the sidebar's own width from its `width`
 * in addition to offsetting it with `margin-left`, or it silently
 * overflows the viewport by exactly the sidebar's width at any breakpoint
 * where `max-w-5xl` isn't already the binding constraint (confirmed live:
 * scrollWidth 1090/1100 vs viewport 834/844, a 256px/16rem excess).
 */
describe('pre-release Sprint A - AppLayout overflow', () => {
  it('sizes the fixed sidebar and the main content offset with the same width', () => {
    const asideMatch = source.match(/<aside\s+className="([^"]*)"/)
    expect(asideMatch).not.toBeNull()
    const sidebarWidthMatch = asideMatch![1].match(/(?:^|\s)w-(\d+)(?:\s|$)/)
    expect(sidebarWidthMatch).not.toBeNull()
    const sidebarSpacingUnit = Number(sidebarWidthMatch![1])
    const sidebarRem = sidebarSpacingUnit * 0.25

    const mainMatch = source.match(/'mx-auto min-h-dvh w-full max-w-5xl[^']*'/)
    expect(mainMatch).not.toBeNull()
    const mainClassName = mainMatch![0]

    const marginMatch = mainClassName.match(/md:ml-(\d+)/)
    expect(marginMatch).not.toBeNull()
    expect(Number(marginMatch![1])).toBe(sidebarSpacingUnit)

    const widthCompensationMatch = mainClassName.match(
      /md:w-\[calc\(100%-(\d+(?:\.\d+)?)rem\)\]/,
    )
    expect(widthCompensationMatch).not.toBeNull()
    expect(Number(widthCompensationMatch![1])).toBe(sidebarRem)
  })
})

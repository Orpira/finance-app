import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('currency quote navigation', () => {
  it('exposes the tool from Más instead of Inicio', () => {
    const layout = read('../src/app/AppLayout.tsx')
    const home = read('../src/pages/Home/HomePage.tsx')
    const more = read('../src/pages/More/MorePage.tsx')
    const routes = read('../src/routes/index.tsx')

    expect(more).toContain("href: '/currency-converter'")
    expect(more).toContain("label: 'Consulta de divisas'")
    expect(routes).toContain('path="currency-converter"')
    expect(layout).toContain("'/currency-converter'")
    expect(layout).toContain('const basicNavItems = [HOME_ITEM, MOVEMENTS_ITEM, REPORTS_ITEM, ASSISTANT_ITEM, MORE_ITEM]')
    expect(layout).toContain("? ['/more', '/temporadas', '/currency-converter', '/settings', '/debug']")
    expect(home).not.toContain('<CurrencyQuoteCard')
  })
})
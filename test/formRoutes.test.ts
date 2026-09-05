import { describe, expect, it } from 'vitest'

import { isDataEntryFormRoute } from '../src/utils/formRoutes'

describe('data entry form routes', () => {
  it.each([
    '/income/nuevo',
    '/income/42/editar',
    '/expenses/nuevo',
    '/expenses/42/editar',
    '/agenda/nueva',
    '/agenda/42/editar',
    '/temporadas/nueva',
  ])('hides the context switcher on %s', (pathname) => {
    expect(isDataEntryFormRoute(pathname)).toBe(true)
  })

  it.each([
    '/',
    '/income',
    '/income/42',
    '/expenses',
    '/agenda',
    '/temporadas',
    '/temporadas/42',
    '/settings/usage-mode',
  ])('keeps the context switcher available on %s', (pathname) => {
    expect(isDataEntryFormRoute(pathname)).toBe(false)
  })
})

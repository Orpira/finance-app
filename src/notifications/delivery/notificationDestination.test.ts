import { describe, expect, it } from 'vitest'

import { isValidInternalDestination } from './notificationDestination'

describe('isValidInternalDestination', () => {
  it('acepta rutas internas simples', () => {
    expect(isValidInternalDestination('/temporadas/123')).toBe(true)
    expect(isValidInternalDestination('/agenda')).toBe(true)
  })

  it('acepta rutas internas con query string', () => {
    expect(isValidInternalDestination('/agenda?date=2026-08-31&appointment=1')).toBe(true)
  })

  it('rechaza esquemas javascript: y data:', () => {
    expect(isValidInternalDestination('javascript:alert(1)')).toBe(false)
    expect(isValidInternalDestination('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rechaza URLs externas absolutas', () => {
    expect(isValidInternalDestination('https://malicious.example')).toBe(false)
    expect(isValidInternalDestination('http://malicious.example')).toBe(false)
  })

  it('rechaza URLs protocol-relative', () => {
    expect(isValidInternalDestination('//malicious.example')).toBe(false)
  })

  it('rechaza valores no-string, vacíos o null', () => {
    expect(isValidInternalDestination(null)).toBe(false)
    expect(isValidInternalDestination(undefined)).toBe(false)
    expect(isValidInternalDestination('')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { buildNormalizedWalletName, normalizeWalletName } from '../src/utils/walletName'

describe('normalizeWalletName', () => {
  it('trims repeated spaces and preserves accents', () => {
    expect(normalizeWalletName('  Cuenta   principal  ')).toBe('Cuenta principal')
  })

  it('rejects empty names', () => {
    expect(() => normalizeWalletName('   ')).toThrow('Debe indicar')
  })

  it('rejects non-string values', () => {
    expect(() => normalizeWalletName(123)).toThrow('debe ser texto')
  })

  it('rejects names over the maximum length', () => {
    expect(() => normalizeWalletName('a'.repeat(51))).toThrow('máximo')
  })
})

describe('buildNormalizedWalletName', () => {
  it('ignora mayúsculas y minúsculas', () => {
    expect(buildNormalizedWalletName('Efectivo')).toBe(buildNormalizedWalletName('EFECTIVO'))
  })

  it('ignora tildes', () => {
    expect(buildNormalizedWalletName('Cuenta')).toBe(buildNormalizedWalletName('Cuénta'))
  })

  it('produce el valor canónico esperado', () => {
    expect(buildNormalizedWalletName('  Dinero   en Casa  ')).toBe('dinero en casa')
  })
})

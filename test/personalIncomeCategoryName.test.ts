import { describe, expect, it } from 'vitest'

import {
  buildNormalizedPersonalIncomeCategoryName,
  normalizePersonalIncomeCategoryName,
} from '../src/utils/personalIncomeCategoryName'

describe('normalizePersonalIncomeCategoryName', () => {
  it('trims repeated spaces and preserves accents', () => {
    expect(normalizePersonalIncomeCategoryName('  Nómina   extra  ')).toBe('Nómina extra')
  })

  it('rejects empty names', () => {
    expect(() => normalizePersonalIncomeCategoryName('   ')).toThrow('Debe indicar')
  })

  it('rejects non-string values', () => {
    expect(() => normalizePersonalIncomeCategoryName(123)).toThrow('debe ser texto')
  })

  it('rejects names over the maximum length', () => {
    expect(() => normalizePersonalIncomeCategoryName('a'.repeat(51))).toThrow('máximo')
  })
})

describe('buildNormalizedPersonalIncomeCategoryName', () => {
  it('ignora mayúsculas y minúsculas', () => {
    expect(buildNormalizedPersonalIncomeCategoryName('Nómina')).toBe(
      buildNormalizedPersonalIncomeCategoryName('NÓMINA'),
    )
  })

  it('ignora espacios exteriores', () => {
    expect(buildNormalizedPersonalIncomeCategoryName('  Nómina  ')).toBe(
      buildNormalizedPersonalIncomeCategoryName('Nómina'),
    )
  })

  it('ignora espacios repetidos', () => {
    expect(buildNormalizedPersonalIncomeCategoryName('Nómina   extra')).toBe(
      buildNormalizedPersonalIncomeCategoryName('Nómina extra'),
    )
  })

  it('ignora tildes', () => {
    expect(buildNormalizedPersonalIncomeCategoryName('Nómina')).toBe(
      buildNormalizedPersonalIncomeCategoryName('Nomina'),
    )
  })

  it('produce el valor canónico esperado', () => {
    expect(buildNormalizedPersonalIncomeCategoryName('  Nómina   Extra  ')).toBe('nomina extra')
  })
})

import { describe, expect, it } from 'vitest'

import { QUICK_SUGGESTIONS } from './quickSuggestions'

describe('QUICK_SUGGESTIONS', () => {
  it('incluye la comparación de temporada activa, junto a la comparación mensual existente', () => {
    expect(QUICK_SUGGESTIONS).toContain('Comparar esta temporada con la anterior')
    expect(QUICK_SUGGESTIONS).toContain('Comparar este mes con el anterior')
  })
})

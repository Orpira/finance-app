import { beforeEach, describe, expect, it } from 'vitest'

import { interpretAssistantMessage } from './assistantConfirmationFlow'
import { clearPrivacyInspectionTrail, getPrivacyInspectionTrail } from './assistantPrivacyInspector'

const CONTEXT = { defaultCurrency: 'EUR' as const, usageMode: 'professional' as const, now: new Date('2026-08-01T10:00:00.000Z') }

beforeEach(() => {
  clearPrivacyInspectionTrail()
})

describe('interpretAssistantMessage', () => {
  it('devuelve una propuesta para un mensaje de acción reconocido', () => {
    const result = interpretAssistantMessage('Hoy recibí 120 euros por un servicio', CONTEXT)

    expect(result.kind).toBe('proposal')
    if (result.kind !== 'proposal') throw new Error('expected proposal')
    expect(result.proposal.kind).toBe('register_income')
  })

  it('devuelve no-action para una consulta, sin construir propuesta', () => {
    expect(interpretAssistantMessage('¿Cuánto gané esta semana?', CONTEXT)).toEqual({ kind: 'no-action' })
  })

  it('autoriza el contexto vía la frontera de privacidad 8A en modo LOCAL_ONLY, sin datos financieros', () => {
    interpretAssistantMessage('Gasté 35 euros en transporte', CONTEXT)

    const trail = getPrivacyInspectionTrail()
    expect(trail).toHaveLength(1)
    expect(trail[0].decision).toBe('authorized')
    expect(trail[0].processingMode).toBe('LOCAL_ONLY')
    expect(trail[0].categoriesIncluded).toEqual(['APP_METADATA'])
    expect(JSON.stringify(trail[0])).not.toMatch(/\b35\b/)
  })

  it('no autoriza (ni registra) nada para mensajes que no son de acción', () => {
    interpretAssistantMessage('¿Cuánto gané esta semana?', CONTEXT)

    expect(getPrivacyInspectionTrail()).toHaveLength(0)
  })
})

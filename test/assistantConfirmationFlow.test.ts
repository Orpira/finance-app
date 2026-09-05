import { describe, expect, it } from 'vitest'

import { interpretAssistantMessage } from '../src/intelligence/assistant/assistantConfirmationFlow'

// Bloque 3 (Copiloto): la agenda es exclusivamente profesional — sin este
// chequeo, un mensaje como "tengo una cita mañana" en Personal llegaría a
// createAppointment() y fallaría con un error técnico de temporada en vez
// de un rechazo claro por capacidad (ver assertion en createAppointment,
// appointmentService.ts, que exige requireActiveEarningPeriod()).

describe('interpretAssistantMessage — aislamiento de agenda por contexto', () => {
  it('rechaza crear una cita en contexto basic (Personal) sin generar propuesta', () => {
    const result = interpretAssistantMessage('Tengo una cita mañana a las 3pm', {
      defaultCurrency: 'EUR',
      usageMode: 'basic',
    })

    expect(result.kind).toBe('capability-denied')
    if (result.kind === 'capability-denied') {
      expect(result.safeMessage).toContain('Profesional')
    }
  })

  it('permite crear una cita en contexto professional', () => {
    const result = interpretAssistantMessage('Tengo una cita mañana a las 3pm', {
      defaultCurrency: 'EUR',
      usageMode: 'professional',
    })

    expect(result.kind).toBe('proposal')
  })

  it('en Híbrido, respeta el contexto activo (no el modo crudo "hybrid")', () => {
    const inBasicContext = interpretAssistantMessage('Agendar una reunion el lunes', {
      defaultCurrency: 'EUR',
      usageMode: 'basic',
    })
    const inProfessionalContext = interpretAssistantMessage('Agendar una reunion el lunes', {
      defaultCurrency: 'EUR',
      usageMode: 'professional',
    })

    expect(inBasicContext.kind).toBe('capability-denied')
    expect(inProfessionalContext.kind).toBe('proposal')
  })

  it('no bloquea acciones no relacionadas con agenda en basic', () => {
    const result = interpretAssistantMessage('Hoy recibí 120 euros por un servicio', {
      defaultCurrency: 'EUR',
      usageMode: 'basic',
    })

    expect(result.kind).toBe('proposal')
  })
})

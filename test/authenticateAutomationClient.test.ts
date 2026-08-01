import { beforeEach, describe, expect, it } from 'vitest'

import { authenticateAutomationClient } from '../server/communication/security/authenticateAutomationClient'
import { CommunicationAuthenticationError } from '../server/communication/errors/communicationErrors'
import { resetRateLimiter } from '../server/communication/security/rateLimiter'

const API_KEY = 'n8n-shared-secret-key'

beforeEach(() => {
  resetRateLimiter()
})

describe('authenticateAutomationClient', () => {
  it('acepta un Bearer token que coincide exactamente', () => {
    expect(() => authenticateAutomationClient(`Bearer ${API_KEY}`, API_KEY)).not.toThrow()
  })

  it('rechaza cuando falta la cabecera Authorization', () => {
    expect(() => authenticateAutomationClient(undefined, API_KEY)).toThrow(CommunicationAuthenticationError)
  })

  it('rechaza un esquema distinto de Bearer', () => {
    expect(() => authenticateAutomationClient(`Basic ${API_KEY}`, API_KEY)).toThrow(CommunicationAuthenticationError)
  })

  it('rechaza una clave incorrecta con el mismo mensaje genérico que una cabecera ausente', () => {
    let missingHeaderMessage = ''
    let wrongKeyMessage = ''
    try {
      authenticateAutomationClient(undefined, API_KEY)
    } catch (error) {
      missingHeaderMessage = (error as Error).message
    }
    try {
      authenticateAutomationClient('Bearer wrong-key', API_KEY)
    } catch (error) {
      wrongKeyMessage = (error as Error).message
    }
    expect(missingHeaderMessage).toBe(wrongKeyMessage)
  })

  it('no acepta la clave pasada en query params (solo evalúa la cabecera Authorization)', () => {
    expect(() => authenticateAutomationClient(undefined, API_KEY)).toThrow()
  })

  it('bloquea nuevos intentos tras superar el umbral de fallos en la ventana', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect(() => authenticateAutomationClient('Bearer wrong', API_KEY)).toThrow(CommunicationAuthenticationError)
    }
    expect(() => authenticateAutomationClient(`Bearer ${API_KEY}`, API_KEY)).toThrow(CommunicationAuthenticationError)
  })
})

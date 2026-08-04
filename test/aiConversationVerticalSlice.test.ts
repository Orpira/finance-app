import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import {
  createConversationControllerDependencies,
} from '../src/pages/Conversation/conversationComposition'
import {
  createConversationController,
} from '../src/pages/Conversation/conversationController'
import ConversationPage from '../src/pages/Conversation/ConversationPage'

describe('AI Conversation main integration (PB-IS-013.8)', () => {
  it('ejecuta flujo real facade + mock renderer y agrega respuesta del asistente', async () => {
    // environment: {} aisla el test del .env/.env.local reales del
    // repositorio (que configuran VITE_AI_PROVIDER=openai); sin esto, el test
    // haria una llamada de red real a OpenAI en lugar de ejercitar el flujo
    // determinista con el Mock Conversational Renderer.
    const dependencies = createConversationControllerDependencies({ environment: {} })
    const controller = createConversationController(dependencies)

    await controller.initialize()
    await controller.sendMessage('Cuanto dinero tengo disponible?')

    const state = controller.getState()
    expect(state.messages.length).toBe(2)
    expect(state.messages[0].role).toBe('USER')
    expect(state.messages[1].role).toBe('ASSISTANT')
    expect(state.messages[1].text.length).toBeGreaterThan(0)
  })

  it('renderiza ConversationPage con las burbujas y composer existentes', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(ConversationPage),
      ),
    )

    expect(html).toContain('Copiloto')
    expect(html).toContain('Cargando conversación...')
    expect(html).toContain('Enviar')
  })

  it('mantiene la navegacion de /conversation y elimina dependencia directa de proveedor en composition', () => {
    const routesPath = resolve(__dirname, '../src/routes/index.tsx')
    const compositionPath = resolve(__dirname, '../src/pages/Conversation/conversationComposition.ts')

    const routesSource = readFileSync(routesPath, 'utf8')
    const compositionSource = readFileSync(compositionPath, 'utf8')

    expect(routesSource).toContain('path="conversation"')
    expect(routesSource).toContain('ConversationPage')

    expect(compositionSource).toContain('createAIConversationFacade')
    expect(compositionSource).toContain('createActivationEngineFromResolver')
    expect(compositionSource).toContain('createFinancialAIToolResolver')
    expect(compositionSource).toContain('createFinancialConversationSkillModule')
    expect(compositionSource).toContain('createAIConversationService')
    expect(compositionSource).toContain('processConversation')
    expect(compositionSource).not.toContain('provider.resolveIntent(')
    expect(compositionSource).not.toContain('provider.generateConversation(')
    expect(compositionSource).not.toContain('createDefaultAIConversationApplicationService')
    expect(compositionSource).not.toContain('createOpenAIProviderAdapter')
    expect(compositionSource).not.toContain('createMockConversationalRenderer')
    expect(compositionSource).not.toContain('createIntentResolver')
  })
})

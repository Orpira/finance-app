import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import AssistantInteractiveDemo from '../src/pages/Conversation/AssistantInteractiveDemo'
import { resolveAssistantDemoResponse } from '../src/pages/Conversation/assistantInteractiveDemoSandbox'

describe('AssistantInteractiveDemo para licencias gratuitas', () => {
  it('renderiza la entrada local con indicador y boton principal de demostracion', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(AssistantInteractiveDemo),
      ),
    )

    expect(html).toContain('Demostración interactiva')
    expect(html).toContain('Sandbox guiado')
    expect(html).toContain('Ver demostración')
    expect(html).toContain('datos ficticios')
    expect(html).toContain('no usa proveedores externos')
    expect(html).toContain('no consume IA')
    expect(html).toContain('no consulta tu información financiera')
  })

  it('responde ingresos escritos por el usuario con una propuesta simulada local', () => {
    const response = resolveAssistantDemoResponse('Hoy recibí 120 euros.')

    expect(response.kind).toBe('proposal')
    expect(response.assistant).toBe('He preparado un nuevo ingreso.')
    expect(response.details).toContainEqual({ label: 'Importe', value: '120 EUR' })
    expect(response.details).toContainEqual({ label: 'Categoría', value: 'Servicios' })
    expect(response.result).toBe('Ingreso registrado correctamente.')
  })

  it('responde gastos escritos por el usuario con una propuesta simulada local', () => {
    const response = resolveAssistantDemoResponse('Gasté 30 euros.')

    expect(response.kind).toBe('proposal')
    expect(response.assistant).toBe('He preparado este gasto.')
    expect(response.details).toContainEqual({ label: 'Importe', value: '30 EUR' })
    expect(response.details).toContainEqual({ label: 'Categoría', value: 'Gastos generales' })
  })

  it('responde consultas financieras con resumen ficticio sin datos reales', () => {
    const response = resolveAssistantDemoResponse('¿Cuánto gané este mes?')

    expect(response.kind).toBe('answer')
    expect(response.assistant).toBe('Este es un resumen financiero simulado del mes.')
    expect(response.details).toContainEqual({ label: 'Balance', value: '1.220 EUR' })
  })

  it('mantiene una respuesta guiada cuando la frase no esta en el sandbox', () => {
    const response = resolveAssistantDemoResponse('Haz algo raro')

    expect(response.kind).toBe('answer')
    expect(response.assistant).toContain('Puedo simular ingresos')
    expect(response.details).toEqual([])
  })

  it('mantiene los escenarios y cierre solicitados sin depender de datos reales', () => {
    const source = readFileSync(
      resolve(__dirname, '../src/pages/Conversation/AssistantInteractiveDemo.tsx'),
      'utf8',
    )

    expect(source).toContain('Hoy recibí 120 euros.')
    expect(source).toContain('Hoy recibí 120 euros por un servicio.')
    expect(source).toContain('Gasté 30 euros.')
    expect(source).toContain('Gasté 28 euros en gasolina.')
    expect(source).toContain('Mañana tengo una cita a las 18:30.')
    expect(source).toContain('¿Cuánto gané este mes?')
    expect(source).toContain('¿Qué ingresos siguen sin reportarse?')
    expect(source).toContain('resolveAssistantDemoResponse')
    expect(source).toContain('El Asistente IA está listo para ayudarte.')
    expect(source).toContain('to="/settings/license"')

    expect(source).not.toContain('conversationComposition')
    expect(source).not.toContain('licenseService')
    expect(source).not.toContain('database')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('OpenAI')
  })

  it('permite que /conversation llegue a la pagina para que trial vea la demo', () => {
    const routesSource = readFileSync(resolve(__dirname, '../src/routes/index.tsx'), 'utf8')
    const conversationRoute = routesSource.match(/<Route path="conversation"[^>]+>/)?.[0] ?? ''

    expect(conversationRoute).toContain('<ConversationPage />')
    expect(conversationRoute).not.toContain('LicenseTypeGuard')
    expect(routesSource).not.toContain("blocked={['trial']}><ConversationPage")
  })
})

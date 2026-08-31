import { describe, expect, it } from 'vitest'

import { parseAssistantIntent } from './assistantIntentParser'

const NOW = new Date('2026-08-01T10:00:00.000Z')

describe('parseAssistantIntent', () => {
  it('reconoce "Hoy recibí 120 euros por un servicio" como ingreso', () => {
    const result = parseAssistantIntent('Hoy recibí 120 euros por un servicio', { now: NOW })

    expect(result.kind).toBe('register_income')
    if (result.kind !== 'register_income') throw new Error('expected register_income')
    expect(result.fields.amount).toBe(120)
    expect(result.fields.currency).toBe('EUR')
    expect(result.fields.date).toBe('2026-08-01')
  })

  it('reconoce "Gasté 35 euros en transporte" como gasto con categoría', () => {
    const result = parseAssistantIntent('Gasté 35 euros en transporte', { now: NOW })

    expect(result.kind).toBe('register_expense')
    if (result.kind !== 'register_expense') throw new Error('expected register_expense')
    expect(result.fields.amount).toBe(35)
    expect(result.fields.currency).toBe('EUR')
    expect(result.fields.category).toBe('Transporte')
  })

  it.each([
    'Registrar un ingreso',
    'Registrar ingreso',
    'Agregar un ingreso',
    'Agregar ingreso',
    'Añadir un ingreso',
    'Añadir ingreso',
    'Anotar un ingreso',
    'Crear un ingreso',
    'Nuevo ingreso',
  ])('reconoce el imperativo de ingreso "%s" sin inventar importe', (message) => {
    const result = parseAssistantIntent(message, { now: NOW })

    expect(result.kind).toBe('register_income')
    if (result.kind !== 'register_income') throw new Error('expected register_income')
    expect(result.fields.amount).toBeNull()
    expect(result.fields.date).toBe('2026-08-01')
  })

  it.each([
    'Registrar un gasto',
    'Registrar gasto',
    'Agregar un gasto',
    'Agregar gasto',
    'Añadir un gasto',
    'Añadir gasto',
    'Anotar un gasto',
    'Crear un gasto',
    'Nuevo gasto',
  ])('reconoce el imperativo de gasto "%s" sin inventar importe ni categoría', (message) => {
    const result = parseAssistantIntent(message, { now: NOW })

    expect(result.kind).toBe('register_expense')
    if (result.kind !== 'register_expense') throw new Error('expected register_expense')
    expect(result.fields.amount).toBeNull()
    expect(result.fields.category).toBeNull()
    expect(result.fields.date).toBe('2026-08-01')
  })

  it('reconoce "Mañana tengo una cita a las 18:30" como cita sin importe', () => {
    const result = parseAssistantIntent('Mañana tengo una cita a las 18:30', { now: NOW })

    expect(result.kind).toBe('create_appointment')
    if (result.kind !== 'create_appointment') throw new Error('expected create_appointment')
    expect(result.fields.date).toBe('2026-08-02')
    expect(result.fields.time).toBe('18:30')
    expect(result.fields.expectedAmount).toBeNull()
    expect(result.fields.durationMinutes).toBe(60)
  })

  it('no inventa importe cuando el mensaje no lo menciona', () => {
    const result = parseAssistantIntent('Hoy recibí dinero por un servicio', { now: NOW })

    expect(result.kind).toBe('register_income')
    if (result.kind !== 'register_income') throw new Error('expected register_income')
    expect(result.fields.amount).toBeNull()
  })

  it('no inventa moneda cuando el mensaje no la menciona', () => {
    const result = parseAssistantIntent('Gasté 35 en transporte', { now: NOW })

    expect(result.kind).toBe('register_expense')
    if (result.kind !== 'register_expense') throw new Error('expected register_expense')
    expect(result.fields.currency).toBeNull()
  })

  it('devuelve kind "none" para preguntas de consulta (no acción)', () => {
    expect(parseAssistantIntent('¿Cuánto gané esta semana?', { now: NOW })).toEqual({ kind: 'none' })
    expect(parseAssistantIntent('Compárame julio con agosto', { now: NOW })).toEqual({ kind: 'none' })
    expect(parseAssistantIntent('¿Cómo registro un ingreso?', { now: NOW })).toEqual({ kind: 'none' })
    expect(parseAssistantIntent('¿Dónde registro un ingreso?', { now: NOW })).toEqual({ kind: 'none' })
    expect(parseAssistantIntent('¿Cómo puedo añadir un gasto?', { now: NOW })).toEqual({ kind: 'none' })
    expect(parseAssistantIntent('¿Qué necesito para registrar un ingreso?', { now: NOW })).toEqual({ kind: 'none' })
  })

  it('devuelve kind "none" para texto vacío', () => {
    expect(parseAssistantIntent('   ', { now: NOW })).toEqual({ kind: 'none' })
  })

  it('interpreta "ayer" y símbolo $ correctamente', () => {
    const result = parseAssistantIntent('Ayer pagué $50 de compras', { now: NOW })

    expect(result.kind).toBe('register_expense')
    if (result.kind !== 'register_expense') throw new Error('expected register_expense')
    expect(result.fields.date).toBe('2026-07-31')
    expect(result.fields.currency).toBe('USD')
  })
})

// La cobertura del bug P0 ("Hoy" cerca de medianoche debe resolver al día
// LOCAL, no al UTC) vive en test/localDateKey.test.ts en vez de aquí:
// manipular `process.env.TZ` requiere tipos de Node, y src/ solo declara
// tipos de `vite/client` (tsconfig.app.json) — igual que el resto de tests
// de zona horaria del repo (ver test/intentResolver.test.ts).

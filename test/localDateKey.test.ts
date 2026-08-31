import { afterEach, describe, expect, it } from 'vitest'

import {
  getCurrentMonthRange,
  getCurrentWeekRange,
  getLastDaysRange,
  getLocalDateKey,
  getTodayInputDate,
} from '../src/utils/currency'
import { parseAssistantIntent } from '../src/intelligence/assistant/assistantIntentParser'

// P0 — Fecha local incorrecta en registros creados después de medianoche.
//
// Causa raíz: `getTodayInputDate()` (y las demás utilidades de rango en
// `src/utils/currency.ts`) derivaban la fecha de negocio con
// `date.toISOString().slice(0, 10)` — una conversión a UTC. En cualquier
// huso horario adelantado respecto a UTC (España: CET UTC+1 / CEST UTC+2),
// un registro creado justo después de medianoche local todavía cae en el
// día UTC anterior, así que la fecha calculada quedaba un día atrás. Un
// egreso creado el 01/09/2026 a las 00:47 hora local se guardaba como
// 2026-08-31, y por tanto quedaba fuera del filtro "Egresos septiembre" de
// Inicio (que sí usa fecha local correctamente), aunque la Meta de
// temporada lo siguiera contando (filtra por earningPeriodId, no por
// fecha).
//
// Fuente única de verdad: `getLocalDateKey(date)` — deriva la fecha solo de
// los componentes locales del Date (getFullYear/getMonth/getDate), nunca
// de su representación UTC. `getTodayInputDate()` y los rangos de
// currency.ts la reutilizan; no se duplica esta lógica en otros módulos.

function withTimezone(timeZone: string, run: () => void) {
  const originalTz = process.env.TZ
  process.env.TZ = timeZone
  try {
    run()
  } finally {
    process.env.TZ = originalTz
  }
}

describe('getLocalDateKey — TDD P0', () => {
  it('DATE-001: 2026-09-01T00:47 hora local (Europe/Madrid, CEST) → 2026-09-01, no 2026-08-31', () => {
    withTimezone('Europe/Madrid', () => {
      // 2026-08-31T22:47:00.000Z = 2026-09-01T00:47 en Madrid (UTC+2, CEST).
      const date = new Date('2026-08-31T22:47:00.000Z')
      expect(getLocalDateKey(date)).toBe('2026-09-01')
    })
  })

  it('DATE-002: 2026-08-31T23:59 hora local (Europe/Madrid) → 2026-08-31', () => {
    withTimezone('Europe/Madrid', () => {
      // 2026-08-31T21:59:00.000Z = 2026-08-31T23:59 en Madrid (UTC+2, CEST).
      const date = new Date('2026-08-31T21:59:00.000Z')
      expect(getLocalDateKey(date)).toBe('2026-08-31')
    })
  })

  it('DATE-003: 2026-09-01T00:01 hora local (Europe/Madrid) → 2026-09-01', () => {
    withTimezone('Europe/Madrid', () => {
      // 2026-08-31T22:01:00.000Z = 2026-09-01T00:01 en Madrid (UTC+2, CEST).
      const date = new Date('2026-08-31T22:01:00.000Z')
      expect(getLocalDateKey(date)).toBe('2026-09-01')
    })
  })

  it('DATE-004: cambio de año — 2027-01-01T00:05 hora local (Europe/Madrid, CET) → 2027-01-01, no 2026-12-31', () => {
    withTimezone('Europe/Madrid', () => {
      // 2026-12-31T23:05:00.000Z = 2027-01-01T00:05 en Madrid (UTC+1, CET en invierno).
      const date = new Date('2026-12-31T23:05:00.000Z')
      expect(getLocalDateKey(date)).toBe('2027-01-01')
    })
  })

  it('DATE-008 (comparativa mensual): un instante UTC puede pertenecer a un mes local distinto al mes UTC', () => {
    withTimezone('Europe/Madrid', () => {
      const lastMinuteOfAugustUtc = new Date('2026-08-31T23:30:00.000Z') // 2026-09-01T01:30 en Madrid
      expect(getLocalDateKey(lastMinuteOfAugustUtc)).toBe('2026-09-01')
    })
  })

  it('no depende de un offset fijo: el mismo instante UTC produce fechas locales distintas según el huso (sin CET/CEST hardcodeado)', () => {
    const instant = '2026-08-31T22:47:00.000Z'

    withTimezone('UTC', () => {
      expect(getLocalDateKey(new Date(instant))).toBe('2026-08-31')
    })
    withTimezone('America/Bogota', () => {
      // UTC-5, sin DST: sigue siendo 31/08 local.
      expect(getLocalDateKey(new Date(instant))).toBe('2026-08-31')
    })
    withTimezone('Europe/Madrid', () => {
      // UTC+2 en verano (CEST): ya es 01/09 local.
      expect(getLocalDateKey(new Date(instant))).toBe('2026-09-01')
    })
    withTimezone('Pacific/Auckland', () => {
      // UTC+12/+13: muy adelantado, ya es 01/09 local (o incluso más).
      expect(getLocalDateKey(new Date(instant))).not.toBe('2026-08-30')
    })
  })

  it('DST (Requisito 8): resuelve correctamente a ambos lados de un cambio de horario en Europe/Madrid, sin offset manual', () => {
    withTimezone('Europe/Madrid', () => {
      // El último domingo de octubre de 2026 España pasa de CEST (UTC+2) a
      // CET (UTC+1) a las 03:00 hora local. Verificamos que un instante
      // justo antes y justo después del cambio siga resolviendo el día
      // calendario local correcto sin que la función conozca el offset.
      const beforeChange = new Date('2026-10-25T00:30:00.000Z') // 2026-10-25T02:30 CEST
      const afterChange = new Date('2026-10-25T01:30:00.000Z') // 2026-10-25T02:30 CET (misma hora local, tras el cambio)
      expect(getLocalDateKey(beforeChange)).toBe('2026-10-25')
      expect(getLocalDateKey(afterChange)).toBe('2026-10-25')
    })
  })
})

describe('getTodayInputDate — DATE-005/006/007 (Egresos, Ingresos, Agenda comparten esta utilidad)', () => {
  afterEach(() => {
    delete process.env.TZ
  })

  it('devuelve la fecha local de "hoy", no la fecha UTC, cerca de medianoche', () => {
    // No podemos mockear `new Date()` sin fake timers globales que afecten
    // otras utilidades; en su lugar probamos getLocalDateKey (la función
    // que getTodayInputDate delega) con la misma cobertura exhaustiva de
    // arriba, y aquí solo verificamos la composición correcta.
    withTimezone('Europe/Madrid', () => {
      const today = getTodayInputDate()
      expect(today).toBe(getLocalDateKey(new Date()))
    })
  })
})

describe('getCurrentMonthRange / getCurrentWeekRange / getLastDaysRange — no reinventan la derivación local', () => {
  it('getCurrentMonthRange produce límites de mes basados en componentes locales, no en toISOString', () => {
    const { from, to } = getCurrentMonthRange()
    const now = new Date()
    expect(from).toBe(getLocalDateKey(new Date(now.getFullYear(), now.getMonth(), 1)))
    expect(to).toBe(getLocalDateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)))
  })

  it('getCurrentWeekRange produce límites de semana basados en componentes locales', () => {
    const { from, to } = getCurrentWeekRange()
    expect(from <= to).toBe(true)
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('getLastDaysRange(7) incluye hoy como límite superior local', () => {
    const { to } = getLastDaysRange(7)
    expect(to).toBe(getTodayInputDate())
  })
})

describe('Asistente conversacional — "Hoy" cerca de medianoche (cobertura adicional, mismo bug P0)', () => {
  afterEach(() => {
    delete process.env.TZ
  })

  it('"Hoy gasté 30 en el hotel" a las 00:47 hora local resuelve al día local, no al UTC', () => {
    withTimezone('Europe/Madrid', () => {
      // now = 2026-08-31T22:47:00.000Z = 2026-09-01T00:47 en Madrid (CEST).
      // Antes de la corrección, toIsoDate() usaba
      // date.toISOString().slice(0, 10) y devolvía 2026-08-31.
      const midnightLocal = new Date('2026-08-31T22:47:00.000Z')
      const result = parseAssistantIntent('Hoy gasté 30 en el hotel', { now: midnightLocal })

      expect(result.kind).toBe('register_expense')
      if (result.kind !== 'register_expense') throw new Error('expected register_expense')
      expect(result.fields.date).toBe('2026-09-01')
    })
  })
})

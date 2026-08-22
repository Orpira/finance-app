import {
  INTENT_RESOLVER_PROTOCOL_VERSION,
  type IntentResolutionDetectedIntent,
  type IntentResolutionRequest,
  type IntentResolutionResult,
  type IntentResolver,
  type IntentResolverResolveResult,
  type IntentResolutionToolSelection,
} from './intentResolverContracts'
import {
  validateIntentResolutionRequest,
  validateIntentResolutionResult,
} from './intentResolverValidator'
import type { AIToolJsonValue } from '../ai-tools'

export const DETERMINISTIC_INTENT_RESOLVER_PROVIDER = 'DETERMINISTIC_RULES_V1' as const

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// --- Temporal Expression Resolver (PB-IS-016.2 sección 6) ---
// Toda la aritmetica de fechas se hace en UTC sobre strings 'YYYY-MM-DD',
// el mismo formato de fecha-sola que ya aceptan `filters.period.from/to`
// en las Financial Tools (financial_transactions, financial_balance).

interface TemporalPeriod {
  readonly from: string
  readonly to: string
}

// `referenceIso` is the real wall-clock instant (`new Date().toISOString()`,
// always UTC — see conversationComposition.ts), while `income.date` (and the
// UI's date picker) are captured with LOCAL calendar-date methods
// (IncomePage.tsx `formatInputDate`: getFullYear/getMonth/getDate). Slicing
// the UTC ISO string for "today" lands on the wrong calendar day for any
// user whose local time lags UTC once local time crosses midnight UTC
// (PB-IS-016.2-R2 sección 21/22: proven with runtime evidence to zero out
// "ayer"/"hoy" matches). Only the "today" anchor needs this — the UTC-only
// day arithmetic below (parseDateOnly/addDays/etc.) operates on already
// date-only strings and stays correct as-is.
function toLocalDateOnly(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`)
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDateOnly(date)
}

function startOfWeek(dateOnly: string): string {
  const date = parseDateOnly(dateOnly)
  const day = date.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  return addDays(dateOnly, -diff)
}

function startOfMonth(dateOnly: string): string {
  return `${dateOnly.slice(0, 7)}-01`
}

function startOfYear(dateOnly: string): string {
  return `${dateOnly.slice(0, 4)}-01-01`
}

function startOfQuarter(dateOnly: string): string {
  const date = parseDateOnly(dateOnly)
  const quarterStartMonth = Math.floor(date.getUTCMonth() / 3) * 3
  return formatDateOnly(new Date(Date.UTC(date.getUTCFullYear(), quarterStartMonth, 1)))
}

/**
 * Reconoce expresiones temporales explicitas en español (hoy, ayer,
 * anteayer, esta/la semana pasada, este/el mes pasado, este/el año pasado,
 * últimos 7/30 días, último trimestre) y las traduce a `filters.period`.
 * Nunca deja `{}` cuando el mensaje contiene una referencia temporal
 * explicita (PB-IS-016.2 sección 6).
 */
const SPANISH_MONTH_TO_NUMBER: Readonly<Record<string, string>> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
}

/**
 * Reconoce una fecha absoluta explicita dentro de un fragmento de texto, ya
 * sea en formato ISO ("2026-07-24") o en español con nombre de mes ("24 de
 * julio", "24 de julio de 2026" -- si no se especifica el año se asume el
 * año de `today`), o una referencia al dia actual ("hoy", "la fecha",
 * "actualidad"). Devuelve `null` si el fragmento no contiene ninguna fecha
 * reconocible. Compartido entre la deteccion de fecha unica y la de rangos
 * personalizados ("desde ... hasta ...") para no duplicar el parsing.
 */
function parseAbsoluteDateFragment(fragment: string, today: string): string | null {
  const isoMatch = fragment.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (isoMatch !== null) {
    return isoMatch[1]
  }

  const monthNameMatch = fragment.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?\b/,
  )
  if (monthNameMatch !== null) {
    const [, dayText, monthName, yearText] = monthNameMatch
    const day = dayText.padStart(2, '0')
    const month = SPANISH_MONTH_TO_NUMBER[monthName]
    const year = yearText ?? today.slice(0, 4)
    return `${year}-${month}-${day}`
  }

  if (/\b(hoy|la fecha|el dia de hoy|actualidad)\b/.test(fragment)) {
    return today
  }

  return null
}

function resolveTemporalPeriod(normalized: string, referenceIso: string): TemporalPeriod | null {
  const today = toLocalDateOnly(referenceIso)

  // Rango personalizado ("desde el 1 de julio hasta la fecha", "desde
  // 2026-07-01 hasta 2026-07-24"): tiene prioridad sobre la deteccion de
  // fecha unica, porque ambos extremos del rango suelen contener a su vez
  // una fecha absoluta reconocible por si sola (si se evaluara la fecha
  // unica primero, solo se tomaria la primera fecha del rango, ignorando
  // "hasta ..."). Sin este soporte, un rango explicito no era reconocido
  // como temporal por el Resolver determinista y la consulta terminaba
  // dependiendo enteramente de lo que resolviera el proveedor primario
  // (ver PB-IS-016.2-R3), que podia devolver 0 resultados pese a existir
  // datos reales en ese rango.
  const rangeMatch = normalized.match(/\bdesde\s+(.+?)\s+hasta\s+(.+?)(?:[.?!]|$)/)
  if (rangeMatch !== null) {
    const fromDate = parseAbsoluteDateFragment(rangeMatch[1], today)
    const toDate = parseAbsoluteDateFragment(rangeMatch[2], today)
    if (fromDate !== null && toDate !== null) {
      return { from: fromDate, to: toDate }
    }
  }

  // Fecha absoluta explicita en el mensaje ("...en 2026-07-25", "el
  // 2026-07-25...", "24 de julio", "24 de julio de 2026"): tiene prioridad
  // sobre cualquier expresion relativa y nunca debe quedar sin
  // `filters.period` (antes de este fix, una fecha literal no era
  // reconocida y la consulta quedaba sin acotar por fecha, devolviendo
  // todos los registros en vez de solo ese dia).
  const explicitDate = parseAbsoluteDateFragment(normalized, today)
  if (explicitDate !== null) {
    return { from: explicitDate, to: explicitDate }
  }

  if (/\banteayer\b/.test(normalized)) {
    const day = addDays(today, -2)
    return { from: day, to: day }
  }

  if (/\bayer\b/.test(normalized)) {
    const day = addDays(today, -1)
    return { from: day, to: day }
  }

  if (/\bhoy\b/.test(normalized)) {
    return { from: today, to: today }
  }

  if (/\bsemana pasada\b/.test(normalized)) {
    const startThisWeek = startOfWeek(today)
    return { from: addDays(startThisWeek, -7), to: addDays(startThisWeek, -1) }
  }

  if (/\besta semana\b/.test(normalized)) {
    return { from: startOfWeek(today), to: today }
  }

  if (/\bmes pasado\b/.test(normalized)) {
    const lastMonthEnd = addDays(startOfMonth(today), -1)
    return { from: startOfMonth(lastMonthEnd), to: lastMonthEnd }
  }

  if (/\beste mes\b/.test(normalized)) {
    return { from: startOfMonth(today), to: today }
  }

  if (/\bano pasado\b/.test(normalized)) {
    const lastYear = String(Number(today.slice(0, 4)) - 1)
    return { from: `${lastYear}-01-01`, to: `${lastYear}-12-31` }
  }

  if (/\beste ano\b/.test(normalized)) {
    return { from: startOfYear(today), to: today }
  }

  if (/\bultimos?\s+7\s+dias\b/.test(normalized)) {
    return { from: addDays(today, -6), to: today }
  }

  if (/\bultimos?\s+30\s+dias\b/.test(normalized)) {
    return { from: addDays(today, -29), to: today }
  }

  if (/\bultimo trimestre\b/.test(normalized)) {
    const lastQuarterEnd = addDays(startOfQuarter(today), -1)
    return { from: startOfQuarter(lastQuarterEnd), to: lastQuarterEnd }
  }

  return null
}

// --- Financial Intent Classifier (PB-IS-016.2 sección 7) ---
// Usa raices de palabra (\b + prefijo) en vez de coincidencia exacta para
// cubrir conjugaciones habituales ("gasté", "ingresé") que la coincidencia
// literal anterior no detectaba.

const TRANSACTIONS_KEYWORD_PATTERN = /\b(transacc\w*|movimient\w*|ingres\w*|egres\w*|gast\w*)/
const WRITE_ACTION_PATTERN = /\b(?:(?:registrar|agregar|anadir|anotar|crear)\s+(?:un\s+)?(?:ingreso|gasto|egreso|cita)|nuev[oa]\s+(?:ingreso|gasto|egreso|cita))\b/

function resolveTransactionKinds(normalized: string): readonly ('income' | 'expense')[] | undefined {
  const hasIncome = /\bingres\w*/.test(normalized)
  const hasExpense = /\begres\w*/.test(normalized) || /\bgast\w*/.test(normalized)

  if (hasIncome && !hasExpense) {
    return ['income']
  }

  if (hasExpense && !hasIncome) {
    return ['expense']
  }

  return undefined
}

// --- Aggregation detection (PB-IS-016.2 sección 8) ---

type AggregationKind = 'sum' | 'average' | 'count' | 'max' | 'min' | 'latest' | 'first'

interface AggregationMatch {
  readonly kind: AggregationKind
  readonly sort?: { readonly field: 'date' | 'amount'; readonly direction: 'asc' | 'desc' }
  readonly limit?: number
}

function resolveAggregation(normalized: string): AggregationMatch | null {
  if (/\bmaxim\w*/.test(normalized)) {
    return { kind: 'max', sort: { field: 'amount', direction: 'desc' }, limit: 1 }
  }

  if (/\bminim\w*/.test(normalized)) {
    return { kind: 'min', sort: { field: 'amount', direction: 'asc' }, limit: 1 }
  }

  const latestCountMatch = normalized.match(/\bultimos?\s+(\d+)\b(?!\s*dias?\b)/)
  if (latestCountMatch !== null) {
    return { kind: 'latest', sort: { field: 'date', direction: 'desc' }, limit: Number(latestCountMatch[1]) }
  }

  const firstCountMatch = normalized.match(/\bprimeros?\s+(\d+)\b/)
  if (firstCountMatch !== null) {
    return { kind: 'first', sort: { field: 'date', direction: 'asc' }, limit: Number(firstCountMatch[1]) }
  }

  if (/\bpromedio\w*/.test(normalized)) {
    return { kind: 'average' }
  }

  if (/\bcantidad\w*/.test(normalized)) {
    return { kind: 'count' }
  }

  if (/\bsum\w*|\btotal\w*/.test(normalized)) {
    return { kind: 'sum' }
  }

  return null
}

interface ResolvedSemantics {
  readonly period: TemporalPeriod | null
  readonly kinds: readonly ('income' | 'expense')[] | null
  readonly aggregation: AggregationKind | null
}

function resolveFromMessage(message: string, requestedAt: string): {
  readonly detectedIntent: IntentResolutionDetectedIntent
  readonly confidence: number
  readonly tool: IntentResolutionToolSelection
  readonly reasoning: string
  readonly semantics: ResolvedSemantics
} {
  const normalized = normalizeText(message)
  const noSemantics: ResolvedSemantics = { period: null, kinds: null, aggregation: null }

  if (WRITE_ACTION_PATTERN.test(normalized)) {
    return {
      detectedIntent: 'unknown',
      confidence: 0.3,
      tool: {
        toolId: 'financial_balance',
        arguments: {},
      },
      reasoning: 'Write action commands are outside the read-only financial tool router.',
      semantics: noSemantics,
    }
  }

  if (TRANSACTIONS_KEYWORD_PATTERN.test(normalized)) {
    const period = resolveTemporalPeriod(normalized, requestedAt)
    const kinds = resolveTransactionKinds(normalized)
    const aggregation = resolveAggregation(normalized)

    const filters: Record<string, unknown> = {}
    if (period !== null) {
      filters.period = period
    }
    if (kinds !== undefined) {
      filters.kinds = kinds
    }

    const args: Record<string, AIToolJsonValue> = {}
    if (Object.keys(filters).length > 0) {
      args.filters = filters as AIToolJsonValue
    }
    if (aggregation?.sort !== undefined) {
      args.sort = aggregation.sort
    }
    if (aggregation?.limit !== undefined) {
      args.limit = aggregation.limit
    }

    return {
      detectedIntent: 'transactions',
      confidence: 0.8,
      tool: {
        toolId: 'financial_transactions',
        arguments: args,
      },
      reasoning: 'Matched deterministic transaction keywords with semantic filters.',
      semantics: { period, kinds: kinds ?? null, aggregation: aggregation?.kind ?? null },
    }
  }

  if (normalized.includes('presupuesto') || normalized.includes('budget')) {
    return {
      detectedIntent: 'budget',
      confidence: 0.8,
      tool: {
        toolId: 'financial_budget',
        arguments: {},
      },
      reasoning: 'Matched deterministic budget keywords.',
      semantics: noSemantics,
    }
  }

  if (normalized.includes('objetivo') || normalized.includes('meta')) {
    return {
      detectedIntent: 'goals',
      confidence: 0.8,
      tool: {
        toolId: 'financial_goals',
        arguments: {},
      },
      reasoning: 'Matched deterministic goals keywords.',
      semantics: noSemantics,
    }
  }

  if (normalized.includes('reporte') || normalized.includes('informe')) {
    return {
      detectedIntent: 'reports',
      confidence: 0.8,
      tool: {
        toolId: 'financial_reports',
        arguments: {
          format: 'json',
        },
      },
      reasoning: 'Matched deterministic reports keywords.',
      semantics: noSemantics,
    }
  }

  if (
    normalized.includes('insight')
    || normalized.includes('resumen')
    || normalized.includes('tendencia')
  ) {
    return {
      detectedIntent: 'insights',
      confidence: 0.8,
      tool: {
        toolId: 'financial_insights',
        arguments: {
          format: 'json',
        },
      },
      reasoning: 'Matched deterministic insights keywords.',
      semantics: noSemantics,
    }
  }

  if (normalized.includes('balance')) {
    const period = resolveTemporalPeriod(normalized, requestedAt)
    const args: Record<string, AIToolJsonValue> = period === null ? {} : { filters: { period } as unknown as AIToolJsonValue }

    return {
      detectedIntent: 'balance',
      confidence: 0.8,
      tool: {
        toolId: 'financial_balance',
        arguments: args,
      },
      reasoning: 'Matched deterministic balance keywords with semantic filters.',
      semantics: { period, kinds: null, aggregation: null },
    }
  }

  return {
    detectedIntent: 'unknown',
    confidence: 0.3,
    tool: {
      toolId: 'financial_balance',
      arguments: {},
    },
    reasoning: 'No deterministic keyword matched, fallback to balance tool.',
    semantics: noSemantics,
  }
}

export interface CreateDeterministicIntentResolverInput {
  readonly now?: () => string
}

export function createDeterministicIntentResolver(
  input: CreateDeterministicIntentResolverInput = {},
): IntentResolver {
  const now = input.now ?? (() => new Date().toISOString())

  return {
    async resolve(request: IntentResolutionRequest): Promise<IntentResolverResolveResult> {
      const requestValidation = validateIntentResolutionRequest(request)
      if (requestValidation !== null) {
        return requestValidation
      }

      const match = resolveFromMessage(request.metadata.userMessage, request.metadata.requestedAt)
      const resolution: IntentResolutionResult = {
        protocolVersion: INTENT_RESOLVER_PROTOCOL_VERSION,
        detectedIntent: match.detectedIntent,
        confidence: match.confidence,
        tools: [
          {
            toolId: match.tool.toolId,
            arguments: structuredClone(match.tool.arguments),
          },
        ],
        reasoning: match.reasoning,
        provider: DETERMINISTIC_INTENT_RESOLVER_PROVIDER,
        timestamp: now(),
      }

      const resultValidation = validateIntentResolutionResult(resolution)
      if (resultValidation !== null) {
        return resultValidation
      }

      if (typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV)) {
        // PB-IS-016.2 sección 14: solo metadata tecnica de la resolucion
        // semantica, nunca el texto conversacional del usuario.
        console.debug('[financial-copilot] deterministic-intent-resolution', {
          intent: resolution.detectedIntent,
          period: match.semantics.period,
          kinds: match.semantics.kinds,
          aggregation: match.semantics.aggregation,
        })
      }

      return {
        kind: 'success',
        resolution,
      }
    },
  }
}

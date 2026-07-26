import type { AIToolJsonValue } from '../../ai-tools'
import type { ConversationResponse } from '../../response-composer'
import type { ActivationDecision } from './activationContracts'

export type FinancialDirectResponseBuilderId =
  | 'financial-transactions-summary'
  | 'financial-balance-summary'
  | 'financial-generic-success'
  | 'financial-direct-incomplete-payload'
  | 'financial-direct-unavailable'

export interface FinancialDirectResponseBuilderOutcome {
  readonly text: string
  readonly builderId: FinancialDirectResponseBuilderId
}

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const CURRENCY_AMOUNT_FORMATTER = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
})

function formatAmount(amount: number, currencyCode: string | undefined): string {
  const formatted = CURRENCY_AMOUNT_FORMATTER.format(amount)
  return currencyCode === undefined ? formatted : `${formatted} ${currencyCode}`
}

function toDateOnly(value: string | undefined): string | undefined {
  return value === undefined || value.length < 10 ? undefined : value.slice(0, 10)
}

// Mirrors the fix in deterministicIntentResolver.ts: `referenceIso` here is
// `new Date().toISOString()` (UTC), but the period bounds being matched
// against (`from`/`to`) came from a resolver that now anchors "today" to the
// LOCAL calendar date (matching how income/expense dates are captured). If
// this label matcher kept comparing against a UTC-sliced "today", the
// resolved period could stop matching known labels (e.g. "ayer") purely due
// to a UTC/local day-boundary skew, even though the underlying data query
// was already correct — see PB-IS-016.2-R2.
function toLocalDateOnly(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readPeriod(value: unknown): { readonly from?: string; readonly to?: string } | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  return {
    ...(typeof value.from === 'string' ? { from: value.from } : {}),
    ...(typeof value.to === 'string' ? { to: value.to } : {}),
  }
}

// --- Reconocimiento de periodo (PB-IS-016.2 seccion 13) ---
// Nunca recalcula montos: solo compara el `filters.period`/`period` que ya
// devolvio el resolver/Tool contra los rangos candidatos derivados de
// `nowIso`, para poder anteponer una expresion temporal en español ("Hoy",
// "Ayer", "Esta semana"...) sin inventar ningun dato financiero.

type PeriodLabel =
  | 'hoy'
  | 'ayer'
  | 'anteayer'
  | 'esta-semana'
  | 'semana-pasada'
  | 'este-mes'
  | 'mes-pasado'
  | 'este-anio'
  | 'anio-pasado'

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

const PERIOD_LEAD: Record<PeriodLabel, string> = {
  hoy: 'Hoy',
  ayer: 'Ayer',
  anteayer: 'Anteayer',
  'esta-semana': 'Esta semana',
  'semana-pasada': 'La semana pasada',
  'este-mes': 'Este mes',
  'mes-pasado': 'El mes pasado',
  'este-anio': 'Este año',
  'anio-pasado': 'El año pasado',
}

const PERIOD_SUFFIX: Record<PeriodLabel, string> = {
  hoy: 'para hoy',
  ayer: 'ayer',
  anteayer: 'anteayer',
  'esta-semana': 'esta semana',
  'semana-pasada': 'la semana pasada',
  'este-mes': 'este mes',
  'mes-pasado': 'el mes pasado',
  'este-anio': 'este año',
  'anio-pasado': 'el año pasado',
}

const PERIOD_OF_SUFFIX: Record<PeriodLabel, string> = {
  hoy: 'de hoy',
  ayer: 'de ayer',
  anteayer: 'de anteayer',
  'esta-semana': 'de esta semana',
  'semana-pasada': 'de la semana pasada',
  'este-mes': 'de este mes',
  'mes-pasado': 'del mes pasado',
  'este-anio': 'de este año',
  'anio-pasado': 'del año pasado',
}

function resolvePeriodLabel(
  period: { readonly from?: string; readonly to?: string } | undefined,
  referenceIso: string,
): PeriodLabel | null {
  const from = toDateOnly(period?.from)
  const to = toDateOnly(period?.to)
  if (from === undefined || to === undefined) {
    return null
  }

  const today = toLocalDateOnly(referenceIso)

  const yesterday = addDays(today, -1)
  const dayBeforeYesterday = addDays(today, -2)
  const startThisWeek = startOfWeek(today)
  const startLastWeek = addDays(startThisWeek, -7)
  const endLastWeek = addDays(startThisWeek, -1)
  const startThisMonth = startOfMonth(today)
  const endLastMonth = addDays(startThisMonth, -1)
  const startLastMonth = startOfMonth(endLastMonth)
  const startThisYear = startOfYear(today)
  const lastYear = String(Number(today.slice(0, 4)) - 1)

  if (from === today && to === today) return 'hoy'
  if (from === yesterday && to === yesterday) return 'ayer'
  if (from === dayBeforeYesterday && to === dayBeforeYesterday) return 'anteayer'
  if (from === startLastWeek && to === endLastWeek) return 'semana-pasada'
  if (from === startThisWeek && to === today) return 'esta-semana'
  if (from === startLastMonth && to === endLastMonth) return 'mes-pasado'
  if (from === startThisMonth && to === today) return 'este-mes'
  if (from === `${lastYear}-01-01` && to === `${lastYear}-12-31`) return 'anio-pasado'
  if (from === startThisYear && to === today) return 'este-anio'

  return null
}

function capitalize(text: string): string {
  return text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

function detectsCountIntent(userMessage: string): boolean {
  return /cu[aá]nt[oa]s\b/.test(userMessage.toLowerCase())
}

type TransactionsFocus = 'income' | 'expense' | 'both'

function detectTransactionsFocus(filters: JsonRecord | undefined, userMessage: string): TransactionsFocus {
  const kinds = Array.isArray(filters?.kinds) ? filters.kinds : undefined
  if (kinds !== undefined && kinds.length === 1) {
    if (kinds[0] === 'income') return 'income'
    if (kinds[0] === 'expense') return 'expense'
  }

  const normalized = userMessage.toLowerCase()
  const hasIncomeSignal = /ingreso/.test(normalized)
  const hasExpenseSignal = /egreso|gasto/.test(normalized)
  if (hasIncomeSignal && !hasExpenseSignal) return 'income'
  if (hasExpenseSignal && !hasIncomeSignal) return 'expense'
  return 'both'
}

function subjectLabel(focus: TransactionsFocus, plural: boolean): string {
  if (focus === 'income') return plural ? 'ingresos' : 'ingreso'
  if (focus === 'expense') return plural ? 'egresos' : 'egreso'
  return plural ? 'movimientos' : 'movimiento'
}

function buildNoResultsText(focus: TransactionsFocus, label: PeriodLabel | null): string {
  const subject = subjectLabel(focus, true)
  return label === null
    ? `No encontré ${subject} registrados.`
    : `No encontré ${subject} registrados ${PERIOD_SUFFIX[label]}.`
}

function buildSumSentence(
  focus: TransactionsFocus,
  incomeTotal: number,
  expenseTotal: number,
  netTotal: number,
  currencyCode: string | undefined,
  label: PeriodLabel | null,
): string {
  const body = focus === 'income'
    ? `tus ingresos suman ${formatAmount(incomeTotal, currencyCode)}.`
    : focus === 'expense'
      ? `tus egresos suman ${formatAmount(expenseTotal, currencyCode)}.`
      : `tus ingresos suman ${formatAmount(incomeTotal, currencyCode)} y tus egresos ${formatAmount(expenseTotal, currencyCode)}, con un neto de ${formatAmount(netTotal, currencyCode)}.`

  return label === null ? capitalize(body) : `${PERIOD_LEAD[label]} ${body}`
}

function buildCountSentence(focus: TransactionsFocus, matchedCount: number, label: PeriodLabel | null): string {
  const subject = subjectLabel(focus, matchedCount !== 1)
  const body = `registraste ${matchedCount} ${subject}.`
  return label === null ? capitalize(body) : `${PERIOD_LEAD[label]} ${body}`
}

function groupAmountsByCurrency(items: readonly unknown[], focus: TransactionsFocus): Map<string, number> {
  const totals = new Map<string, number>()

  for (const rawItem of items) {
    if (!isRecord(rawItem)) {
      continue
    }

    const kind = rawItem.kind
    const amount = rawItem.amount
    const currencyCode = typeof rawItem.currencyCode === 'string' ? rawItem.currencyCode : 'N/A'

    if (!isFiniteNumber(amount)) {
      continue
    }
    if (focus === 'income' && kind !== 'income') {
      continue
    }
    if (focus === 'expense' && kind !== 'expense') {
      continue
    }

    const magnitude = focus === 'expense' ? Math.abs(amount) : amount
    totals.set(currencyCode, (totals.get(currencyCode) ?? 0) + magnitude)
  }

  return totals
}

function buildMultiCurrencyBreakdownText(
  totals: Map<string, number>,
  focus: TransactionsFocus,
  label: PeriodLabel | null,
): string {
  const lines = [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currencyCode, amount]) => `• ${formatAmount(amount, currencyCode)}`)

  const subject = subjectLabel(focus, true)
  const lead = label === null ? 'Registraste' : `${PERIOD_LEAD[label]} registraste`
  return `${lead} ${subject} en varias monedas:\n\n${lines.join('\n\n')}`
}

/**
 * Transforma el `output` real de `financial_transactions` en lenguaje
 * natural. Nunca recalcula: solo lee `summary`/`items` ya devueltos por la
 * Tool. Devuelve `null` cuando el payload no tiene la forma esperada, para
 * que el llamador use el fallback seguro (PB-IS-016.1-R1, sección 12).
 */
export function buildFinancialTransactionsDirectResponseText(input: {
  readonly output: AIToolJsonValue
  readonly userMessage: string
  readonly toolArguments: Readonly<Record<string, AIToolJsonValue>> | undefined
  readonly nowIso: string
}): string | null {
  if (!isRecord(input.output)) {
    return null
  }

  const summary = input.output.summary
  if (!isRecord(summary)) {
    return null
  }

  const matchedCount = summary.matchedCount
  const incomeTotal = summary.incomeTotal
  const expenseTotal = summary.expenseTotal
  const netTotal = summary.netTotal
  const currencyCode = typeof summary.currencyCode === 'string' ? summary.currencyCode : undefined

  if (
    !isFiniteNumber(matchedCount)
    || !isFiniteNumber(incomeTotal)
    || !isFiniteNumber(expenseTotal)
    || !isFiniteNumber(netTotal)
  ) {
    return null
  }

  const filters = isRecord(input.toolArguments?.filters) ? input.toolArguments.filters : undefined
  const period = readPeriod(filters?.period)
  const label = resolvePeriodLabel(period, input.nowIso)
  const focus = detectTransactionsFocus(filters, input.userMessage)

  if (matchedCount === 0) {
    return buildNoResultsText(focus, label)
  }

  const items = Array.isArray(input.output.items) ? input.output.items : []
  const currencyTotals = groupAmountsByCurrency(items, focus)
  if (currencyTotals.size > 1) {
    return buildMultiCurrencyBreakdownText(currencyTotals, focus, label)
  }

  if (detectsCountIntent(input.userMessage)) {
    return buildCountSentence(focus, matchedCount, label)
  }

  return buildSumSentence(focus, incomeTotal, expenseTotal, netTotal, currencyCode, label)
}

/**
 * Transforma el `output` real de `financial_balance` en lenguaje natural.
 * Nunca recalcula: solo lee `summary`/`period` ya devueltos por la Tool.
 */
export function buildFinancialBalanceDirectResponseText(input: {
  readonly output: AIToolJsonValue
  readonly nowIso: string
}): string | null {
  if (!isRecord(input.output)) {
    return null
  }

  const summary = input.output.summary
  if (!isRecord(summary)) {
    return null
  }

  const incomeTotal = summary.incomeTotal
  const expenseTotal = summary.expenseTotal
  const netBalance = summary.netBalance
  const currencyCode = typeof summary.currencyCode === 'string' ? summary.currencyCode : undefined

  if (!isFiniteNumber(incomeTotal) || !isFiniteNumber(expenseTotal) || !isFiniteNumber(netBalance)) {
    return null
  }

  const period = readPeriod(input.output.period)
  const label = resolvePeriodLabel(period, input.nowIso)

  if (summary.hasData === false) {
    return label === null
      ? 'No encontré movimientos registrados para calcular tu balance.'
      : `No encontré movimientos registrados para calcular tu balance ${PERIOD_OF_SUFFIX[label]}.`
  }

  const lead = label === null ? 'Registras' : `${PERIOD_LEAD[label]} registras`
  return `${lead} ingresos por ${formatAmount(incomeTotal, currencyCode)}, egresos por ${formatAmount(expenseTotal, currencyCode)} y un balance neto de ${formatAmount(netBalance, currencyCode)}.`
}

const SAFE_UNAVAILABLE_TEXT = 'No pude completar tu consulta financiera en este momento. Intenta nuevamente en unos segundos.'

/**
 * Construye la respuesta en lenguaje natural para la ruta `DIRECT_TOOL`
 * (PB-IS-016.1-R1). Reemplaza los mensajes tecnicos hardcodeados por
 * toolId: transforma el payload real ya devuelto por la Financial Tool en
 * una frase conversacional. No contiene logica financiera propia — delega
 * en los builders especializados de cada Tool y nunca vuelve a consultar la
 * base de datos.
 */
export function buildFinancialDirectResponseText(input: {
  readonly decision: ActivationDecision
  readonly userMessage: string
  readonly response: ConversationResponse
  readonly now?: () => string
}): FinancialDirectResponseBuilderOutcome {
  const nowIso = (input.now ?? (() => new Date().toISOString()))()
  const toolId = input.decision.toolId

  const step = toolId === null
    ? undefined
    : input.response.promptContext.steps.find((candidate) => candidate.toolId === toolId)

  if (step === undefined || step.kind !== 'success') {
    return { text: SAFE_UNAVAILABLE_TEXT, builderId: 'financial-direct-unavailable' }
  }

  if (toolId === 'financial_transactions') {
    const text = buildFinancialTransactionsDirectResponseText({
      output: step.output,
      userMessage: input.userMessage,
      toolArguments: input.decision.toolArguments,
      nowIso,
    })
    return text === null
      ? { text: SAFE_UNAVAILABLE_TEXT, builderId: 'financial-direct-incomplete-payload' }
      : { text, builderId: 'financial-transactions-summary' }
  }

  if (toolId === 'financial_balance') {
    const text = buildFinancialBalanceDirectResponseText({ output: step.output, nowIso })
    return text === null
      ? { text: SAFE_UNAVAILABLE_TEXT, builderId: 'financial-direct-incomplete-payload' }
      : { text, builderId: 'financial-balance-summary' }
  }

  return { text: 'Consulté la información financiera solicitada.', builderId: 'financial-generic-success' }
}

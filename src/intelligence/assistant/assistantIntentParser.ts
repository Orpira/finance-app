import type { CurrencyCode } from '../../types/settings'
import type {
  AppointmentProposalFields,
  AssistantProposalKind,
  ExpenseProposalFields,
  IncomeProposalFields,
} from './assistantProposalContracts'
import { getLocalDateKey } from '../../utils/currency'

/**
 * Interpretación determinista y 100% local de los tres intents de acción del
 * Asistente. Deliberadamente NO delega en el proveedor de IA: los ejemplos
 * del producto ("Hoy recibí 120 euros por un servicio", "Gasté 35 euros en
 * transporte", "Mañana tengo una cita a las 18:30") siguen patrones
 * regulares que un parser determinista puede resolver de forma fiable y
 * auditable — y evita enviar el mensaje del usuario a un proveedor externo
 * para estos tres flujos. Ver docs/architecture/19_ASSISTANT_ACTION_FLOW.md.
 *
 * Cualquier mensaje que no calce con un patrón reconocido devuelve
 * `{ kind: 'none' }` y el turno sigue el camino de consulta existente
 * (orquestador conversacional ya certificado, sin cambios).
 */

const CURRENCY_CODES: readonly CurrencyCode[] = [
  'ARS', 'BGN', 'COP', 'CZK', 'DKK', 'EUR', 'GBP', 'HUF', 'MXN', 'PLN', 'RON', 'SEK', 'USD',
]

const CURRENCY_SYMBOLS: Readonly<Record<string, CurrencyCode>> = {
  '€': 'EUR',
  '$': 'USD',
  '£': 'GBP',
}

const CURRENCY_WORDS: Readonly<Record<string, CurrencyCode>> = {
  euro: 'EUR',
  euros: 'EUR',
  dolar: 'USD',
  dolares: 'USD',
  dólar: 'USD',
  dólares: 'USD',
  peso: 'COP',
  pesos: 'COP',
  libra: 'GBP',
  libras: 'GBP',
}

export type ParsedAssistantIntent =
  | { readonly kind: 'register_income'; readonly fields: IncomeProposalFields; readonly sourceText: string }
  | { readonly kind: 'register_expense'; readonly fields: ExpenseProposalFields; readonly sourceText: string }
  | { readonly kind: 'create_appointment'; readonly fields: AppointmentProposalFields; readonly sourceText: string }
  | { readonly kind: 'none' }

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function extractAmount(rawText: string): number | null {
  const match = rawText.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/)
  if (!match) return null

  const normalized = match[1].replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? value : null
}

function extractCurrency(rawText: string): CurrencyCode | null {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (rawText.includes(symbol)) return code
  }

  const normalized = normalize(rawText)
  for (const code of CURRENCY_CODES) {
    if (new RegExp(`\\b${code.toLowerCase()}\\b`).test(normalized)) return code
  }

  for (const [word, code] of Object.entries(CURRENCY_WORDS)) {
    if (normalized.includes(word)) return code
  }

  return null
}

function extractDate(rawText: string, referenceDate: Date): string | null {
  const normalized = normalize(rawText)

  if (/\bhoy\b/.test(normalized)) return toIsoDate(referenceDate)
  if (/\bayer\b/.test(normalized)) return toIsoDate(addDays(referenceDate, -1))
  if (/\bmanana\b/.test(normalized)) return toIsoDate(addDays(referenceDate, 1))

  const isoMatch = rawText.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const shortMatch = rawText.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/)
  if (shortMatch) {
    const [, day, month, year] = shortMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return null
}

function extractTime(rawText: string): string | null {
  const match = rawText.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?\b/i)
  if (!match) return null

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toLowerCase().replace(/\./g, '')

  if (meridiem === 'pm' && hours < 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0

  if (hours > 23 || minutes > 59) return null

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function extractExpenseCategory(rawText: string): string | null {
  const normalized = normalize(rawText)
  const match = normalized.match(/\b(?:en|de|para)\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:hoy|ayer|manana|el\s|por|con)\b|[.,]|$)/)
  if (!match) return null

  const category = match[1].trim()
  return category.length > 0 ? category.charAt(0).toUpperCase() + category.slice(1) : null
}

// "hoy"/"ayer"/"mañana" en el chat del Asistente deben resolverse contra el
// calendario LOCAL del dispositivo, nunca UTC: un mensaje enviado a las
// 00:47 hora local sigue siendo "hoy" aunque el instante UTC equivalente
// corresponda todavía al día anterior (mismo defecto que getTodayInputDate).
function toIsoDate(date: Date): string {
  return getLocalDateKey(date)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

// Los patrones se evalúan sobre texto ya normalizado (sin tildes, minúsculas):
// `\b` en JS no reconoce letras acentuadas como caracteres de palabra, así que
// `\bgasté\b` nunca podría casar de forma fiable contra el texto original.
const APPOINTMENT_PATTERN = /\b(cita|agenda(?:r)?|reunion|turno)\b/i
const EXPENSE_PATTERN = /\b(gaste|pague|compre|gasto de|gasto por|(?:registrar|agregar|anadir|anotar|crear)\s+(?:un\s+)?gasto|nuevo\s+gasto)\b/i
const INCOME_PATTERN = /\b(recibi|cobre|ingreso de|ingrese|gane|(?:registrar|agregar|anadir|anotar|crear)\s+(?:un\s+)?ingreso|nuevo\s+ingreso)\b/i

function detectKind(normalizedText: string): AssistantProposalKind | 'none' {
  if (APPOINTMENT_PATTERN.test(normalizedText)) return 'create_appointment'
  if (EXPENSE_PATTERN.test(normalizedText)) return 'register_expense'
  if (INCOME_PATTERN.test(normalizedText)) return 'register_income'
  return 'none'
}

export function parseAssistantIntent(
  text: string,
  input: { readonly now?: Date } = {},
): ParsedAssistantIntent {
  const sourceText = text.trim()
  if (sourceText.length === 0) return { kind: 'none' }

  // Una pregunta ("¿Cuánto gané esta semana?") es una consulta, nunca una
  // acción, aunque contenga un verbo que también aparece en frases de
  // acción ("gané"). Se resuelve por el camino de consulta existente.
  if (sourceText.includes('?') || sourceText.includes('¿')) {
    return { kind: 'none' }
  }

  const now = input.now ?? new Date()
  const kind = detectKind(normalize(sourceText))

  if (kind === 'none') return { kind: 'none' }

  if (kind === 'register_income') {
    return {
      kind,
      sourceText,
      fields: {
        amount: extractAmount(sourceText),
        currency: extractCurrency(sourceText),
        date: extractDate(sourceText, now) ?? toIsoDate(now),
        description: null,
      },
    }
  }

  if (kind === 'register_expense') {
    return {
      kind,
      sourceText,
      fields: {
        amount: extractAmount(sourceText),
        currency: extractCurrency(sourceText),
        date: extractDate(sourceText, now) ?? toIsoDate(now),
        category: extractExpenseCategory(sourceText),
      },
    }
  }

  return {
    kind: 'create_appointment',
    sourceText,
    fields: {
      date: extractDate(sourceText, now) ?? toIsoDate(now),
      time: extractTime(sourceText),
      durationMinutes: 60,
      expectedAmount: null,
      currency: extractCurrency(sourceText),
    },
  }
}

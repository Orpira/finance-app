import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { buildNormalizedWalletName } from '../../utils/walletName'

/**
 * Read-only Wallet intents for the Copiloto (PRIVATE_BALANCE_WALLET_COPILOT).
 * Deliberately separate from `financialCopilotEngine.ts`'s intents: Wallet
 * questions answer "where is my money" (distribution), never "what did I
 * earn/spend" (financial result) — see docs/adr for the split rationale.
 * This module is pure and provider-neutral: no Dexie access, no AI provider
 * dependency, so it works identically for the deterministic Copiloto today
 * and for any future external provider that reuses these builders.
 */

export type WalletCopilotIntent =
  | 'wallet_total'
  | 'wallet_balance'
  | 'wallet_distribution'
  | 'wallet_count'
  | 'wallet_default'
  | 'wallet_largest_balance'
  | 'wallet_smallest_balance'
  | 'wallet_transfers_summary'
  | 'wallet_latest_transfer'

export type WalletCopilotPeriod = { readonly from: string; readonly to: string } | 'all'

export interface WalletCopilotResolvedPeriod {
  readonly period: WalletCopilotPeriod
  readonly label: string
}

export type WalletCopilotRequest =
  | { readonly intent: 'wallet_total' }
  | { readonly intent: 'wallet_balance'; readonly nameQuery: string }
  | { readonly intent: 'wallet_distribution' }
  | { readonly intent: 'wallet_count'; readonly scope: 'total' | 'active' | 'archived' }
  | { readonly intent: 'wallet_default' }
  | { readonly intent: 'wallet_largest_balance' }
  | { readonly intent: 'wallet_smallest_balance' }
  | { readonly intent: 'wallet_transfers_summary'; readonly resolvedPeriod: WalletCopilotResolvedPeriod | 'unresolvable' | null }
  | { readonly intent: 'wallet_latest_transfer'; readonly resolvedPeriod: WalletCopilotResolvedPeriod | 'unresolvable' | null }

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

// Financial keywords that must never be shadowed by a wallet pattern (spec
// §29/§36): "cuánto ingresé/gasté/balance del mes" keep resolving as
// financial result, never as wallet distribution.
const FINANCIAL_RESULT_GUARD = /\b(ingres\w*|gan\w*|cobr\w*|recib\w*|gast\w*|egres\w*|pague\w*|balance|presupuesto|objetivo|meta|reporte|informe|temporada)\b/

const WALLET_TOTAL_PATTERN = /\b(cuant[oa]s?\s+dinero\s+(tengo|hay)|cuanto\s+tengo\s+disponible|saldo\s+total|cuanto\s+tengo\s+entre\s+(todas\s+)?mis\s+wallets?|cuanto\s+dinero\s+tengo\s+registrado|cuanto\s+tengo\s+acumulado)\b/

const WALLET_BALANCE_PATTERN = /\bcuant[oa]s?\s+(dinero\s+)?(tengo|hay)\s+en\s+(?:la\s+wallet\s+|mi\s+wallet\s+)?(.+?)\??$|cual\s+es\s+el\s+saldo\s+de\s+(.+?)\??$|cuanto\s+(?:dinero\s+)?hay\s+en\s+(.+?)\??$/

// Mirrors WALLET_BALANCE_PATTERN but runs against the ORIGINAL (non-deaccented,
// non-lowercased) text so the captured Wallet name fragment keeps its real
// casing/accents for display ("Caja fuerte", not "caja fuerte") — only the
// fixed keywords need accent/case tolerance here, via the `i` flag and the
// explicit [aá]/[uú] alternatives.
const WALLET_BALANCE_RAW_PATTERN = /cu[aá]nt[oa]s?\s+(?:dinero\s+)?(?:tengo|hay)\s+en\s+(?:la\s+wallet\s+|mi\s+wallet\s+)?(.+?)[?.!]*$|cu[aá]l\s+es\s+el\s+saldo\s+de\s+(.+?)[?.!]*$|cu[aá]nto\s+(?:dinero\s+)?hay\s+en\s+(.+?)[?.!]*$/i

const WALLET_DISTRIBUTION_PATTERN = /\bcomo\s+esta\s+distribuido\s+mi\s+dinero|donde\s+tengo\s+mi\s+dinero|muestrame\s+mis\s+wallets|como\s+se\s+reparten?\s+mis\b/

const WALLET_COUNT_PATTERN = /\bcuantas?\s+wallets?\s+(activas?\s+|archivadas?\s+)?(tengo|hay)\b|\bcuantas?\s+tengo\s+(activas?|archivadas?)\b/

const WALLET_DEFAULT_PATTERN = /\bcual\s+es\s+mi\s+wallet\s+predeterminada|wallet\s+predeterminada|donde\s+se\s+guardan\s+los\s+ingresos\s+por\s+defecto|desde\s+que\s+wallet\s+salen\s+los\s+gastos\s+por\s+defecto\b/

const WALLET_LARGEST_PATTERN = /\bdonde\s+tengo\s+mas\s+dinero|que\s+wallet\s+tiene\s+mas\s+saldo|en\s+que\s+wallet\s+tengo\s+mas\s+dinero\b/

const WALLET_SMALLEST_PATTERN = /\bdonde\s+tengo\s+menos\s+dinero|que\s+wallet\s+tiene\s+(el\s+)?saldo\s+mas\s+bajo|en\s+que\s+wallet\s+tengo\s+menos\s+dinero\b/

const WALLET_TRANSFERS_SUMMARY_PATTERN = /\bcuantas\s+transferencias\s+(hice|realice)\b|\bcuanto\s+(dinero\s+)?(moviste|movi|transferi)\b|\bactividad\s+de\s+(mis\s+)?wallets\b|\bcuantos\s+movimientos\s+internos\s+hice\b/

const WALLET_LATEST_TRANSFER_PATTERN = /\bcual\s+fue\s+mi\s+ultima\s+transferencia|de\s+donde\s+salio\s+mi\s+ultima\s+transferencia|a\s+(donde|que\s+wallet)\s+(movi|envie)\s+dinero(\s+por\s+ultima\s+vez)?\b/

/**
 * Pure regex classification, checked strictly before the financial engine's
 * patterns so "¿cuánto dinero tengo?" resolves as wallet distribution, never
 * as the generic monthly balance tool (spec §29/§36). Returns `null` for
 * anything that isn't a recognizable read-only wallet question, including
 * write commands ("Transfiere 100€ a Casa") which are deliberately never
 * classified as a wallet query — spec §30 forbids turning an imperative into
 * a read intent.
 */
export function detectWalletCopilotIntent(query: string): WalletCopilotIntent | null {
  const normalized = normalizeText(query)
  if (normalized.length === 0) return null

  if (WALLET_LATEST_TRANSFER_PATTERN.test(normalized)) return 'wallet_latest_transfer'
  if (WALLET_TRANSFERS_SUMMARY_PATTERN.test(normalized)) return 'wallet_transfers_summary'
  if (WALLET_DEFAULT_PATTERN.test(normalized)) return 'wallet_default'
  if (WALLET_COUNT_PATTERN.test(normalized)) return 'wallet_count'
  if (WALLET_LARGEST_PATTERN.test(normalized)) return 'wallet_largest_balance'
  if (WALLET_SMALLEST_PATTERN.test(normalized)) return 'wallet_smallest_balance'
  if (WALLET_DISTRIBUTION_PATTERN.test(normalized)) return 'wallet_distribution'
  if (!FINANCIAL_RESULT_GUARD.test(normalized) && WALLET_TOTAL_PATTERN.test(normalized)) return 'wallet_total'
  if (!FINANCIAL_RESULT_GUARD.test(normalized) && WALLET_BALANCE_PATTERN.test(normalized)) return 'wallet_balance'

  return null
}

function extractWalletNameQuery(rawQuery: string): string {
  const match = WALLET_BALANCE_RAW_PATTERN.exec(rawQuery.trim())
  const raw = match?.[1] ?? match?.[2] ?? match?.[3] ?? ''
  return raw.replace(/[?.!]+$/, '').trim()
}

function extractCountScope(normalized: string): 'total' | 'active' | 'archived' {
  if (/\barchivad/.test(normalized)) return 'archived'
  if (/\bactiv/.test(normalized)) return 'active'
  return 'total'
}

// --- Period resolution for transfer questions (spec §19) ---------------

function toIsoDateOnly(referenceIso: string): string {
  return referenceIso.slice(0, 10)
}

function parseDateOnly(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`)
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDaysUtc(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly)
  date.setUTCDate(date.getUTCDate() + days)
  return formatDateOnly(date)
}

function startOfWeekUtc(dateOnly: string): string {
  const date = parseDateOnly(dateOnly)
  const day = date.getUTCDay()
  const diff = day === 0 ? 6 : day - 1
  return addDaysUtc(dateOnly, -diff)
}

function startOfMonthUtc(dateOnly: string): string {
  return `${dateOnly.slice(0, 7)}-01`
}

function endOfMonthUtc(dateOnly: string): string {
  const date = parseDateOnly(dateOnly)
  return formatDateOnly(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)))
}

const SPANISH_MONTH_TO_NUMBER: Readonly<Record<string, string>> = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
}

/**
 * Resolves one of the periods spec §19 requires (hoy/esta semana/este
 * mes/mes anterior/este año/todo el historial) plus a bare month name
 * ("en agosto"). Returns `null` when the message has no period phrase at
 * all (caller applies the intent's own default), or `'unresolvable'` when a
 * period phrase is present but not one this resolver understands — callers
 * must surface that explicitly rather than silently defaulting to the full
 * history (spec §19).
 */
export function resolveWalletCopilotPeriod(
  query: string,
  referenceIso: string,
): WalletCopilotResolvedPeriod | 'unresolvable' | null {
  const normalized = normalizeText(query)
  const today = toIsoDateOnly(referenceIso)

  if (/\btodo\s+(el\s+)?(historial|el\s+tiempo)|historial\s+completo|desde\s+siempre\b/.test(normalized)) {
    return { period: 'all', label: 'en todo el historial' }
  }
  if (/\bhoy\b/.test(normalized)) {
    return { period: { from: today, to: today }, label: 'hoy' }
  }
  if (/\besta\s+semana\b/.test(normalized)) {
    return { period: { from: startOfWeekUtc(today), to: today }, label: 'esta semana' }
  }
  if (/\bmes\s+anterior|mes\s+pasado\b/.test(normalized)) {
    const lastMonthEnd = addDaysUtc(startOfMonthUtc(today), -1)
    return { period: { from: startOfMonthUtc(lastMonthEnd), to: lastMonthEnd }, label: 'el mes anterior' }
  }
  if (/\beste\s+mes\b/.test(normalized)) {
    return { period: { from: startOfMonthUtc(today), to: today }, label: 'este mes' }
  }
  if (/\beste\s+ano\b/.test(normalized)) {
    return { period: { from: `${today.slice(0, 4)}-01-01`, to: today }, label: 'este año' }
  }

  const monthNameMatch = normalized.match(
    /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/,
  )
  if (monthNameMatch !== null) {
    const month = SPANISH_MONTH_TO_NUMBER[monthNameMatch[1]]
    const year = today.slice(0, 4)
    const start = `${year}-${month}-01`
    return { period: { from: start, to: endOfMonthUtc(start) }, label: `en ${monthNameMatch[1]}` }
  }

  const hasUnrecognizedPeriodWord = /\b(periodo|semana pasada|ano pasado|trimestre|ayer|anteayer)\b/.test(normalized)
  return hasUnrecognizedPeriodWord ? 'unresolvable' : null
}

/**
 * Parses the free-text question into a fully-typed request. Kept separate
 * from `detectWalletCopilotIntent` so a caller can classify cheaply first
 * (no date math) and only pay for full parsing once it knows this is a
 * wallet question.
 */
export function resolveWalletCopilotRequest(
  query: string,
  referenceIso: string,
): WalletCopilotRequest | null {
  const intent = detectWalletCopilotIntent(query)
  if (intent === null) return null
  const normalized = normalizeText(query)

  switch (intent) {
    case 'wallet_balance':
      return { intent, nameQuery: extractWalletNameQuery(query) }
    case 'wallet_count':
      return { intent, scope: extractCountScope(normalized) }
    case 'wallet_transfers_summary':
    case 'wallet_latest_transfer':
      return { intent, resolvedPeriod: resolveWalletCopilotPeriod(query, referenceIso) }
    default:
      return { intent }
  }
}

// --- Wallet name matching (spec §10/§11/§12/§38) ------------------------

export interface WalletCopilotWallet {
  readonly id: string
  readonly name: string
  readonly normalizedName: string
  readonly balance: number
  readonly isDefault: boolean
  readonly isArchived: boolean
}

/**
 * Alias table limited to unambiguous, product-documented aliases (spec
 * §11). Deliberately does NOT guess semantic equivalence ("BBVA" = "Banco",
 * "Casa" = "Efectivo") — only literal substring/alias matches are ever
 * attempted, so an ambiguous fragment always surfaces as ambiguity (§38)
 * instead of an arbitrary pick.
 */
const SAFE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  'cuenta principal': ['cuenta principal'],
  casa: ['dinero en casa', 'casa'],
  efectivo: ['efectivo'],
  banco: ['banco'],
}

export interface WalletMatchResult {
  readonly matches: readonly WalletCopilotWallet[]
}

function stripLeadingArticle(value: string): string {
  return value.replace(/^(el|la|los|las|mi|mis)\s+/, '')
}

function matchOneCandidate(
  wallets: readonly WalletCopilotWallet[],
  candidate: string,
): readonly WalletCopilotWallet[] {
  if (candidate.length === 0) return []

  const exact = wallets.filter((wallet) => wallet.normalizedName === candidate)
  if (exact.length > 0) return exact

  const aliasTargets = SAFE_ALIASES[candidate]
  if (aliasTargets !== undefined) {
    const aliasMatches = wallets.filter((wallet) => aliasTargets.includes(wallet.normalizedName))
    if (aliasMatches.length > 0) return aliasMatches
  }

  return wallets.filter((wallet) => wallet.normalizedName.includes(candidate))
}

export function findWalletsByQuery(
  wallets: readonly WalletCopilotWallet[],
  nameQuery: string,
): WalletMatchResult {
  const normalizedQuery = buildNormalizedWalletName(nameQuery)
  if (normalizedQuery.length === 0) return { matches: [] }

  const direct = matchOneCandidate(wallets, normalizedQuery)
  if (direct.length > 0) return { matches: direct }

  const stripped = stripLeadingArticle(normalizedQuery)
  if (stripped !== normalizedQuery) {
    const withoutArticle = matchOneCandidate(wallets, stripped)
    if (withoutArticle.length > 0) return { matches: withoutArticle }
  }

  return { matches: [] }
}

// --- Answer formatting ----------------------------------------------------

export interface WalletCopilotAnswer {
  readonly intent: WalletCopilotIntent | 'wallet_ambiguous' | 'wallet_not_found' | 'wallet_period_unresolvable'
  readonly text: string
  readonly explanation: string
}

function formatWalletLine(wallet: WalletCopilotWallet, currency: CurrencyCode): string {
  const suffix = wallet.isArchived ? ' · Archivada' : ''
  return `${wallet.name}: ${formatCurrency(wallet.balance, currency)}${suffix}`
}

export function buildWalletTotalAnswer(
  wallets: readonly WalletCopilotWallet[],
  total: number,
  currency: CurrencyCode,
): WalletCopilotAnswer {
  const withBalance = wallets.filter((wallet) => !wallet.isArchived || wallet.balance !== 0)
  const lines = withBalance
    .slice()
    .sort((left, right) => (right.isDefault ? 1 : 0) - (left.isDefault ? 1 : 0) || right.balance - left.balance)
    .map((wallet) => formatWalletLine(wallet, currency))

  return {
    intent: 'wallet_total',
    text: `Tienes ${formatCurrency(total, currency)} registrados entre ${withBalance.length} ${withBalance.length === 1 ? 'Wallet' : 'Wallets'}.\n\n${lines.join('\n')}`,
    explanation: 'Este total corresponde al dinero acumulado registrado en Private Balance. Las transferencias internas entre Wallets no modifican esta cifra.',
  }
}

export function buildWalletNotFoundAnswer(
  nameQuery: string,
  wallets: readonly WalletCopilotWallet[],
): WalletCopilotAnswer {
  const available = wallets.filter((wallet) => !wallet.isArchived).map((wallet) => `- ${wallet.name}`)
  return {
    intent: 'wallet_not_found',
    text: `No encontré una Wallet llamada "${nameQuery}".\n\nTus Wallets disponibles son:\n${available.join('\n')}`,
    explanation: 'No se devuelve un saldo de cero porque podría confundirse con una Wallet existente sin fondos.',
  }
}

export function buildWalletAmbiguousAnswer(matches: readonly WalletCopilotWallet[]): WalletCopilotAnswer {
  const options = matches.map((wallet) => `- ${wallet.name}`).join('\n')
  return {
    intent: 'wallet_ambiguous',
    text: `Encontré varias Wallets que podrían coincidir:\n\n${options}\n\n¿A cuál te refieres?`,
    explanation: 'No se sumaron ni se eligió una Wallet automáticamente porque la coincidencia era ambigua.',
  }
}

export function buildWalletBalanceAnswer(wallet: WalletCopilotWallet, currency: CurrencyCode): WalletCopilotAnswer {
  const archivedNote = wallet.isArchived ? ' Esta Wallet está archivada.' : ''
  return {
    intent: 'wallet_balance',
    text: `Tienes ${formatCurrency(wallet.balance, currency)} en ${wallet.name}.${archivedNote}`,
    explanation: 'El saldo se calculó a partir de los ingresos, egresos y transferencias registrados en esa Wallet.',
  }
}

export function buildWalletDistributionAnswer(
  wallets: readonly WalletCopilotWallet[],
  total: number,
  currency: CurrencyCode,
): WalletCopilotAnswer {
  const withBalance = wallets.filter((wallet) => !wallet.isArchived || wallet.balance !== 0)
  const ordered = withBalance.slice().sort((left, right) => {
    if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
    if (left.isArchived !== right.isArchived) return left.isArchived ? 1 : -1
    return right.balance - left.balance
  })

  const MAX_SHOWN = 6
  const shown = ordered.slice(0, MAX_SHOWN)
  const remaining = ordered.length - shown.length
  const lines = shown.map((wallet) => `- ${formatWalletLine(wallet, currency)}`)
  const remainingLine = remaining > 0 ? `\n\nOtras Wallets: ${remaining}` : ''

  return {
    intent: 'wallet_distribution',
    text: `Tu dinero registrado está distribuido así:\n\n${lines.join('\n')}${remainingLine}\n\nTotal: ${formatCurrency(total, currency)}`,
    explanation: 'La distribución refleja el saldo actual de cada Wallet, incluyendo transferencias internas ya aplicadas.',
  }
}

export function buildWalletCountAnswer(
  scope: 'total' | 'active' | 'archived',
  activeCount: number,
  archivedCount: number,
): WalletCopilotAnswer {
  if (scope === 'active') {
    return {
      intent: 'wallet_count',
      text: `Tienes ${activeCount} ${activeCount === 1 ? 'Wallet activa' : 'Wallets activas'}.`,
      explanation: 'Se excluyeron las Wallets archivadas de este conteo.',
    }
  }
  if (scope === 'archived') {
    return {
      intent: 'wallet_count',
      text: `Tienes ${archivedCount} ${archivedCount === 1 ? 'Wallet archivada' : 'Wallets archivadas'}.`,
      explanation: 'Solo se cuentan las Wallets archivadas.',
    }
  }
  return {
    intent: 'wallet_count',
    text: `Tienes ${activeCount} ${activeCount === 1 ? 'Wallet activa' : 'Wallets activas'} y ${archivedCount} ${archivedCount === 1 ? 'archivada' : 'archivadas'}.`,
    explanation: 'El total incluye Wallets activas y archivadas para no ocultar ninguna de forma silenciosa.',
  }
}

export function buildWalletDefaultAnswer(defaultWallet: WalletCopilotWallet | null): WalletCopilotAnswer {
  if (defaultWallet === null) {
    return {
      intent: 'wallet_default',
      text: 'No pude determinar tu Wallet predeterminada.',
      explanation: 'No hay exactamente una Wallet activa marcada como predeterminada en tus datos.',
    }
  }
  return {
    intent: 'wallet_default',
    text: `Tu Wallet predeterminada es ${defaultWallet.name}.`,
    explanation: 'Se utiliza cuando registras un ingreso o egreso Personal sin seleccionar otra Wallet.',
  }
}

export function buildWalletExtremeBalanceAnswer(
  wallets: readonly WalletCopilotWallet[],
  direction: 'largest' | 'smallest',
  currency: CurrencyCode,
): WalletCopilotAnswer {
  const candidates = wallets.filter((wallet) => !wallet.isArchived)
  if (candidates.length === 0) {
    return {
      intent: direction === 'largest' ? 'wallet_largest_balance' : 'wallet_smallest_balance',
      text: 'No tienes Wallets activas para comparar.',
      explanation: 'No hay Wallets activas registradas.',
    }
  }

  const extremeBalance = direction === 'largest'
    ? Math.max(...candidates.map((wallet) => wallet.balance))
    : Math.min(...candidates.map((wallet) => wallet.balance))
  const tied = candidates.filter((wallet) => wallet.balance === extremeBalance)
  const label = direction === 'largest' ? 'mayor saldo' : 'menor saldo'
  const intent = direction === 'largest' ? 'wallet_largest_balance' as const : 'wallet_smallest_balance' as const

  if (tied.length > 1) {
    return {
      intent,
      text: `${tied.map((wallet) => wallet.name).join(' y ')} tienen el mismo saldo: ${formatCurrency(extremeBalance, currency)}.`,
      explanation: `Hay un empate en el ${label} entre Wallets activas.`,
    }
  }

  return {
    intent,
    text: `La Wallet con ${label} es ${tied[0].name}, con ${formatCurrency(extremeBalance, currency)}.`,
    explanation: `Se compararon los saldos actuales de tus Wallets activas.`,
  }
}

export interface WalletCopilotTransferSummaryInput {
  readonly transferCount: number
  readonly totalMoved: number
  readonly currency: CurrencyCode
  readonly periodLabel: string
  readonly latestTransfer: {
    readonly fromWalletName: string
    readonly toWalletName: string
    readonly amount: number
  } | null
}

export function buildWalletTransfersSummaryAnswer(input: WalletCopilotTransferSummaryInput): WalletCopilotAnswer {
  if (input.transferCount === 0) {
    return {
      intent: 'wallet_transfers_summary',
      text: `No tienes transferencias internas ${input.periodLabel}.\n\nLas transferencias entre Wallets no modifican tu balance general.`,
      explanation: 'No se encontraron transferencias registradas en el periodo consultado.',
    }
  }

  const latestLine = input.latestTransfer !== null
    ? `\n\nLa última fue de ${input.latestTransfer.fromWalletName} a ${input.latestTransfer.toWalletName} por ${formatCurrency(input.latestTransfer.amount, input.currency)}.`
    : ''

  return {
    intent: 'wallet_transfers_summary',
    text: `${input.periodLabel.charAt(0).toLocaleUpperCase('es')}${input.periodLabel.slice(1)} hiciste ${input.transferCount} ${input.transferCount === 1 ? 'transferencia interna' : 'transferencias internas'} por un total movido de ${formatCurrency(input.totalMoved, input.currency)}.${latestLine}`,
    explanation: 'El total movido no representa ingreso, egreso ni aumento del patrimonio: es dinero redistribuido entre tus propias Wallets.',
  }
}

export interface WalletCopilotLatestTransferInput {
  readonly date: string
  readonly fromWalletName: string
  readonly toWalletName: string
  readonly amount: number
  readonly currency: CurrencyCode
  readonly note?: string
}

export function buildWalletLatestTransferAnswer(transfer: WalletCopilotLatestTransferInput | null): WalletCopilotAnswer {
  if (transfer === null) {
    return {
      intent: 'wallet_latest_transfer',
      text: 'No encontré transferencias internas registradas en ese periodo.',
      explanation: 'No hay transferencias entre Wallets que coincidan con la consulta.',
    }
  }

  const formattedDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${transfer.date}T00:00:00.000Z`))
  const noteLine = transfer.note ? `\n\nNota: ${transfer.note}.` : ''

  return {
    intent: 'wallet_latest_transfer',
    text: `Tu última transferencia fue el ${formattedDate}:\n\n${transfer.fromWalletName} → ${transfer.toWalletName}\n${formatCurrency(transfer.amount, transfer.currency)}${noteLine}`,
    explanation: 'Se ordenó por fecha de la transferencia, usando la fecha de creación como criterio de desempate.',
  }
}

export function buildWalletPeriodUnresolvableAnswer(): WalletCopilotAnswer {
  return {
    intent: 'wallet_period_unresolvable',
    text: 'No pude determinar el periodo de la consulta.',
    explanation: 'El periodo solicitado no coincide con ninguno de los periodos soportados (hoy, esta semana, este mes, mes anterior, este año, todo el historial).',
  }
}

export function buildWalletContextDeniedAnswer(): WalletCopilotAnswer {
  return {
    intent: 'wallet_total',
    text: 'Las Wallets pertenecen al espacio Personal. Cambia al espacio Personal para consultar su distribución.',
    explanation: 'Las consultas de Wallets solo están disponibles en el espacio Personal, incluso en modo Híbrido.',
  }
}

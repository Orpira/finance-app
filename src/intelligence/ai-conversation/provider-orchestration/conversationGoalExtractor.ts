import type {
  ConversationGoalExtractionResult,
  ConversationGoalType,
} from './conversationGoalContracts'

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Reglas deterministas de deteccion de objetivo (seccion 6). Se evaluan en
 * orden y la primera que matchea gana -- ningun mensaje real deberia activar
 * dos objetivos a la vez, pero de ocurrir se prioriza la primera regla mas
 * especifica de la lista.
 */
const GOAL_DETECTION_RULES: readonly { readonly type: ConversationGoalType; readonly pattern: RegExp }[] = [
  { type: 'PAY_OFF_DEBT', pattern: /quiero salir de deudas?|salir de (la )?deuda/ },
  { type: 'PREPARE_TAXES', pattern: /preparar (mis )?impuestos|declarar (mis )?impuestos/ },
  { type: 'BUY_HOUSE', pattern: /comprar (una |la )?casa|comprar (un )?apartamento|comprar (una )?vivienda/ },
  { type: 'BUY_VEHICLE', pattern: /comprar (un |el )?(vehiculo|coche|carro|auto)\b/ },
  { type: 'RETIRE', pattern: /jubilarme|jubilacion|retirarme/ },
  { type: 'TRAVEL', pattern: /quiero viajar|hacer un viaje|planear (un )?viaje/ },
  { type: 'REDUCE_EXPENSES', pattern: /reducir gastos|gastar menos|bajar (mis )?gastos/ },
  { type: 'INCREASE_INCOME', pattern: /ganar mas|aumentar (mis )?ingresos|incrementar (mis )?ingresos/ },
  { type: 'ORGANIZE_MONEY', pattern: /organizar (mi )?dinero|ordenar (mis )?finanzas/ },
  { type: 'IMPROVE_FINANCES', pattern: /mejorar (mis )?finanzas/ },
  { type: 'SAVE_MORE', pattern: /quiero ahorrar|ahorrar mas|empezar a ahorrar/ },
]

const MONTHLY_AMOUNT_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:€|eur|euros)?\s*(?:mensuales?|al mes|por mes|cada mes|\/\s*mes)/

/**
 * Motivacion detras del objetivo (seccion 7, "quiero ahorrar para un viaje").
 * No reemplaza el tipo de objetivo ya detectado por
 * `GOAL_DETECTION_RULES` -- solo enriquece con el complemento "para X".
 */
const MOTIVATION_PATTERN = /\bpara (?:un |una |el |la )?([a-z0-9 ]+?)(?:[.,?!]|$)/

const TIME_HORIZON_PATTERNS: readonly RegExp[] = [
  /\ben (\d+ ?(?:dias?|semanas?|meses?|a[nñ]os?))\b/,
  /\bpara (?:el |la )?(pr[oó]ximo a[nñ]o|pr[oó]xima semana|pr[oó]ximo mes)\b/,
  /\bantes de (?:fin de )?(?:a[nñ]o|mes|[a-z]+)\b/,
]

function extractMonthlyTargetAmount(normalized: string): number | null {
  const match = normalized.match(MONTHLY_AMOUNT_PATTERN)
  if (match === null) {
    return null
  }
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) ? value : null
}

function extractMotivation(normalized: string, detectedType: ConversationGoalType | null): string | null {
  if (detectedType === null) {
    return null
  }
  const match = normalized.match(MOTIVATION_PATTERN)
  if (match === null) {
    return null
  }
  const motivation = match[1].trim()
  return motivation.length === 0 ? null : motivation
}

function extractTimeHorizon(normalized: string): string | null {
  for (const pattern of TIME_HORIZON_PATTERNS) {
    const match = normalized.match(pattern)
    if (match !== null) {
      return (match[1] ?? match[0]).trim()
    }
  }
  return null
}

/**
 * Extrae un objetivo conversacional (y su enriquecimiento) de un mensaje del
 * usuario, de forma puramente deterministica -- ninguna llamada a un
 * proveedor de IA ni a las Financial Tools. Devuelve `type: null` cuando el
 * mensaje no contiene ninguna expresion de objetivo reconocida; en ese caso
 * los demas campos tambien pueden venir informados si el mensaje solo aporta
 * enriquecimiento (p. ej. "Mi meta son 500 € mensuales" sin repetir el tipo).
 */
export function extractConversationGoal(userMessage: string): ConversationGoalExtractionResult {
  const normalized = normalize(userMessage)

  const detectedRule = GOAL_DETECTION_RULES.find((rule) => rule.pattern.test(normalized))
  const type = detectedRule?.type ?? null

  return {
    type,
    monthlyTargetAmount: extractMonthlyTargetAmount(normalized),
    motivation: extractMotivation(normalized, type),
    timeHorizon: extractTimeHorizon(normalized),
  }
}

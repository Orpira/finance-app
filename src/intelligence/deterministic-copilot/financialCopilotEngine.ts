import type { CurrencyCode } from '../../types/settings'

export interface FinancialCopilotPeriodSummary {
  readonly income: number
  readonly expenses: number
  readonly incomeCount: number
  readonly expenseCount: number
}

export interface FinancialCopilotSnapshot {
  readonly asOfDate: string
  readonly calculatedAt: string
  readonly source: 'local-financial-domain'
  readonly period: {
    readonly current: FinancialCopilotPeriod
    readonly previous: FinancialCopilotPeriod
  }
  readonly limitations: readonly string[]
  readonly currency: CurrencyCode
  readonly currentMonth: FinancialCopilotPeriodSummary
  readonly previousMonth: FinancialCopilotPeriodSummary
  readonly currentWeek: FinancialCopilotPeriodSummary
  readonly previousWeek: FinancialCopilotPeriodSummary
  readonly movementDates: {
    readonly currentIncome: readonly string[]
    readonly currentExpenses: readonly string[]
    readonly previousIncome: readonly string[]
    readonly previousExpenses: readonly string[]
  }
  readonly expenseCategories: readonly {
    readonly category: string
    readonly amount: number
    readonly count: number
  }[]
  readonly pendingIncome: {
    readonly count: number
    readonly overdueCount: number
  }
  readonly appointments: {
    readonly todayPendingCount: number
    readonly nextPendingDateTime: string | null
    readonly lastDateTime: string | null
  }
  readonly yesterdayIncome: {
    readonly amount: number
    readonly count: number
  }
}

export interface FinancialCopilotPeriod {
  readonly start: string
  readonly end: string
  readonly label: string
}

export interface FinancialEvidence {
  readonly metric: string
  readonly currentValue: number
  readonly previousValue?: number
  readonly delta?: number
  readonly period: string
  readonly source: FinancialCopilotSnapshot['source']
}

export interface FinancialCopilotAction {
  readonly id: string
  readonly label: string
  readonly to: string
}

export interface FinancialCopilotInsight {
  readonly id: string
  readonly message: string
  readonly explanation: string
  readonly tone: 'positive' | 'attention' | 'neutral'
  readonly evidence: readonly FinancialEvidence[]
  readonly action?: Omit<FinancialCopilotAction, 'id'>
}

export interface FinancialCopilotPriority {
  readonly id: string
  readonly message: string
  readonly action: Omit<FinancialCopilotAction, 'id'>
}

export type FinancialHealthState = 'very_stable' | 'stable' | 'needs_attention'

export interface FinancialCopilotResult {
  readonly insights: readonly FinancialCopilotInsight[]
  readonly todayPriorities: readonly FinancialCopilotPriority[]
  readonly financialHealth: {
    readonly state: FinancialHealthState
    readonly label: 'Muy estable' | 'Estable' | 'Necesita atención'
    readonly explanation: string
    readonly activeRules: readonly string[]
    readonly evidence: readonly FinancialEvidence[]
    readonly limitations: readonly string[]
    readonly calculatedAt: string
  }
  readonly summary: string
  readonly suggestedActions: readonly FinancialCopilotAction[]
}

export type FinancialCopilotQueryIntent =
  | 'monthly-income'
  | 'monthly-expenses'
  | 'top-expense-category'
  | 'pending-income-count'
  | 'last-appointment'
  | 'yesterday-income'
  | 'previous-period'
  | 'context-explanation'
  | 'top-category-follow-up'
  | 'movement-count-follow-up'
  | 'movement-dates-follow-up'
  | 'pending-only-follow-up'
  | 'previous-week-comparison'
  | 'suggested-action-follow-up'
  | 'create-action-follow-up'
  | 'insufficient-context'

export interface FinancialCopilotQueryAnswer {
  readonly intent: FinancialCopilotQueryIntent
  readonly text: string
  readonly explanation: string
  readonly period: 'current_month' | 'previous_month' | 'current_week' | 'previous_week' | 'yesterday' | null
  readonly category: string | null
  readonly metric?: 'income' | 'expenses' | 'balance' | 'movements' | 'pending_income' | 'appointments'
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const LOCAL_QUERY_PATTERNS = [
  /cuant[oa].*(gane|ingres|cobre|recibi)/,
  /cuant[oa].*(gaste|gasto|gastos|egreso)/,
  /categoria.*(mas|mayor).*(gasto|egreso)|(mas|mayor).*(gasto|egreso).*categoria/,
  /cuant[oa]s?.*(ingreso|ingresos).*(reportar|pendiente)|ingreso.*(reportar|pendiente)/,
  /ultima cita|cita.*ultima/,
  /ingreso.*ayer|ayer.*ingreso/,
] as const

export function canAnswerFinancialCopilotQuery(query: string): boolean {
  const normalized = normalizeText(query)
  return LOCAL_QUERY_PATTERNS.some((pattern) => pattern.test(normalized))
}

const LOCAL_FOLLOW_UP_PATTERNS = [
  /y el mes anterior|mes anterior\?*$/,
  /por que|explicame (ese|el) cambio/,
  /cual fue la categoria principal|que categoria fue la (mayor|principal)/,
  /cuantos movimientos fueron/,
  /que fechas/,
  /solo (los )?pendientes|muestrame.*pendientes/,
  /comparalo con la semana anterior|semana anterior/,
  /que puedo hacer/,
  /crear una accion.*(esto|partir)/,
  /muestrame solo [a-z0-9 ]+|solo la categoria [a-z0-9 ]+/,
] as const

export function canAnswerFinancialCopilotFollowUp(query: string): boolean {
  const normalized = normalizeText(query)
  return LOCAL_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function createInsufficientContextAnswer(): FinancialCopilotQueryAnswer {
  return {
    intent: 'insufficient-context',
    text: 'No tengo suficiente contexto para responder. Indica el periodo o la métrica que deseas consultar.',
    explanation: 'El contexto temporal de esta sesión no contiene una consulta financiera anterior compatible.',
    period: null,
    category: null,
  }
}

function formatMoney(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value))
}

function percentageChange(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return ((current - previous) / previous) * 100
}

function plural(count: number, singular: string, pluralValue: string): string {
  return count === 1 ? singular : pluralValue
}

function buildInsights(snapshot: FinancialCopilotSnapshot): FinancialCopilotInsight[] {
  const insights: FinancialCopilotInsight[] = []
  const incomeChange = percentageChange(snapshot.currentMonth.income, snapshot.previousMonth.income)
  const expenseChange = percentageChange(snapshot.currentMonth.expenses, snapshot.previousMonth.expenses)

  if (incomeChange !== null && Math.abs(incomeChange) >= 10) {
    insights.push({
      id: incomeChange > 0 ? 'income-growth' : 'income-reduction',
      message: `Tus ingresos ${incomeChange > 0 ? 'crecieron' : 'bajaron'} un ${formatPercentage(incomeChange)} % este mes.`,
      explanation: `Se compararon ${formatMoney(snapshot.currentMonth.income, snapshot.currency)} de este mes con ${formatMoney(snapshot.previousMonth.income, snapshot.currency)} del anterior.`,
      tone: incomeChange > 0 ? 'positive' : 'attention',
      evidence: [{
        metric: 'income',
        currentValue: snapshot.currentMonth.income,
        previousValue: snapshot.previousMonth.income,
        delta: snapshot.currentMonth.income - snapshot.previousMonth.income,
        period: snapshot.period.current.label,
        source: snapshot.source,
      }],
    })
  }

  if (expenseChange !== null && Math.abs(expenseChange) >= 10) {
    insights.push({
      id: expenseChange < 0 ? 'expense-reduction' : 'expense-growth',
      message: `Tus gastos ${expenseChange < 0 ? 'bajaron' : 'subieron'} un ${formatPercentage(expenseChange)} % este mes.`,
      explanation: `Se compararon ${formatMoney(snapshot.currentMonth.expenses, snapshot.currency)} de este mes con ${formatMoney(snapshot.previousMonth.expenses, snapshot.currency)} del anterior.`,
      tone: expenseChange < 0 ? 'positive' : 'attention',
      evidence: [{
        metric: 'expenses',
        currentValue: snapshot.currentMonth.expenses,
        previousValue: snapshot.previousMonth.expenses,
        delta: snapshot.currentMonth.expenses - snapshot.previousMonth.expenses,
        period: snapshot.period.current.label,
        source: snapshot.source,
      }],
    })
  }

  const topCategory = snapshot.expenseCategories[0]
  if (
    topCategory !== undefined &&
    snapshot.currentMonth.expenses > 0 &&
    topCategory.count >= 2 &&
    topCategory.amount / snapshot.currentMonth.expenses >= 0.4
  ) {
    insights.push({
      id: 'top-expense-category',
      message: `${topCategory.category} concentra la mayor parte de tus gastos.`,
      explanation: `${topCategory.count} gastos suman ${formatMoney(topCategory.amount, snapshot.currency)}, al menos el 40 % del total mensual.`,
      tone: 'neutral',
      evidence: [{
        metric: `expense_category:${topCategory.category}`,
        currentValue: topCategory.amount,
        period: snapshot.period.current.label,
        source: snapshot.source,
      }],
    })
  }

  if (snapshot.pendingIncome.count > 0) {
    insights.push({
      id: 'pending-income',
      message: `Tienes ${snapshot.pendingIncome.count} ${plural(snapshot.pendingIncome.count, 'ingreso', 'ingresos')} sin reportar.`,
      explanation: snapshot.pendingIncome.overdueCount > 0
        ? `${snapshot.pendingIncome.overdueCount} ${plural(snapshot.pendingIncome.overdueCount, 'lleva', 'llevan')} más de 7 días pendiente.`
        : 'Todos los pendientes tienen menos de 8 días.',
      tone: snapshot.pendingIncome.overdueCount > 0 ? 'attention' : 'neutral',
      evidence: [{
        metric: 'pending_income_count',
        currentValue: snapshot.pendingIncome.count,
        period: snapshot.period.current.label,
        source: snapshot.source,
      }, {
        metric: 'overdue_pending_income_count',
        currentValue: snapshot.pendingIncome.overdueCount,
        period: snapshot.period.current.label,
        source: snapshot.source,
      }],
      action: { label: 'Revisar ingresos', to: '/income/pendientes' },
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'no-material-change',
      message: 'No hay cambios importantes que requieran tu atención.',
      explanation: 'Las reglas locales no detectaron variaciones relevantes ni ingresos pendientes.',
      tone: 'neutral',
      evidence: [{
        metric: 'material_change_count',
        currentValue: 0,
        period: snapshot.period.current.label,
        source: snapshot.source,
      }],
    })
  }

  return insights.slice(0, 4)
}

function buildTodayPriorities(snapshot: FinancialCopilotSnapshot): FinancialCopilotPriority[] {
  const priorities: FinancialCopilotPriority[] = []

  if (snapshot.appointments.todayPendingCount > 0) {
    priorities.push({
      id: 'today-appointments',
      message: `Hoy tienes ${snapshot.appointments.todayPendingCount} ${plural(snapshot.appointments.todayPendingCount, 'cita', 'citas')}.`,
      action: { label: 'Ver agenda', to: '/agenda' },
    })
  }

  if (snapshot.pendingIncome.overdueCount > 0) {
    priorities.push({
      id: 'overdue-pending-income',
      message: `${snapshot.pendingIncome.overdueCount} ${plural(snapshot.pendingIncome.overdueCount, 'ingreso lleva', 'ingresos llevan')} más de 7 días sin reportar.`,
      action: { label: 'Revisar ahora', to: '/income/pendientes' },
    })
  }

  return priorities.slice(0, 3)
}

function buildFinancialHealth(snapshot: FinancialCopilotSnapshot): FinancialCopilotResult['financialHealth'] {
  const { income, expenses } = snapshot.currentMonth
  const balanceEvidence: FinancialEvidence = {
    metric: 'balance',
    currentValue: income - expenses,
    period: snapshot.period.current.label,
    source: snapshot.source,
  }
  const pendingEvidence: FinancialEvidence = {
    metric: 'overdue_pending_income_count',
    currentValue: snapshot.pendingIncome.overdueCount,
    period: snapshot.period.current.label,
    source: snapshot.source,
  }

  if ((income > 0 || expenses > 0) && expenses > income) {
    return {
      state: 'needs_attention',
      label: 'Necesita atención',
      explanation: `Los gastos del mes superan los ingresos en ${formatMoney(expenses - income, snapshot.currency)}.`,
      activeRules: ['expenses_exceed_income'],
      evidence: [balanceEvidence],
      limitations: snapshot.limitations,
      calculatedAt: snapshot.calculatedAt,
    }
  }

  const isVeryStable = income > 0 &&
    snapshot.previousMonth.income > 0 &&
    income >= snapshot.previousMonth.income &&
    expenses <= snapshot.previousMonth.expenses &&
    snapshot.pendingIncome.overdueCount === 0

  if (isVeryStable) {
    return {
      state: 'very_stable',
      label: 'Muy estable',
      explanation: 'El balance es positivo, los ingresos no bajaron, los gastos no subieron y no hay pendientes vencidos.',
      activeRules: ['balance_covers_expenses', 'income_not_decreasing', 'expenses_not_increasing', 'no_overdue_income'],
      evidence: [balanceEvidence, pendingEvidence],
      limitations: snapshot.limitations,
      calculatedAt: snapshot.calculatedAt,
    }
  }

  return {
    state: 'stable',
    label: 'Estable',
    explanation: income === 0 && expenses === 0
      ? 'Aún no hay actividad suficiente para detectar una situación que requiera atención.'
      : 'El balance mensual es positivo, aunque todavía hay algún indicador por revisar.',
    activeRules: income === 0 && expenses === 0
      ? ['insufficient_activity']
      : ['balance_covers_expenses'],
    evidence: [balanceEvidence, pendingEvidence],
    limitations: income === 0 && expenses === 0
      ? [...snapshot.limitations, 'No hay actividad suficiente en el periodo actual.']
      : snapshot.limitations,
    calculatedAt: snapshot.calculatedAt,
  }
}

function buildSummary(snapshot: FinancialCopilotSnapshot): string {
  const countSentence = `Durante este mes registraste ${snapshot.currentMonth.incomeCount} ${plural(snapshot.currentMonth.incomeCount, 'ingreso', 'ingresos')} y ${snapshot.currentMonth.expenseCount} ${plural(snapshot.currentMonth.expenseCount, 'gasto', 'gastos')}.`
  const incomeChange = percentageChange(snapshot.currentMonth.income, snapshot.previousMonth.income)
  const trendSentence = incomeChange === null
    ? 'No hay un mes anterior comparable para medir la variación de ingresos.'
    : `Tus ingresos ${incomeChange >= 0 ? 'aumentaron' : 'bajaron'} un ${formatPercentage(incomeChange)} % respecto al mes anterior.`
  const pendingSentence = snapshot.pendingIncome.count > 0
    ? `Todavía tienes ${snapshot.pendingIncome.count} ${plural(snapshot.pendingIncome.count, 'ingreso', 'ingresos')} sin reportar.`
    : 'No tienes ingresos pendientes de reportar.'

  return `${countSentence} ${trendSentence} ${pendingSentence}`
}

export function buildFinancialCopilot(snapshot: FinancialCopilotSnapshot): FinancialCopilotResult {
  return {
    insights: buildInsights(snapshot),
    todayPriorities: buildTodayPriorities(snapshot),
    financialHealth: buildFinancialHealth(snapshot),
    summary: buildSummary(snapshot),
    suggestedActions: [
      { id: 'weekly-summary', label: 'Consultar resumen mensual', to: '/resumen-completo' },
      { id: 'ask-assistant', label: 'Consultar al asistente', to: '/conversation' },
    ],
  }
}

function formatAppointmentDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

export function answerFinancialCopilotQuery(
  query: string,
  snapshot: FinancialCopilotSnapshot,
): FinancialCopilotQueryAnswer | null {
  const normalized = normalizeText(query)
  if (!canAnswerFinancialCopilotQuery(query)) return null
  const format = (value: number) => formatMoney(value, snapshot.currency)

  if (/cuant[oa].*(gane|ingres|cobre|recibi)/.test(normalized) && !/(report|pendiente)/.test(normalized)) {
    return {
      intent: 'monthly-income',
      text: `Este mes registraste ${format(snapshot.currentMonth.income)} en ingresos.`,
      explanation: `El total corresponde a ${snapshot.currentMonth.incomeCount} ${plural(snapshot.currentMonth.incomeCount, 'ingreso', 'ingresos')} del mes actual.`,
      period: 'current_month',
      category: null,
      metric: 'income',
    }
  }

  if (/cuant[oa].*(gaste|gasto|gastos|egreso)/.test(normalized)) {
    return {
      intent: 'monthly-expenses',
      text: `Este mes registraste ${format(snapshot.currentMonth.expenses)} en gastos.`,
      explanation: `El total corresponde a ${snapshot.currentMonth.expenseCount} ${plural(snapshot.currentMonth.expenseCount, 'gasto', 'gastos')} del mes actual.`,
      period: 'current_month',
      category: null,
      metric: 'expenses',
    }
  }

  if (/categoria.*(mas|mayor).*(gasto|egreso)|(mas|mayor).*(gasto|egreso).*categoria/.test(normalized)) {
    const topCategory = snapshot.expenseCategories[0]
    return {
      intent: 'top-expense-category',
      text: topCategory === undefined
        ? 'Este mes todavía no hay gastos por categoría.'
        : `${topCategory.category} fue la categoría con más gastos: ${format(topCategory.amount)}.`,
      explanation: topCategory === undefined
        ? 'No existen gastos mensuales con los que comparar categorías.'
        : `Se agruparon los gastos almacenados por categoría; ${topCategory.category} reúne ${topCategory.count}.`,
      period: 'current_month',
      category: topCategory?.category ?? null,
      metric: 'expenses',
    }
  }

  if (/cuant[oa]s?.*(ingreso|ingresos).*(reportar|pendiente)|ingreso.*(reportar|pendiente)/.test(normalized)) {
    return {
      intent: 'pending-income-count',
      text: `Tienes ${snapshot.pendingIncome.count} ${plural(snapshot.pendingIncome.count, 'ingreso', 'ingresos')} sin reportar.`,
      explanation: snapshot.pendingIncome.overdueCount > 0
        ? `${snapshot.pendingIncome.overdueCount} supera los 7 días pendiente.`
        : 'Ninguno supera los 7 días pendiente.',
      period: null,
      category: null,
      metric: 'pending_income',
    }
  }

  if (/ultima cita|cita.*ultima/.test(normalized)) {
    return {
      intent: 'last-appointment',
      text: snapshot.appointments.lastDateTime === null
        ? 'No encontré citas anteriores registradas.'
        : `Tu última cita registrada fue el ${formatAppointmentDate(snapshot.appointments.lastDateTime)}.`,
      explanation: 'Se consultó la cita más reciente anterior a hoy en la agenda local.',
      period: null,
      category: null,
      metric: 'appointments',
    }
  }

  if (/ingreso.*ayer|ayer.*ingreso/.test(normalized)) {
    return {
      intent: 'yesterday-income',
      text: snapshot.yesterdayIncome.count === 0
        ? 'Ayer no registraste ingresos.'
        : `Ayer registraste ${snapshot.yesterdayIncome.count} ${plural(snapshot.yesterdayIncome.count, 'ingreso', 'ingresos')} por ${format(snapshot.yesterdayIncome.amount)}.`,
      explanation: 'Se sumaron únicamente los ingresos cuya fecha corresponde a ayer.',
      period: 'yesterday',
      category: null,
      metric: 'income',
    }
  }

  return null
}

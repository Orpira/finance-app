import type { FinancialGoal, FinancialGoalProgress } from '../types/financialGoal'

type GoalProgressView = Pick<
  FinancialGoalProgress,
  'currentAmount' | 'targetAmount' | 'remainingAmount' | 'percentage' | 'state'
>

export interface FinancialGoalPresentation {
  readonly daysRemaining: number
  readonly statusLabel: string
  readonly updatedAtLabel: string
  readonly recommendation: string
}

function parseDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
}

function formatAmount(value: number, currency: string): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value)
}

function resolveStatus(goal: FinancialGoal, progress: GoalProgressView): string {
  if (goal.status === 'paused') return 'Pausado'
  if (goal.status === 'cancelled') return 'Cancelado'
  if (progress.state === 'achieved') return 'Completado'
  if (progress.state === 'limit_exceeded') return 'Límite excedido'
  if (progress.state === 'limit_reached') return 'Límite alcanzado'
  return 'En progreso'
}

function resolveRecommendation(goal: FinancialGoal, progress: GoalProgressView): string {
  if (goal.status === 'paused') return 'Reanuda el objetivo cuando quieras volver a medir su progreso.'
  if (progress.state === 'achieved') return 'Objetivo completado. Puedes mantenerlo activo hasta el final del periodo.'
  if (progress.state === 'limit_exceeded') return 'Revisa los gastos del periodo antes de realizar nuevos desembolsos.'
  if (progress.state === 'limit_reached') return 'Has alcanzado el límite. Revisa cualquier gasto adicional con cuidado.'
  if (goal.type === 'expense_limit') {
    return `Dispones de ${formatAmount(progress.remainingAmount, goal.currency)} antes de alcanzar el límite.`
  }
  return `Mantén el ritmo: faltan ${formatAmount(progress.remainingAmount, goal.currency)} para completar este objetivo.`
}

export function buildFinancialGoalPresentation(
  goal: FinancialGoal,
  progress: GoalProgressView,
  referenceDate: string,
): FinancialGoalPresentation {
  const milliseconds = goal.endDate
    ? Math.max(0, parseDate(goal.endDate).getTime() - parseDate(referenceDate).getTime())
    : 0
  return {
    daysRemaining: Math.ceil(milliseconds / 86_400_000),
    statusLabel: resolveStatus(goal, progress),
    updatedAtLabel: new Intl.DateTimeFormat('es-ES', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(goal.updatedAt)),
    recommendation: resolveRecommendation(goal, progress),
  }
}

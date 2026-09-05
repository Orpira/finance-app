import type { Appointment } from '../types/appointment'
import type { Expense } from '../types/expense'
import type { PersonalIncomeCategory } from '../types/personalIncomeCategory'
import type { ServiceIncome } from '../types/service'
import { getIncomeTypeLabel } from './incomeTypes'
import { normalizePersonalIncomeName } from './personalIncomeName'
import { normalizePersonalExpenseName } from './personalExpenseName'
import { resolveRecordUsageMode } from './usageMode'

function formatTimeFromDateTime(dateTime: string | undefined) {
  if (!dateTime) {
    return ''
  }

  const parsedDate = new Date(dateTime)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate)
}

export function getIncomeDateTime(income: ServiceIncome) {
  return income.timerStartedAt ?? income.timerStoppedAt ?? income.createdAt
}

export function getIncomeTime(income: ServiceIncome) {
  return formatTimeFromDateTime(getIncomeDateTime(income))
}

export function getIncomeDisplayName(income: ServiceIncome) {
  if (resolveRecordUsageMode(income) === 'basic') {
    const personalName = normalizePersonalIncomeName(income.personalName)
    if (personalName) return personalName
    return `Ingreso #${income.id ?? '-'}`
  }

  return [
    `${getIncomeTypeLabel(income)} #${income.id ?? '-'}`,
    /* income.date,
    getIncomeTime(income),
    income.city, */ //Relación Registros de ingresos: Se oculta fecha de ingreso y ciudad de temporada
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Secondary, discreet badge next to the income's free-text name — never a
 * replacement for it. Personal-only: Profesional records never carry a
 * personalCategoryId, so this is naturally undefined for them.
 */
export function getIncomeCategoryBadgeLabel(
  income: Pick<ServiceIncome, 'personalCategoryId' | 'usageMode' | 'earningPeriodId' | 'seasonPeriodId'>,
  categories: readonly PersonalIncomeCategory[],
): string | undefined {
  if (resolveRecordUsageMode(income) !== 'basic' || !income.personalCategoryId) {
    return undefined
  }

  const category = categories.find((item) => item.id === income.personalCategoryId)
  if (!category) return undefined

  return category.isArchived ? `${category.name} · Archivada` : category.name
}

export function getAppointmentDisplayName(
  appointment: Appointment,
  fallbackCity = '',
) {
  return [
    `Cita #${appointment.id ?? '-'}`,
    appointment.dateTime.slice(0, 10),
    formatTimeFromDateTime(appointment.dateTime),
    appointment.city || fallbackCity,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function getExpenseDisplayName(expense: Expense) {
  if (resolveRecordUsageMode(expense) === 'basic') {
    const personalName = normalizePersonalExpenseName(expense.personalName)
    if (personalName) return personalName
    return `Egreso #${expense.id ?? '-'}`
  }

  return [
    `${expense.type === 'ajuste' ? 'Ajuste' : 'Gasto'} #${expense.id ?? '-'}`,
    expense.type === 'ajuste' ? undefined : expense.category,
    expense.date,
    formatTimeFromDateTime(expense.createdAt),
    expense.city,
  ]
    .filter(Boolean)
    .join(' · ')
}

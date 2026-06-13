import type { Appointment } from '../types/appointment'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'

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
  return [
    `Ingreso #${income.id ?? '-'}`,
    income.date,
    getIncomeTime(income),
    income.city,
  ]
    .filter(Boolean)
    .join(' · ')
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
  return [
    `Gasto #${expense.id ?? '-'}`,
    expense.category,
    expense.date,
    expense.city,
  ]
    .filter(Boolean)
    .join(' · ')
}

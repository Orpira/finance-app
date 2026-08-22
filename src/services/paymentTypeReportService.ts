import type { ServiceIncome } from '../types/service'
import { getIncomePaymentTypeLabel, isServiceIncome } from '../utils/incomeTypes'

export function groupReportableIncomesByPaymentType(incomes: ServiceIncome[]) {
  const grouped = new Map<string, ServiceIncome[]>()

  incomes.filter(isServiceIncome).forEach((income) => {
    const paymentType = getIncomePaymentTypeLabel(income)
    grouped.set(paymentType, [...(grouped.get(paymentType) ?? []), income])
  })

  return grouped
}

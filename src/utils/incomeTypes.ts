import type { ServiceIncome, ServiceIncomeType } from '../types/service'
import { roundMoney } from './currency'

export function getIncomeType(income: Pick<ServiceIncome, 'type'>): ServiceIncomeType {
  const rawType = income.type as string | undefined

  if (['ajuste', 'adjustment', 'ajusteIngreso'].includes(rawType ?? '')) {
    return 'ajuste'
  }

  if (
    ['otro', 'other', 'otroIngreso', 'otro_ingreso', 'otherIncome'].includes(
      rawType ?? '',
    )
  ) {
    return 'otro'
  }

  return 'ingreso'
}

export function isServiceIncome(income: Pick<ServiceIncome, 'type'>) {
  return getIncomeType(income) === 'ingreso'
}

export function isAdjustmentIncome(income: Pick<ServiceIncome, 'type'>) {
  return getIncomeType(income) === 'ajuste'
}

export function normalizeAdjustmentIncome<T extends ServiceIncome>(income: T): T {
  if (!isAdjustmentIncome(income)) return income

  const previousEffectiveAmount = income.realGain
  const scaleValue = (value: number | undefined) =>
    value === undefined
      ? undefined
      : previousEffectiveAmount > 0
        ? roundMoney(value * (income.totalAmount / previousEffectiveAmount))
        : value

  return {
    ...income,
    paymentType: undefined,
    duration: 0,
    actualDuration: 0,
    percentage: 0,
    earningPercentage: 0,
    realGain: income.totalAmount,
    eurValue:
      income.currency === 'EUR'
        ? income.totalAmount
        : scaleValue(income.eurValue) ?? income.eurValue,
    copValue:
      income.currency === 'COP'
        ? income.totalAmount
        : scaleValue(income.copValue) ?? income.copValue,
    baseCurrencyValue:
      income.baseCurrency === income.currency
        ? income.totalAmount
        : scaleValue(income.baseCurrencyValue),
    secondaryCurrencyValue: scaleValue(income.secondaryCurrencyValue),
  }
}

export function getIncomeTypeLabel(income: Pick<ServiceIncome, 'type'>) {
  const type = getIncomeType(income)
  if (type === 'ajuste') return 'Ajuste'
  if (type === 'otro') return 'Otro ingreso histórico'
  return 'Servicio'
}

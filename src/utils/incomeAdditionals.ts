import type { IncomeAdditional } from '../types/incomeAdditional'

export function assertAdditionalAmountIsValid(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El importe del adicional debe ser mayor que cero.')
  }
}

export function calculateAdditionalsTotal(
  additionals: Pick<IncomeAdditional, 'amount'>[],
) {
  return additionals.reduce((sum, item) => sum + item.amount, 0)
}

export function assertAllIncomeAdditionalsAreValid(
  incomes: { id?: number }[],
  additionals: Pick<IncomeAdditional, 'incomeId' | 'amount'>[],
) {
  const incomeIds = new Set(
    incomes
      .map((income) => income.id)
      .filter((id): id is number => id !== undefined),
  )

  additionals.forEach((additional) => {
    assertAdditionalAmountIsValid(additional.amount)

    if (!incomeIds.has(additional.incomeId)) {
      throw new Error(
        `El adicional referencia un ingreso inexistente (incomeId=${additional.incomeId}).`,
      )
    }
  })
}

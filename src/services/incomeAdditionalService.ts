import { assertWalletMutationAllowed } from './walletPaymentValidation'
import type { CurrencyCode } from '../types/settings'
import { db } from '../database/db'
import type { IncomeAdditional } from '../types/incomeAdditional'
import { assertRecordIsNotReported } from '../catalogs/reportStatuses'
import { assertAdditionalAmountIsValid, calculateAdditionalsTotal } from '../utils/incomeAdditionals'
import { roundMoney } from '../utils/currency'
import { requiresSeason } from '../utils/usageMode'
import { assertRecordIsMutable } from './earningPeriodService'
import { getSettings } from './settingsService'

export type CreateIncomeAdditionalInput = Pick<IncomeAdditional, 'amount' | 'description'>

async function assertIncomeAcceptsAdditionals(incomeId: number) {
  const settings = await getSettings()
  const income = await db.services.get(incomeId)
  if (!income) {
    throw new Error('El ingreso que intentas modificar no existe.')
  }
  assertRecordIsNotReported(income)
  if (requiresSeason(settings)) {
    await assertRecordIsMutable(income)
  }
  return income
}

/**
 * Recalcula ÚNICAMENTE `additionalsTotal`. El resto del registro del ingreso
 * (realGain, totalAmount, eurValue/copValue/etc.) nunca se toca desde acá:
 * refleja exclusivamente el trabajo realizado (servicio u horas), calculado
 * una sola vez al crear/editar el ingreso. Los Adicionales viven aparte y
 * solo se suman en "total recibido"/balance general
 * (`getStoredIncomeValue`, `src/utils/financeStats.ts`), nunca en Ingresos
 * ni en Ganancia (ADR-035).
 */
async function recalculateAdditionalsTotal(incomeId: number, currency: CurrencyCode) {
  const additionals = await db.incomeAdditionals
    .where('incomeId')
    .equals(incomeId)
    .toArray()
  const additionalsTotal = roundMoney(calculateAdditionalsTotal(additionals))

  const income = await db.services.get(incomeId)
  if (!income) throw new Error('El ingreso que intentas modificar no existe.')
  if (income.walletId) {
    await assertWalletMutationAllowed({ kind: 'income', before: income, after: { ...income, additionalsTotal } }, currency)
  }
  await db.services.update(incomeId, {
    additionalsTotal,
    updatedAt: new Date().toISOString(),
  })
}

export async function listIncomeAdditionals(incomeId: number) {
  return db.incomeAdditionals.where('incomeId').equals(incomeId).toArray()
}

export async function addIncomeAdditional(
  incomeId: number,
  input: CreateIncomeAdditionalInput,
) {
  assertAdditionalAmountIsValid(input.amount)
  await assertIncomeAcceptsAdditionals(incomeId)

  const settings = await getSettings()
  return db.transaction('rw', [db.services, db.incomeAdditionals, db.expenses, db.wallets, db.internalTransfers], async () => {
    const additionalId = await db.incomeAdditionals.add({
      incomeId,
      amount: input.amount,
      description: input.description,
      createdAt: new Date().toISOString(),
    })
    await recalculateAdditionalsTotal(incomeId, settings.defaultCurrency)
    return additionalId
  })
}

export async function deleteIncomeAdditional(id: number, incomeId: number) {
  await assertIncomeAcceptsAdditionals(incomeId)

  const settings = await getSettings()
  return db.transaction('rw', [db.services, db.incomeAdditionals, db.expenses, db.wallets, db.internalTransfers], async () => {
    await db.incomeAdditionals.delete(id)
    await recalculateAdditionalsTotal(incomeId, settings.defaultCurrency)
  })
}

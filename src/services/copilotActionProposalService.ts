import type { AssistantProposalRecord } from '../intelligence/assistant'
import type { FinancialCopilotSnapshot } from '../intelligence/deterministic-copilot'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'
import { getPendingIncomes } from './incomeReport.service'
import { createFinancialCopilotService } from './financialCopilotService'

export type CopilotActionPreparation =
  | { readonly kind: 'no-action' }
  | { readonly kind: 'message'; readonly text: string }
  | { readonly kind: 'proposal'; readonly proposal: AssistantProposalRecord }

const MONTHS: Readonly<Record<string, number>> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function currentMonthRange(now: Date) {
  return {
    start: dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
    end: dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))),
  }
}

function resolveMentionedDate(text: string, now: Date): string | null {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1]
  if (iso !== undefined) return iso
  const match = text.match(/(?:del|de)\s+(\d{1,2})\s+de\s+([a-z]+)/)
  if (match === null) return null
  const month = MONTHS[match[2]]
  if (month === undefined) return null
  const year = month > now.getUTCMonth() ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  return dateKey(new Date(Date.UTC(year, month, Number(match[1]))))
}

function resolveAmount(text: string): number | null {
  const value = text.match(/\b(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur)\b/)?.[1]
    ?? text.match(/importe\s+(\d+(?:[.,]\d{1,2})?)/)?.[1]
  if (value === undefined) return null
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

function createBase(kind: AssistantProposalRecord['kind'], sourceText: string, now: Date) {
  return {
    proposalId: `assistant-proposal:${kind}:${now.getTime()}`,
    kind,
    status: 'awaiting_confirmation' as const,
    createdAt: now.toISOString(),
    sourceText,
    missingRequiredFields: [] as string[],
  }
}

function incomeStatusLabel(income: ServiceIncome): string {
  if (income.reportStatusCode === 'pending') return 'Pendiente'
  return 'Sin revisar'
}

export function createCopilotActionProposalService(input: {
  readonly getPendingIncomes?: typeof getPendingIncomes
  readonly now?: () => Date
  readonly loadSnapshot?: () => Promise<Pick<FinancialCopilotSnapshot, 'currency' | 'currentMonth'>>
} = {}) {
  const financialCopilot = createFinancialCopilotService()
  const dependencies = {
    getPendingIncomes: input.getPendingIncomes ?? getPendingIncomes,
    now: input.now ?? (() => new Date()),
    loadSnapshot: input.loadSnapshot ?? (() => financialCopilot.loadSnapshot()),
  }

  return {
    async prepare(message: string, context: { readonly defaultCurrency: CurrencyCode }): Promise<CopilotActionPreparation> {
      const text = normalize(message)
      const now = dependencies.now()

      if (/marca.*reportad[oa].*ingreso/.test(text)) {
        const requestedDate = resolveMentionedDate(text, now)
        const requestedAmount = resolveAmount(text)
        if (requestedDate === null) {
          return { kind: 'message', text: 'Indica la fecha del ingreso que quieres marcar como reportado.' }
        }
        const candidates = (await dependencies.getPendingIncomes()).filter((income) =>
          income.date === requestedDate && (requestedAmount === null || income.totalAmount === requestedAmount),
        )
        if (candidates.length === 0) {
          return { kind: 'message', text: 'No encontré un ingreso sin reportar que coincida con esa fecha e importe.' }
        }
        if (candidates.length > 1) {
          const options = candidates.map((income) => `${income.totalAmount} ${income.currency}`).join(' y ')
          return { kind: 'message', text: `Encontré dos ingresos sin reportar en esa fecha: ${options}. Indica también el importe para seleccionar uno.` }
        }
        const income = candidates[0]
        return {
          kind: 'proposal',
          proposal: {
            ...createBase('mark_income_reported', message, now),
            kind: 'mark_income_reported',
            fields: {
              incomeId: income.id ?? null,
              date: income.date,
              amount: income.totalAmount,
              currency: income.currency as CurrencyCode,
              category: income.notes?.trim() || 'Ingreso',
              currentStatus: incomeStatusLabel(income),
            },
            missingRequiredFields: income.id === undefined ? ['incomeId'] : [],
          },
        }
      }

      if (/(genera|prepara|exporta).*(reporte|pdf)|(reporte|pdf).*(este mes|mes actual)|resumen.*antes.*exportar/.test(text)) {
        const range = currentMonthRange(now)
        const snapshot = await dependencies.loadSnapshot()
        const money = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: snapshot.currency }).format(value)
        return {
          kind: 'proposal',
          proposal: {
            ...createBase('generate_report', message, now),
            kind: 'generate_report',
            fields: {
              periodStart: range.start,
              periodEnd: range.end,
              format: 'pdf',
              includedData: `Ingresos ${money(snapshot.currentMonth.income)}, gastos ${money(snapshot.currentMonth.expenses)}, balance ${money(snapshot.currentMonth.income - snapshot.currentMonth.expenses)} y movimientos del periodo`,
            },
          },
        }
      }

      const goalType = /ahorrar|ahorro/.test(text)
        ? 'saving'
        : /limite.*gasto|gasto.*limite/.test(text)
          ? 'expense_limit'
          : /objetivo.*ingreso|meta.*ingreso/.test(text)
            ? 'income_target'
            : null
      if (goalType !== null) {
        const amount = resolveAmount(text)
        const range = currentMonthRange(now)
        const names = {
          saving: 'Ahorro mensual',
          expense_limit: 'Límite de gasto mensual',
          income_target: 'Objetivo de ingreso mensual',
        } as const
        return {
          kind: 'proposal',
          proposal: {
            ...createBase('create_financial_goal', message, now),
            kind: 'create_financial_goal',
            fields: {
              goalType,
              name: names[goalType],
              targetAmount: amount,
              currency: context.defaultCurrency,
              period: 'monthly',
              startDate: range.start,
              endDate: range.end,
            },
            missingRequiredFields: amount === null ? ['targetAmount'] : [],
          },
        }
      }

      return { kind: 'no-action' }
    },
  }
}

export const copilotActionProposalService = createCopilotActionProposalService()

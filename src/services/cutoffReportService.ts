import { db } from '../database/db'
import type { CutoffReport } from '../types/cutoffReport'
import type { ServiceIncome } from '../types/service'
import type { AppSettings } from '../types/settings'
import { getStoredExpenseValue, getStoredIncomeValue } from '../utils/financeStats'
import { isServiceIncome } from '../utils/incomeTypes'
import { getSettings } from './settingsService'

interface PeriodRange {
  from: string
  to: string
}

function toInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function fromInputDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return new Date()
  }

  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)

  return nextDate
}

function addMonthsClamped(date: Date, months: number) {
  const nextDate = new Date(date)
  const anchorDay = nextDate.getDate()

  nextDate.setDate(1)
  nextDate.setMonth(nextDate.getMonth() + months)

  const lastDay = new Date(
    nextDate.getFullYear(),
    nextDate.getMonth() + 1,
    0,
  ).getDate()
  nextDate.setDate(Math.min(anchorDay, lastDay))

  return nextDate
}

function getAlignedStart(settings: AppSettings) {
  const anchorDate = fromInputDate(settings.cutoffAnchorDate)

  if (settings.cutoffFrequency === 'monthly') {
    return anchorDate
  }

  const dayOffset =
    (anchorDate.getDay() - settings.cutoffWeekStart + 7) % 7

  return addDays(anchorDate, -dayOffset)
}

function getNextPeriodStart(settings: AppSettings, startDate: Date) {
  if (settings.cutoffFrequency === 'monthly') {
    return addMonthsClamped(startDate, 1)
  }

  return addDays(startDate, settings.cutoffFrequency === 'weekly' ? 7 : 14)
}

export function getCurrentCutoffRange(settings: AppSettings): PeriodRange {
  const today = new Date()
  let startDate = getAlignedStart(settings)
  let nextStartDate = getNextPeriodStart(settings, startDate)

  while (nextStartDate <= today) {
    startDate = nextStartDate
    nextStartDate = getNextPeriodStart(settings, startDate)
  }

  return {
    from: toInputDate(startDate),
    to: toInputDate(addDays(nextStartDate, -1)),
  }
}

function getClosedCutoffRanges(settings: AppSettings): PeriodRange[] {
  const today = new Date()
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  )
  const ranges: PeriodRange[] = []
  let startDate = getAlignedStart(settings)

  while (startDate < todayStart) {
    const nextStartDate = getNextPeriodStart(settings, startDate)
    const endDate = addDays(nextStartDate, -1)

    if (endDate >= todayStart) {
      break
    }

    ranges.push({
      from: toInputDate(startDate),
      to: toInputDate(endDate),
    })
    startDate = nextStartDate
  }

  return ranges
}

function sumIncomeByPaymentType(
  incomes: ServiceIncome[],
  currency: AppSettings['defaultCurrency'],
) {
  return incomes.filter(isServiceIncome).reduce<Record<string, number>>((totals, income) => {
    const paymentType = income.paymentType || 'SIN_TIPO'

    return {
      ...totals,
      [paymentType]:
        (totals[paymentType] ?? 0) + getStoredIncomeValue(income, currency),
    }
  }, {})
}

async function createCutoffReport(
  settings: AppSettings,
  range: PeriodRange,
): Promise<CutoffReport> {
  const [incomes, expenses] = await Promise.all([
    db.services.where('date').between(range.from, range.to, true, true).toArray(),
    db.expenses.where('date').between(range.from, range.to, true, true).toArray(),
  ])
  const incomeTotal = incomes.reduce(
    (total, income) => total + getStoredIncomeValue(income, settings.defaultCurrency),
    0,
  )
  const expenseTotal = expenses.reduce(
    (total, expense) =>
      total + getStoredExpenseValue(expense, settings.defaultCurrency),
    0,
  )
  const expenseCategoryTotals = expenses.reduce<Record<string, number>>(
    (totals, expense) => ({
      ...totals,
      [expense.category]:
        (totals[expense.category] ?? 0) +
        getStoredExpenseValue(expense, settings.defaultCurrency),
    }),
    {},
  )

  return {
    frequency: settings.cutoffFrequency,
    periodStart: range.from,
    periodEnd: range.to,
    generatedAt: new Date().toISOString(),
    currency: settings.defaultCurrency,
    incomeTotal,
    expenseTotal,
    netTotal: incomeTotal - expenseTotal,
    incomeCount: incomes.filter(isServiceIncome).length,
    expenseCount: expenses.length,
    serviceMinutes: incomes.filter(isServiceIncome).reduce(
      (total, income) => total + (income.actualDuration ?? income.duration),
      0,
    ),
    paymentTypeTotals: sumIncomeByPaymentType(incomes, settings.defaultCurrency),
    expenseCategoryTotals,
  }
}

export async function generateDueCutoffReports() {
  const settings = await getSettings()
  const ranges = getClosedCutoffRanges(settings)
  const generatedReports: CutoffReport[] = []

  for (const range of ranges) {
    const existingReport = await db.cutoffReports
      .where('[frequency+periodStart+periodEnd]')
      .equals([settings.cutoffFrequency, range.from, range.to])
      .first()

    if (existingReport) {
      continue
    }

    const report = await createCutoffReport(settings, range)
    const id = await db.cutoffReports.add(report)
    generatedReports.push({ ...report, id })
  }

  return generatedReports
}

export async function listCutoffReports() {
  return db.cutoffReports.orderBy('periodEnd').reverse().toArray()
}

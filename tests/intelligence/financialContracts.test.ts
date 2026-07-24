import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import type {
  FinancialBalanceFilters,
  FinancialBalanceInput,
  FinancialBalanceOutput,
  FinancialBalanceResult,
  FinancialBalanceSummary,
  FinancialBudgetFilters,
  FinancialBudgetInput,
  FinancialBudgetOutput,
  FinancialBudgetResult,
  FinancialBudgetSummary,
  FinancialGoalFilters,
  FinancialGoalInput,
  FinancialGoalOutput,
  FinancialGoalResult,
  FinancialGoalSummary,
  FinancialInvestmentFilters,
  FinancialInvestmentInput,
  FinancialInvestmentOutput,
  FinancialInvestmentResult,
  FinancialInvestmentSummary,
  FinancialReportFilters,
  FinancialReportInput,
  FinancialReportOutput,
  FinancialReportResult,
  FinancialReportSummary,
  FinancialTransactionFilters,
  FinancialTransactionInput,
  FinancialTransactionOutput,
  FinancialTransactionResult,
  FinancialTransactionSummary,
} from '../../src/intelligence/ai-tools/financial'
import type {
  FinancialBalanceFilters as BalanceFiltersFromLeaf,
  FinancialBalanceInput as BalanceInputFromLeaf,
  FinancialBalanceOutput as BalanceOutputFromLeaf,
  FinancialBalanceResult as BalanceResultFromLeaf,
  FinancialBalanceSummary as BalanceSummaryFromLeaf,
} from '../../src/intelligence/ai-tools/financial/balanceContracts'
import type {
  FinancialBudgetFilters as BudgetFiltersFromLeaf,
  FinancialBudgetInput as BudgetInputFromLeaf,
  FinancialBudgetOutput as BudgetOutputFromLeaf,
  FinancialBudgetResult as BudgetResultFromLeaf,
  FinancialBudgetSummary as BudgetSummaryFromLeaf,
} from '../../src/intelligence/ai-tools/financial/budgetContracts'
import type {
  FinancialGoalFilters as GoalFiltersFromLeaf,
  FinancialGoalInput as GoalInputFromLeaf,
  FinancialGoalOutput as GoalOutputFromLeaf,
  FinancialGoalResult as GoalResultFromLeaf,
  FinancialGoalSummary as GoalSummaryFromLeaf,
} from '../../src/intelligence/ai-tools/financial/goalsContracts'
import type {
  FinancialInvestmentFilters as InvestmentFiltersFromLeaf,
  FinancialInvestmentInput as InvestmentInputFromLeaf,
  FinancialInvestmentOutput as InvestmentOutputFromLeaf,
  FinancialInvestmentResult as InvestmentResultFromLeaf,
  FinancialInvestmentSummary as InvestmentSummaryFromLeaf,
} from '../../src/intelligence/ai-tools/financial/investmentsContracts'
import type {
  FinancialReportFilters as ReportFiltersFromLeaf,
  FinancialReportInput as ReportInputFromLeaf,
  FinancialReportOutput as ReportOutputFromLeaf,
  FinancialReportResult as ReportResultFromLeaf,
  FinancialReportSummary as ReportSummaryFromLeaf,
} from '../../src/intelligence/ai-tools/financial/reportsContracts'
import type {
  FinancialTransactionFilters as TransactionFiltersFromLeaf,
  FinancialTransactionInput as TransactionInputFromLeaf,
  FinancialTransactionOutput as TransactionOutputFromLeaf,
  FinancialTransactionResult as TransactionResultFromLeaf,
  FinancialTransactionSummary as TransactionSummaryFromLeaf,
} from '../../src/intelligence/ai-tools/financial/transactionsContracts'

const financialModuleRoot = resolve(process.cwd(), 'src/intelligence/ai-tools/financial')

const leafFiles = [
  'balanceContracts.ts',
  'transactionsContracts.ts',
  'budgetContracts.ts',
  'goalsContracts.ts',
  'investmentsContracts.ts',
  'reportsContracts.ts',
] as const

function readFinancialSource(fileName: string): string {
  return readFileSync(resolve(financialModuleRoot, fileName), 'utf8')
}

describe('financial tool contracts', () => {
  it('exports the public contracts from the barrel and leaf modules', () => {
    const balanceFilters: FinancialBalanceFilters = {
      currencyCode: 'EUR',
      usageMode: 'professional',
      includeAdjustments: true,
      tags: ['monthly'],
    }
    const balanceInput: FinancialBalanceInput = {
      requestId: 'financial:balance:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: balanceFilters,
    }
    const balanceSummary: FinancialBalanceSummary = {
      currencyCode: 'EUR',
      incomeTotal: 1000,
      expenseTotal: 250,
      adjustmentTotal: 50,
      netBalance: 800,
      hasData: true,
    }
    const balanceOutput: FinancialBalanceOutput = {
      summary: balanceSummary,
      breakdown: [
        {
          category: 'income',
          label: 'Ingresos',
          count: 2,
          totalAmount: 1000,
        },
      ],
    }
    const balanceResult: FinancialBalanceResult = {
      kind: 'success',
      output: balanceOutput,
    }

    const transactionFilters: FinancialTransactionFilters = {
      currencyCode: 'EUR',
      kinds: ['income', 'expense'],
      statuses: ['pending', 'reported'],
      query: 'service',
      minAmount: 10,
      maxAmount: 500,
    }
    const transactionInput: FinancialTransactionInput = {
      requestId: 'financial:transactions:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: transactionFilters,
      sort: { field: 'date', direction: 'desc' },
      limit: 25,
      cursor: 'cursor-001',
    }
    const transactionSummary: FinancialTransactionSummary = {
      currencyCode: 'EUR',
      matchedCount: 3,
      incomeTotal: 1000,
      expenseTotal: 250,
      netTotal: 750,
    }
    const transactionOutput: FinancialTransactionOutput = {
      summary: transactionSummary,
      items: [
        {
          transactionId: 'tx-001',
          kind: 'income',
          date: '2026-07-24',
          label: 'Consultoría',
          amount: 500,
          currencyCode: 'EUR',
        },
      ],
    }
    const transactionResult: FinancialTransactionResult = {
      kind: 'success',
      output: transactionOutput,
    }

    const budgetFilters: FinancialBudgetFilters = {
      currencyCode: 'EUR',
      statuses: ['active', 'planned'],
      budgetIds: ['budget-001'],
    }
    const budgetInput: FinancialBudgetInput = {
      requestId: 'financial:budget:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: budgetFilters,
    }
    const budgetSummary: FinancialBudgetSummary = {
      currencyCode: 'EUR',
      budgetCount: 1,
      plannedTotal: 1200,
      spentTotal: 300,
      remainingTotal: 900,
    }
    const budgetOutput: FinancialBudgetOutput = {
      summary: budgetSummary,
      items: [
        {
          budgetId: 'budget-001',
          label: 'Operativo mensual',
          currencyCode: 'EUR',
          status: 'active',
          plannedAmount: 1200,
          spentAmount: 300,
          remainingAmount: 900,
        },
      ],
    }
    const budgetResult: FinancialBudgetResult = {
      kind: 'success',
      output: budgetOutput,
    }

    const goalFilters: FinancialGoalFilters = {
      currencyCode: 'EUR',
      statuses: ['active', 'achieved'],
      priorities: ['high'],
      goalIds: ['goal-001'],
    }
    const goalInput: FinancialGoalInput = {
      requestId: 'financial:goals:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: goalFilters,
    }
    const goalSummary: FinancialGoalSummary = {
      currencyCode: 'EUR',
      goalCount: 1,
      activeCount: 1,
      achievedCount: 0,
      totalTargetAmount: 5000,
      totalAchievedAmount: 1250,
      averageProgressPercentage: 25,
    }
    const goalOutput: FinancialGoalOutput = {
      summary: goalSummary,
      items: [
        {
          goalId: 'goal-001',
          label: 'Fondo de reserva',
          currencyCode: 'EUR',
          status: 'active',
          priority: 'high',
          targetAmount: 5000,
          achievedAmount: 1250,
          progressPercentage: 25,
        },
      ],
    }
    const goalResult: FinancialGoalResult = {
      kind: 'success',
      output: goalOutput,
    }

    const investmentFilters: FinancialInvestmentFilters = {
      currencyCode: 'EUR',
      statuses: ['active'],
      assetClasses: ['equity', 'fund'],
      investmentIds: ['inv-001'],
    }
    const investmentInput: FinancialInvestmentInput = {
      requestId: 'financial:investments:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      filters: investmentFilters,
    }
    const investmentSummary: FinancialInvestmentSummary = {
      currencyCode: 'EUR',
      investmentCount: 1,
      investedTotal: 3000,
      currentValueTotal: 3450,
      gainLossTotal: 450,
      gainLossPercentage: 15,
    }
    const investmentOutput: FinancialInvestmentOutput = {
      summary: investmentSummary,
      items: [
        {
          investmentId: 'inv-001',
          label: 'ETF global',
          currencyCode: 'EUR',
          status: 'active',
          assetClass: 'fund',
          investedAmount: 3000,
          currentValue: 3450,
          gainLossAmount: 450,
          gainLossPercentage: 15,
        },
      ],
    }
    const investmentResult: FinancialInvestmentResult = {
      kind: 'success',
      output: investmentOutput,
    }

    const reportFilters: FinancialReportFilters = {
      currencyCode: 'EUR',
      kind: 'balance',
      sections: ['summary'],
    }
    const reportInput: FinancialReportInput = {
      requestId: 'financial:reports:001',
      requestedAt: '2026-07-24T10:00:00.000Z',
      format: 'json',
      filters: reportFilters,
    }
    const reportSummary: FinancialReportSummary = {
      currencyCode: 'EUR',
      sectionCount: 1,
      rowCount: 1,
      reportTitle: 'Balance mensual',
    }
    const reportOutput: FinancialReportOutput = {
      reportId: 'report-001',
      generatedAt: '2026-07-24T10:00:00.000Z',
      format: 'json',
      summary: reportSummary,
      sections: [
        {
          sectionId: 'summary',
          title: 'Resumen',
          rows: [
            {
              label: 'Ingresos',
              value: 1000,
            },
          ],
        },
      ],
    }
    const reportResult: FinancialReportResult = {
      kind: 'success',
      output: reportOutput,
    }

    expect(balanceInput.requestId).toBe('financial:balance:001')
    expect(balanceOutput.summary.netBalance).toBe(800)
    expect(balanceResult.kind).toBe('success')

    expect(transactionInput.limit).toBe(25)
    expect(transactionOutput.items).toHaveLength(1)
    expect(transactionResult.kind).toBe('success')

    expect(budgetInput.filters?.budgetIds).toEqual(['budget-001'])
    expect(budgetOutput.summary.remainingTotal).toBe(900)
    expect(budgetResult.kind).toBe('success')

    expect(goalInput.filters?.priorities).toEqual(['high'])
    expect(goalOutput.summary.averageProgressPercentage).toBe(25)
    expect(goalResult.kind).toBe('success')

    expect(investmentInput.filters?.assetClasses).toEqual(['equity', 'fund'])
    expect(investmentOutput.summary.gainLossTotal).toBe(450)
    expect(investmentResult.kind).toBe('success')

    expect(reportInput.format).toBe('json')
    expect(reportOutput.sections).toHaveLength(1)
    expect(reportResult.kind).toBe('success')

    const balanceFiltersFromLeaf: BalanceFiltersFromLeaf = balanceFilters
    const balanceInputFromLeaf: BalanceInputFromLeaf = balanceInput
    const balanceOutputFromLeaf: BalanceOutputFromLeaf = balanceOutput
    const balanceResultFromLeaf: BalanceResultFromLeaf = balanceResult
    const balanceSummaryFromLeaf: BalanceSummaryFromLeaf = balanceSummary

    const transactionFiltersFromLeaf: TransactionFiltersFromLeaf = transactionFilters
    const transactionInputFromLeaf: TransactionInputFromLeaf = transactionInput
    const transactionOutputFromLeaf: TransactionOutputFromLeaf = transactionOutput
    const transactionResultFromLeaf: TransactionResultFromLeaf = transactionResult
    const transactionSummaryFromLeaf: TransactionSummaryFromLeaf = transactionSummary

    const budgetFiltersFromLeaf: BudgetFiltersFromLeaf = budgetFilters
    const budgetInputFromLeaf: BudgetInputFromLeaf = budgetInput
    const budgetOutputFromLeaf: BudgetOutputFromLeaf = budgetOutput
    const budgetResultFromLeaf: BudgetResultFromLeaf = budgetResult
    const budgetSummaryFromLeaf: BudgetSummaryFromLeaf = budgetSummary

    const goalFiltersFromLeaf: GoalFiltersFromLeaf = goalFilters
    const goalInputFromLeaf: GoalInputFromLeaf = goalInput
    const goalOutputFromLeaf: GoalOutputFromLeaf = goalOutput
    const goalResultFromLeaf: GoalResultFromLeaf = goalResult
    const goalSummaryFromLeaf: GoalSummaryFromLeaf = goalSummary

    const investmentFiltersFromLeaf: InvestmentFiltersFromLeaf = investmentFilters
    const investmentInputFromLeaf: InvestmentInputFromLeaf = investmentInput
    const investmentOutputFromLeaf: InvestmentOutputFromLeaf = investmentOutput
    const investmentResultFromLeaf: InvestmentResultFromLeaf = investmentResult
    const investmentSummaryFromLeaf: InvestmentSummaryFromLeaf = investmentSummary

    const reportFiltersFromLeaf: ReportFiltersFromLeaf = reportFilters
    const reportInputFromLeaf: ReportInputFromLeaf = reportInput
    const reportOutputFromLeaf: ReportOutputFromLeaf = reportOutput
    const reportResultFromLeaf: ReportResultFromLeaf = reportResult
    const reportSummaryFromLeaf: ReportSummaryFromLeaf = reportSummary

    void balanceFiltersFromLeaf
    void balanceInputFromLeaf
    void balanceOutputFromLeaf
    void balanceResultFromLeaf
    void balanceSummaryFromLeaf
    void transactionFiltersFromLeaf
    void transactionInputFromLeaf
    void transactionOutputFromLeaf
    void transactionResultFromLeaf
    void transactionSummaryFromLeaf
    void budgetFiltersFromLeaf
    void budgetInputFromLeaf
    void budgetOutputFromLeaf
    void budgetResultFromLeaf
    void budgetSummaryFromLeaf
    void goalFiltersFromLeaf
    void goalInputFromLeaf
    void goalOutputFromLeaf
    void goalResultFromLeaf
    void goalSummaryFromLeaf
    void investmentFiltersFromLeaf
    void investmentInputFromLeaf
    void investmentOutputFromLeaf
    void investmentResultFromLeaf
    void investmentSummaryFromLeaf
    void reportFiltersFromLeaf
    void reportInputFromLeaf
    void reportOutputFromLeaf
    void reportResultFromLeaf
    void reportSummaryFromLeaf
  })

  it('centralizes public exports in the barrel without circular imports', () => {
    const barrelSource = readFinancialSource('index.ts')
    const expectedExports = [
      "export * from './balanceContracts'",
      "export * from './balanceTool'",
      "export * from './transactionsContracts'",
      "export * from './transactionsTool'",
      "export * from './budgetContracts'",
      "export * from './budgetTool'",
      "export * from './goalsContracts'",
      "export * from './goalsTool'",
      "export * from './investmentsContracts'",
      "export * from './reportsContracts'",
      "export * from './reportsTool'",
      "export * from './insightsTool'",
      "export * from './financialToolsCatalog'",
    ]

    for (const line of expectedExports) {
      expect(barrelSource).toContain(line)
    }

    for (const fileName of leafFiles) {
      const source = readFinancialSource(fileName)
      expect(source).not.toMatch(/\bimport\b/)
      expect(source).not.toContain("from './index'")
      expect(source).not.toContain("from '../financial'")
    }
  })

  it('keeps the contract files serializable and structurally consistent', () => {
    const balanceSource = readFinancialSource('balanceContracts.ts')
    const transactionSource = readFinancialSource('transactionsContracts.ts')
    const budgetSource = readFinancialSource('budgetContracts.ts')
    const goalSource = readFinancialSource('goalsContracts.ts')
    const investmentSource = readFinancialSource('investmentsContracts.ts')
    const reportSource = readFinancialSource('reportsContracts.ts')

    expect(balanceSource).toContain('export interface FinancialBalanceInput')
    expect(balanceSource).toContain('export type FinancialBalanceResult')
    expect(transactionSource).toContain('export interface FinancialTransactionInput')
    expect(transactionSource).toContain('export type FinancialTransactionResult')
    expect(budgetSource).toContain('export interface FinancialBudgetInput')
    expect(budgetSource).toContain('export type FinancialBudgetResult')
    expect(goalSource).toContain('export interface FinancialGoalInput')
    expect(goalSource).toContain('export type FinancialGoalResult')
    expect(investmentSource).toContain('export interface FinancialInvestmentInput')
    expect(investmentSource).toContain('export type FinancialInvestmentResult')
    expect(reportSource).toContain('export interface FinancialReportInput')
    expect(reportSource).toContain('export type FinancialReportResult')

    expect(balanceSource).not.toContain('class ')
    expect(transactionSource).not.toContain('class ')
    expect(budgetSource).not.toContain('class ')
    expect(goalSource).not.toContain('class ')
    expect(investmentSource).not.toContain('class ')
    expect(reportSource).not.toContain('class ')
  })
})

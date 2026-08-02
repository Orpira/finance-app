import type { CurrencyCode } from '../../types/settings'

/**
 * Máquina de estados de una propuesta del Asistente. `draft` existe mientras
 * el Proposal Editor tiene cambios sin aplicar; `awaiting_confirmation` es el
 * estado inicial mostrado al usuario; `executing`/`completed`/`failed` solo
 * se alcanzan después de `confirmed` — nunca antes. El motor financiero es
 * quien decide `completed` vs `failed` (ver assistantExecutionGuard.ts /
 * assistantExecutionService.ts), nunca la IA.
 */
export const ASSISTANT_PROPOSAL_STATUSES = [
  'draft',
  'awaiting_confirmation',
  'confirmed',
  'executing',
  'completed',
  'cancelled',
  'failed',
] as const

export type AssistantProposalStatus = (typeof ASSISTANT_PROPOSAL_STATUSES)[number]

export const ASSISTANT_PROPOSAL_KINDS = [
  'register_income',
  'register_expense',
  'create_appointment',
  'mark_income_reported',
  'generate_report',
  'create_financial_goal',
] as const

export type AssistantProposalKind = (typeof ASSISTANT_PROPOSAL_KINDS)[number]

export interface IncomeProposalFields {
  readonly amount: number | null
  readonly currency: CurrencyCode | null
  readonly date: string | null
  readonly description: string | null
}

export interface ExpenseProposalFields {
  readonly amount: number | null
  readonly currency: CurrencyCode | null
  readonly date: string | null
  readonly category: string | null
}

export interface AppointmentProposalFields {
  readonly date: string | null
  readonly time: string | null
  readonly durationMinutes: number | null
  readonly expectedAmount: number | null
  readonly currency: CurrencyCode | null
}

export interface MarkIncomeReportedProposalFields {
  readonly incomeId: number | null
  readonly date: string | null
  readonly amount: number | null
  readonly currency: CurrencyCode | null
  readonly category: string | null
  readonly currentStatus: string | null
}

export interface GenerateReportProposalFields {
  readonly periodStart: string | null
  readonly periodEnd: string | null
  readonly format: 'pdf' | null
  readonly includedData: string
}

export interface FinancialGoalProposalFields {
  readonly goalType: 'saving' | 'expense_limit' | 'income_target' | null
  readonly name: string | null
  readonly targetAmount: number | null
  readonly currency: CurrencyCode | null
  readonly period: 'monthly'
  readonly startDate: string | null
  readonly endDate: string | null
}

export type AssistantProposalFields =
  | IncomeProposalFields
  | ExpenseProposalFields
  | AppointmentProposalFields
  | MarkIncomeReportedProposalFields
  | GenerateReportProposalFields
  | FinancialGoalProposalFields

interface AssistantProposalBase {
  readonly proposalId: string
  readonly status: AssistantProposalStatus
  readonly createdAt: string
  readonly sourceText: string
  readonly missingRequiredFields: readonly string[]
  readonly failureReason?: string
  readonly executedRecordId?: number | string
}

export interface IncomeProposal extends AssistantProposalBase {
  readonly kind: 'register_income'
  readonly fields: IncomeProposalFields
}

export interface ExpenseProposal extends AssistantProposalBase {
  readonly kind: 'register_expense'
  readonly fields: ExpenseProposalFields
}

export interface AppointmentProposal extends AssistantProposalBase {
  readonly kind: 'create_appointment'
  readonly fields: AppointmentProposalFields
}

export interface MarkIncomeReportedProposal extends AssistantProposalBase {
  readonly kind: 'mark_income_reported'
  readonly fields: MarkIncomeReportedProposalFields
}

export interface GenerateReportProposal extends AssistantProposalBase {
  readonly kind: 'generate_report'
  readonly fields: GenerateReportProposalFields
}

export interface FinancialGoalProposal extends AssistantProposalBase {
  readonly kind: 'create_financial_goal'
  readonly fields: FinancialGoalProposalFields
}

export type AssistantProposalRecord =
  | IncomeProposal
  | ExpenseProposal
  | AppointmentProposal
  | MarkIncomeReportedProposal
  | GenerateReportProposal
  | FinancialGoalProposal

export function isProposalReadyToConfirm(proposal: AssistantProposalRecord): boolean {
  return proposal.missingRequiredFields.length === 0
}

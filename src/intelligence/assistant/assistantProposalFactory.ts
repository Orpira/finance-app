import type { CurrencyCode } from '../../types/settings'
import type { ParsedAssistantIntent } from './assistantIntentParser'
import type {
  AppointmentProposal,
  AssistantProposalRecord,
  ExpenseProposal,
  IncomeProposal,
} from './assistantProposalContracts'

let sequence = 0

function createProposalId(kind: string): string {
  sequence += 1
  return `assistant-proposal:${kind}:${Date.now()}:${sequence}`
}

/**
 * Nunca inventa cantidades, fechas ni monedas: un campo requerido ausente
 * queda en `null` en `fields` y listado en `missingRequiredFields`, para que
 * el Proposal Editor lo resalte y el usuario lo complete antes de confirmar
 * (regla de producto: "la IA no debe inventar cantidades ni fechas").
 */
export function createProposalFromParsedIntent(
  parsed: ParsedAssistantIntent,
  context: { readonly defaultCurrency: CurrencyCode; readonly now?: string },
): AssistantProposalRecord | null {
  if (parsed.kind === 'none') return null

  const createdAt = context.now ?? new Date().toISOString()

  if (parsed.kind === 'register_income') {
    const currency = parsed.fields.currency ?? context.defaultCurrency
    const missing: string[] = []
    if (parsed.fields.amount === null) missing.push('amount')
    if (parsed.fields.date === null) missing.push('date')

    const proposal: IncomeProposal = {
      proposalId: createProposalId('register_income'),
      kind: 'register_income',
      status: 'awaiting_confirmation',
      createdAt,
      sourceText: parsed.sourceText,
      missingRequiredFields: missing,
      fields: { ...parsed.fields, currency },
    }
    return proposal
  }

  if (parsed.kind === 'register_expense') {
    const currency = parsed.fields.currency ?? context.defaultCurrency
    const missing: string[] = []
    if (parsed.fields.amount === null) missing.push('amount')
    if (parsed.fields.date === null) missing.push('date')
    if (parsed.fields.category === null) missing.push('category')

    const proposal: ExpenseProposal = {
      proposalId: createProposalId('register_expense'),
      kind: 'register_expense',
      status: 'awaiting_confirmation',
      createdAt,
      sourceText: parsed.sourceText,
      missingRequiredFields: missing,
      fields: { ...parsed.fields, currency },
    }
    return proposal
  }

  const currency = parsed.fields.currency ?? context.defaultCurrency
  const missing: string[] = []
  if (parsed.fields.date === null) missing.push('date')
  if (parsed.fields.time === null) missing.push('time')
  if (parsed.fields.expectedAmount === null) missing.push('expectedAmount')

  const proposal: AppointmentProposal = {
    proposalId: createProposalId('create_appointment'),
    kind: 'create_appointment',
    status: 'awaiting_confirmation',
    createdAt,
    sourceText: parsed.sourceText,
    missingRequiredFields: missing,
    fields: { ...parsed.fields, currency },
  }
  return proposal
}

export function applyProposalEdits(
  proposal: AssistantProposalRecord,
  edits: Readonly<Record<string, string | number | null>>,
): AssistantProposalRecord {
  const nextFields = { ...proposal.fields, ...edits } as typeof proposal.fields

  const missing = Object.entries(nextFields)
    .filter(([, value]) => value === null || value === '')
    .map(([key]) => key)
    .filter((key) => isRequiredField(proposal.kind, key))

  return {
    ...proposal,
    fields: nextFields,
    missingRequiredFields: missing,
    status: 'awaiting_confirmation',
  } as AssistantProposalRecord
}

function isRequiredField(kind: AssistantProposalRecord['kind'], field: string): boolean {
  if (kind === 'register_income') return field === 'amount' || field === 'date'
  if (kind === 'register_expense') return field === 'amount' || field === 'date' || field === 'category'
  return field === 'date' || field === 'time' || field === 'expectedAmount'
}

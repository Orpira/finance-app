import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { AssistantProposalRecord } from '../src/intelligence/assistant'
import { AssistantProposalCard } from '../src/pages/Conversation/AssistantProposalCard'

function createIncomeProposal(amount: number | null): AssistantProposalRecord {
  return {
    proposalId: 'assistant-proposal:register_income:test',
    kind: 'register_income',
    status: 'awaiting_confirmation',
    createdAt: '2026-08-22T10:00:00.000Z',
    sourceText: 'Registrar un ingreso',
    missingRequiredFields: amount === null ? ['amount'] : [],
    fields: {
      amount,
      currency: 'EUR',
      date: '2026-08-22',
      description: null,
    },
  }
}

describe('AssistantProposalCard', () => {
  it('bloquea Confirmar mientras falta un campo requerido', () => {
    const markup = renderToStaticMarkup(
      <AssistantProposalCard
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        proposal={createIncomeProposal(null)}
      />,
    )

    expect(markup).toMatch(/disabled=""[^>]*>Confirmar<\/button>/)
  })

  it('habilita Confirmar cuando la propuesta está completa', () => {
    const markup = renderToStaticMarkup(
      <AssistantProposalCard
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        proposal={createIncomeProposal(120)}
      />,
    )

    expect(markup).not.toMatch(/disabled=""[^>]*>Confirmar<\/button>/)
  })
})

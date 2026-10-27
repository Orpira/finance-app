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

  it('ofrece Reintentar tras un fallo recuperable sin presentarlo como guardado', () => {
    const markup = renderToStaticMarkup(
      <AssistantProposalCard
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        proposal={{ ...createIncomeProposal(120), status: 'failed', failureReason: 'No se registró el movimiento.' }}
      />,
    )

    expect(markup).toContain('No se pudo guardar')
    expect(markup).toContain('No se registró el movimiento.')
    expect(markup).toMatch(/>Reintentar<\/button>/)
    expect(markup).toMatch(/>Descartar<\/button>/)
    expect(markup).not.toContain('>Guardado<')
  })

  it('no ofrece Reintentar en acciones fallidas sin idempotencia', () => {
    const markup = renderToStaticMarkup(
      <AssistantProposalCard
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        proposal={{
          proposalId: 'assistant-proposal:create_appointment:test',
          kind: 'create_appointment',
          status: 'failed',
          failureReason: 'Fallo',
          createdAt: '2026-08-22T10:00:00.000Z',
          sourceText: 'Cita',
          missingRequiredFields: [],
          fields: { date: '2026-08-22', time: '10:00', durationMinutes: 60, expectedAmount: 80, currency: 'EUR' },
        } as AssistantProposalRecord}
      />,
    )

    expect(markup).not.toContain('Reintentar')
  })

  it('muestra la estancia y el destino puntual asociados sin hacerlos editables', () => {
    const proposal = createIncomeProposal(120)
    const markup = renderToStaticMarkup(
      <AssistantProposalCard
        disabled={false}
        onCancel={() => undefined}
        onConfirm={() => undefined}
        proposal={{
          ...proposal,
          fields: {
            ...proposal.fields,
            seasonStayId: 7,
            travelDestination: { kind: 'place', label: 'Feria', city: 'Sevilla', countryCode: 'ES', source: 'manual' },
          },
        } as AssistantProposalRecord}
      />,
    )

    expect(markup).toContain('Estancia')
    expect(markup).toContain('Destino puntual')
    expect(markup).toContain('Feria, Sevilla, España')
    expect(markup).not.toContain('seasonStayId')
  })
})

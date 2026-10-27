import { describe, expect, it } from 'vitest'

import { createAssistantProposalId } from './assistantProposalId'

describe('createAssistantProposalId', () => {
  it('genera IDs distintos para el mismo tipo y el mismo milisegundo', () => {
    const ids = Array.from({ length: 1_000 }, () =>
      createAssistantProposalId('register_income', 1_700_000_000_000))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('mantiene el tipo en IDs distintos de propuestas diferentes', () => {
    const income = createAssistantProposalId('register_income', 1_700_000_000_000)
    const expense = createAssistantProposalId('register_expense', 1_700_000_000_000)
    expect(income).not.toBe(expense)
    expect(income).toContain(':register_income:')
    expect(expense).toContain(':register_expense:')
  })
})

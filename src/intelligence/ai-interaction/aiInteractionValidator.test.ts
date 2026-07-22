import { describe, expect, it } from 'vitest'
import type { AIInteraction } from './aiInteractionContracts'
import { validateAIInteraction } from './aiInteractionValidator'

const validInteraction: AIInteraction = {
  protocolVersion: 1,
  interactionId: 'interaction-1',
  intent: 'EXPLAIN_INSIGHT',
  requiredCapabilities: ['TEXT_GENERATION', 'CONTEXT_GROUNDING'],
  policy: {
    policyId: 'interaction-policy',
    policyVersion: '1.0.0',
    purpose: 'EXPLAIN_INSIGHT',
    processingMode: 'LOCAL_ONLY',
  },
  status: 'CREATED',
  metadata: {
    createdAt: '2026-07-22T00:00:00.000Z',
    source: 'APPLICATION',
  },
}

describe('validateAIInteraction', () => {
  it('accepts a complete provider-neutral interaction', () => {
    expect(validateAIInteraction(validInteraction)).toBeNull()
  })

  it('fails closed when capabilities are missing', () => {
    const result = validateAIInteraction({
      ...validInteraction,
      requiredCapabilities: [],
    })

    expect(result?.code).toBe('INVALID_INTERACTION')
    expect(result?.retryable).toBe(false)
  })

  it('rejects duplicate capabilities deterministically', () => {
    const result = validateAIInteraction({
      ...validInteraction,
      requiredCapabilities: ['TEXT_GENERATION', 'TEXT_GENERATION'],
    })

    expect(result?.code).toBe('INVALID_INTERACTION')
  })
})

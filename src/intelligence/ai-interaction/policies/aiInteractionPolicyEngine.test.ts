import { describe, expect, it } from 'vitest'
import type { AIInteraction } from '../aiInteractionContracts'
import { AIInteractionPolicyEngine } from './aiInteractionPolicyEngine'
import { AIInteractionPolicyRegistry } from './aiInteractionPolicyRegistry'
import {
  DEFAULT_AI_INTERACTION_POLICIES,
  DEFAULT_FINANCIAL_EXPLANATION_POLICY,
} from './defaultPolicies'

function interaction(
  overrides: Partial<AIInteraction> = {},
): AIInteraction {
  return {
    protocolVersion: 1,
    interactionId: 'interaction-1',
    intent: 'EXPLAIN_INSIGHT',
    requiredCapabilities: ['TEXT_GENERATION', 'CONTEXT_GROUNDING'],
    policy: {
      policyId: 'financial-explanation',
      policyVersion: '1.0.0',
      purpose: 'EXPLAIN_INSIGHT',
      processingMode: 'LOCAL_ONLY',
    },
    status: 'CREATED',
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
    ...overrides,
  }
}

const authorizedContext = {
  hasAuthorizedContext: true,
  hasUserConfirmation: false,
  containsSensitiveData: false,
  redactionApplied: false,
} as const

describe('AIInteractionPolicyEngine', () => {
  it('allows a valid interaction when all policy requirements are satisfied', () => {
    const registry = new AIInteractionPolicyRegistry(DEFAULT_AI_INTERACTION_POLICIES)
    const engine = new AIInteractionPolicyEngine(registry)

    expect(engine.evaluate(interaction(), authorizedContext).kind).toBe('ALLOW')
  })

  it('fails closed when the referenced policy does not exist', () => {
    const registry = new AIInteractionPolicyRegistry()
    const engine = new AIInteractionPolicyEngine(registry)

    expect(engine.evaluate(interaction(), authorizedContext)).toMatchObject({
      kind: 'DENY',
      reasonCodes: ['POLICY_NOT_FOUND'],
    })
  })

  it('requires authorized context when the policy declares it', () => {
    const registry = new AIInteractionPolicyRegistry([
      DEFAULT_FINANCIAL_EXPLANATION_POLICY,
    ])
    const engine = new AIInteractionPolicyEngine(registry)

    expect(
      engine.evaluate(interaction(), {
        ...authorizedContext,
        hasAuthorizedContext: false,
      }),
    ).toMatchObject({
      kind: 'REQUIRE_CONTEXT',
      reasonCodes: ['CONTEXT_REQUIRED'],
    })
  })

  it('requires redaction before sensitive data can proceed', () => {
    const registry = new AIInteractionPolicyRegistry([
      DEFAULT_FINANCIAL_EXPLANATION_POLICY,
    ])
    const engine = new AIInteractionPolicyEngine(registry)

    expect(
      engine.evaluate(interaction(), {
        ...authorizedContext,
        containsSensitiveData: true,
      }),
    ).toMatchObject({
      kind: 'REQUIRE_REDACTION',
      reasonCodes: ['REDACTION_REQUIRED'],
    })
  })

  it('rejects purpose and intent mismatches', () => {
    const registry = new AIInteractionPolicyRegistry([
      DEFAULT_FINANCIAL_EXPLANATION_POLICY,
    ])
    const engine = new AIInteractionPolicyEngine(registry)

    expect(
      engine.evaluate(
        interaction({
          policy: {
            policyId: 'financial-explanation',
            policyVersion: '1.0.0',
            purpose: 'EDUCATIONAL_GUIDANCE',
            processingMode: 'LOCAL_ONLY',
          },
        }),
        authorizedContext,
      ),
    ).toMatchObject({ kind: 'DENY', reasonCodes: ['PURPOSE_MISMATCH'] })
  })

  it('does not permit duplicate registrations', () => {
    const registry = new AIInteractionPolicyRegistry([
      DEFAULT_FINANCIAL_EXPLANATION_POLICY,
    ])

    expect(() => registry.register(DEFAULT_FINANCIAL_EXPLANATION_POLICY)).toThrow(
      'already registered',
    )
  })
})

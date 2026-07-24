import type {
  ActivationDecision,
} from './activationContracts'
import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'
import type {
  FinancialConversationSkill,
  FinancialConversationSkillContext,
} from './financialConversationSkill'
import type {
  FinancialConversationSkillRegistry,
} from './financialConversationSkillRegistry'
import {
  validateFinancialConversationExecutionPlan,
} from './financialConversationValidator'

export interface FinancialConversationSkillResolverSuccess {
  readonly kind: 'success'
  readonly skill: FinancialConversationSkill
  readonly plan: FinancialConversationExecutionPlan
}

export interface FinancialConversationSkillResolverFailure {
  readonly kind: 'failure'
  readonly code: 'SKILL_NOT_FOUND' | 'INVALID_EXECUTION_PLAN'
  readonly retryable: false
  readonly safeMessage: string
}

export type FinancialConversationSkillResolverResult =
  | FinancialConversationSkillResolverSuccess
  | FinancialConversationSkillResolverFailure

export interface FinancialConversationSkillResolver {
  resolve(input: FinancialConversationSkillContext): FinancialConversationSkillResolverResult
}

function createFailure(
  code: FinancialConversationSkillResolverFailure['code'],
  safeMessage: string,
): FinancialConversationSkillResolverFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function hasCompatibleRequiredTools(
  activationDecision: ActivationDecision,
  requiredTools: readonly string[],
): boolean {
  if (!activationDecision.requiresTool) {
    return true
  }

  if (activationDecision.toolId === null) {
    return false
  }

  return requiredTools.includes(activationDecision.toolId)
}

export function createFinancialConversationSkillResolver(
  registry: FinancialConversationSkillRegistry,
): FinancialConversationSkillResolver {
  return {
    resolve(input: FinancialConversationSkillContext): FinancialConversationSkillResolverResult {
      const skill = registry.findFirstCompatible(input)
      if (skill === null) {
        return createFailure(
          'SKILL_NOT_FOUND',
          `No financial conversation skill can handle intent '${input.activationDecision.intent}'.`,
        )
      }

      const plan = skill.buildExecutionPlan(input)
      const validation = validateFinancialConversationExecutionPlan(plan)
      if (validation !== null) {
        return createFailure('INVALID_EXECUTION_PLAN', validation.safeMessage)
      }

      if (!hasCompatibleRequiredTools(input.activationDecision, plan.requiredTools)) {
        return createFailure(
          'INVALID_EXECUTION_PLAN',
          'The execution plan required tools are not compatible with the activation decision.',
        )
      }

      return {
        kind: 'success',
        skill,
        plan,
      }
    },
  }
}

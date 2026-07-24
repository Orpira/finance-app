import type {
  FinancialConversationExecutionPlan,
} from './financialConversationExecutionPlan'
import type {
  FinancialConversationSkill,
} from './financialConversationSkill'
import type {
  FinancialConversationSkillRegistry,
} from './financialConversationSkillRegistry'
import {
  ACTIVATION_TYPES,
} from './activationContracts'

export interface FinancialConversationValidationFailure {
  readonly kind: 'failure'
  readonly code:
    | 'INVALID_SKILL'
    | 'INVALID_SKILL_REGISTRY'
    | 'INVALID_EXECUTION_PLAN'
  readonly retryable: false
  readonly safeMessage: string
}

function createFailure(
  code: FinancialConversationValidationFailure['code'],
  safeMessage: string,
): FinancialConversationValidationFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateFinancialConversationSkill(
  skill: FinancialConversationSkill,
): FinancialConversationValidationFailure | null {
  if (
    !isNonEmptyString(skill.skillId)
    || !Array.isArray(skill.supportedIntents)
    || skill.supportedIntents.length === 0
    || !Array.isArray(skill.supportedTools)
    || skill.supportedTools.length === 0
    || typeof skill.canHandle !== 'function'
    || typeof skill.buildExecutionPlan !== 'function'
  ) {
    return createFailure('INVALID_SKILL', 'The financial conversation skill contract is invalid.')
  }

  if (skill.supportedIntents.some((intent) => !isNonEmptyString(intent))) {
    return createFailure('INVALID_SKILL', 'The skill contains an invalid supported intent.')
  }

  if (skill.supportedTools.some((tool) => !isNonEmptyString(tool))) {
    return createFailure('INVALID_SKILL', 'The skill contains an invalid supported tool.')
  }

  return null
}

export function validateFinancialConversationSkillRegistry(
  registry: FinancialConversationSkillRegistry,
): FinancialConversationValidationFailure | null {
  if (
    typeof registry.register !== 'function'
    || typeof registry.list !== 'function'
    || typeof registry.findById !== 'function'
    || typeof registry.findFirstCompatible !== 'function'
  ) {
    return createFailure('INVALID_SKILL_REGISTRY', 'The financial conversation skill registry is invalid.')
  }

  const skills = registry.list()
  if (!Array.isArray(skills) || skills.length === 0) {
    return createFailure('INVALID_SKILL_REGISTRY', 'The skill registry must contain at least one skill.')
  }

  const seen = new Set<string>()
  for (const skill of skills) {
    const skillValidation = validateFinancialConversationSkill(skill)
    if (skillValidation !== null) {
      return skillValidation
    }

    const normalized = skill.skillId.trim().toLowerCase()
    if (seen.has(normalized)) {
      return createFailure('INVALID_SKILL_REGISTRY', `Duplicated skillId '${skill.skillId}'.`)
    }

    seen.add(normalized)
  }

  return null
}

export function validateFinancialConversationExecutionPlan(
  plan: FinancialConversationExecutionPlan,
): FinancialConversationValidationFailure | null {
  if (
    !isNonEmptyString(plan.skillId)
    || !Array.isArray(plan.requiredTools)
    || plan.requiredTools.some((tool) => !isNonEmptyString(tool))
    || typeof plan.requiresAIExplanation !== 'boolean'
    || !isNonEmptyString(plan.expectedOutput)
    || !['HIGH', 'NORMAL', 'LOW'].includes(plan.executionPriority)
    || plan.activationDecision.protocolVersion !== 1
    || !ACTIVATION_TYPES.includes(plan.activationDecision.activationType)
  ) {
    return createFailure('INVALID_EXECUTION_PLAN', 'The financial conversation execution plan is invalid.')
  }

  return null
}

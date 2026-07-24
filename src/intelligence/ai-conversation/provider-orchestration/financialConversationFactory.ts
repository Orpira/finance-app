import type {
  FinancialConversationSkill,
} from './financialConversationSkill'
import {
  createFinancialConversationSkillRegistryStore,
  type FinancialConversationSkillRegistry,
} from './financialConversationSkillRegistry'
import {
  createFinancialConversationSkillResolver,
  type FinancialConversationSkillResolver,
} from './financialConversationSkillResolver'
import {
  validateFinancialConversationSkillRegistry,
} from './financialConversationValidator'
import {
  createBalanceConversationSkill,
} from './skills/balanceConversationSkill'
import {
  createTransactionsConversationSkill,
} from './skills/transactionsConversationSkill'
import {
  createBudgetConversationSkill,
} from './skills/budgetConversationSkill'
import {
  createGoalsConversationSkill,
} from './skills/goalsConversationSkill'
import {
  createReportsConversationSkill,
} from './skills/reportsConversationSkill'
import {
  createInsightsConversationSkill,
} from './skills/insightsConversationSkill'

export interface FinancialConversationSkillModule {
  readonly registry: FinancialConversationSkillRegistry
  readonly resolver: FinancialConversationSkillResolver
}

export function createDefaultFinancialConversationSkills(): readonly FinancialConversationSkill[] {
  return [
    createBalanceConversationSkill(),
    createTransactionsConversationSkill(),
    createBudgetConversationSkill(),
    createGoalsConversationSkill(),
    createReportsConversationSkill(),
    createInsightsConversationSkill(),
  ]
}

export function createFinancialConversationSkillModule(
  skills: readonly FinancialConversationSkill[] = createDefaultFinancialConversationSkills(),
): FinancialConversationSkillModule {
  const registry = createFinancialConversationSkillRegistryStore(skills)
  const registryValidation = validateFinancialConversationSkillRegistry(registry)
  if (registryValidation !== null) {
    throw new Error(registryValidation.safeMessage)
  }

  const resolver = createFinancialConversationSkillResolver(registry)

  return {
    registry,
    resolver,
  }
}

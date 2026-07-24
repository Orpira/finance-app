import type {
  FinancialConversationSkill,
  FinancialConversationSkillContext,
} from './financialConversationSkill'

export interface FinancialConversationSkillRegistry {
  register(skill: FinancialConversationSkill): void
  list(): readonly FinancialConversationSkill[]
  findById(skillId: string): FinancialConversationSkill | null
  findFirstCompatible(input: FinancialConversationSkillContext): FinancialConversationSkill | null
}

export function createFinancialConversationSkillRegistryStore(
  skills: readonly FinancialConversationSkill[] = [],
): FinancialConversationSkillRegistry {
  const registry = new Map<string, FinancialConversationSkill>()

  for (const skill of skills) {
    registry.set(skill.skillId, skill)
  }

  return {
    register(skill) {
      registry.set(skill.skillId, skill)
    },

    list() {
      return [...registry.values()]
    },

    findById(skillId) {
      return registry.get(skillId) ?? null
    },

    findFirstCompatible(input) {
      for (const skill of registry.values()) {
        if (skill.canHandle(input)) {
          return skill
        }
      }

      return null
    },
  }
}

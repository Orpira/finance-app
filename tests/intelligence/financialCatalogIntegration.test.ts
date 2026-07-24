import { describe, expect, it } from 'vitest'

import {
  createAIToolRegistry,
} from '../../src/intelligence/ai-tools'
import {
  createFinancialToolsCatalog,
  registerFinancialToolsCatalog,
} from '../../src/intelligence/ai-tools/financial'

describe('financial tools catalog integration', () => {
  it('builds a catalog with all certified financial tools', () => {
    const catalog = createFinancialToolsCatalog()
    const names = catalog.map((tool) => tool.definition.name)

    expect(names).toEqual([
      'financial_balance',
      'financial_transactions',
      'financial_budget',
      'financial_goals',
      'financial_reports',
      'financial_insights',
    ])
    expect(new Set(names).size).toBe(names.length)
  })

  it('registers all financial tools in the existing registry and resolves each one', () => {
    const registry = createAIToolRegistry()
    const registration = registerFinancialToolsCatalog(registry)

    expect(registration.kind).toBe('success')
    if (registration.kind !== 'success') {
      throw new Error('expected successful financial catalog registration')
    }

    expect(registration.toolNames).toEqual([
      'financial_balance',
      'financial_transactions',
      'financial_budget',
      'financial_goals',
      'financial_reports',
      'financial_insights',
    ])

    const definitions = registry.listDefinitions()
    expect(definitions).toHaveLength(6)

    for (const name of registration.toolNames) {
      const resolved = registry.resolve(name)
      expect(resolved.kind).toBe('success')
    }
  })

  it('fails closed when any catalog tool name is already registered and avoids partial registration', () => {
    const registry = createAIToolRegistry()
    const first = registerFinancialToolsCatalog(registry)
    expect(first.kind).toBe('success')

    const beforeSecondAttempt = registry.listDefinitions().map((item) => item.name)
    const second = registerFinancialToolsCatalog(registry)

    expect(second.kind).toBe('failure')
    if (second.kind !== 'failure') {
      throw new Error('expected duplicate registration failure')
    }

    expect(second.code).toBe('TOOL_ALREADY_REGISTERED')
    expect(registry.listDefinitions().map((item) => item.name)).toEqual(beforeSecondAttempt)
  })

  it('keeps contract consistency for all catalog tools', () => {
    const catalog = createFinancialToolsCatalog()

    for (const tool of catalog) {
      expect(tool.definition.permission).toBe('read-only')
      expect(tool.definition.deterministic).toBe(true)
      expect(tool.definition.failClosed).toBe(true)
      expect(tool.definition.name.startsWith('financial_')).toBe(true)
    }
  })
})

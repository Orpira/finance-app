import { describe, expect, it } from 'vitest'

import {
  createAIToolRegistry,
  createAIToolResolver,
  createPingTool,
  validateAIToolResolverCatalog,
} from '../src/intelligence/ai-tools'
import {
  createFinancialAIToolResolver,
  createFinancialToolsCatalog,
  registerFinancialToolsCatalog,
} from '../src/intelligence/ai-tools/financial'

describe('AI Tool Resolver (PB-IS-013.1)', () => {
  it('resolves a registered tool from the certified financial catalog', () => {
    const registry = createAIToolRegistry()
    const registration = registerFinancialToolsCatalog(registry)
    expect(registration.kind).toBe('success')

    const resolver = createFinancialAIToolResolver({ registry })
    const resolved = resolver.resolve('financial_reports')

    expect(resolved.kind).toBe('success')
    if (resolved.kind !== 'success') {
      throw new Error('Expected financial_reports to resolve')
    }

    expect(resolved.tool.definition.name).toBe('financial_reports')
    expect(resolver.exists('financial_reports')).toBe(true)
  })

  it('returns controlled error when the tool does not exist in catalog', () => {
    const registry = createAIToolRegistry()
    const registration = registerFinancialToolsCatalog(registry)
    expect(registration.kind).toBe('success')

    const resolver = createFinancialAIToolResolver({ registry })
    const resolved = resolver.resolve('financial_missing')

    expect(resolved.kind).toBe('failure')
    if (resolved.kind !== 'failure') {
      throw new Error('Expected not found failure')
    }

    expect(resolved.code).toBe('TOOL_NOT_FOUND')
    expect(resolver.exists('financial_missing')).toBe(false)
  })

  it('returns consistent resolution on repeated calls', () => {
    const registry = createAIToolRegistry()
    const registration = registerFinancialToolsCatalog(registry)
    expect(registration.kind).toBe('success')

    const resolver = createFinancialAIToolResolver({ registry })
    const first = resolver.resolve('financial_balance')
    const second = resolver.resolve('financial_balance')

    expect(first.kind).toBe('success')
    expect(second.kind).toBe('success')

    if (first.kind === 'success' && second.kind === 'success') {
      expect(first.tool).toBe(second.tool)
      expect(first.tool.definition.name).toBe('financial_balance')
    }
  })

  it('validates catalog integrity and uniqueness before creating resolver', () => {
    const registry = createAIToolRegistry([createPingTool()])
    const duplicateCatalog = [createPingTool(), createPingTool()] as const

    const validation = validateAIToolResolverCatalog({
      registry,
      catalog: duplicateCatalog,
    })

    expect(validation.kind).toBe('failure')
    if (validation.kind === 'failure') {
      expect(validation.code).toBe('TOOL_ALREADY_REGISTERED')
    }

    expect(() => {
      createAIToolResolver({
        registry,
        catalog: duplicateCatalog,
      })
    }).toThrowError(/duplicated tool id/i)
  })

  it('lists only certified catalog definitions and keeps export visibility', async () => {
    const registry = createAIToolRegistry()
    const registration = registerFinancialToolsCatalog(registry)
    expect(registration.kind).toBe('success')

    const resolver = createFinancialAIToolResolver({ registry })
    const definitions = resolver.listDefinitions().map((definition) => definition.name)

    expect(definitions).toEqual([
      'financial_balance',
      'financial_transactions',
      'financial_budget',
      'financial_goals',
      'financial_reports',
      'financial_insights',
    ])

    const aiToolsModule = await import('../src/intelligence/ai-tools')
    const financialModule = await import('../src/intelligence/ai-tools/financial')
    expect(typeof aiToolsModule.createAIToolResolver).toBe('function')
    expect(typeof aiToolsModule.validateAIToolResolverCatalog).toBe('function')
    expect(typeof financialModule.createFinancialAIToolResolver).toBe('function')
    expect(typeof financialModule.createFinancialToolsCatalog).toBe('function')
  })

  it('uses the certified catalog as single source of truth for filtering', () => {
    const registry = createAIToolRegistry([createPingTool()])
    const financialRegistration = registerFinancialToolsCatalog(registry)
    expect(financialRegistration.kind).toBe('success')

    const resolver = createFinancialAIToolResolver({ registry })
    expect(resolver.exists('ping')).toBe(false)

    const pingResolution = resolver.resolve('ping')
    expect(pingResolution.kind).toBe('failure')
    if (pingResolution.kind === 'failure') {
      expect(pingResolution.code).toBe('TOOL_NOT_FOUND')
    }

    const listed = resolver.listDefinitions().map((definition) => definition.name)
    expect(listed.includes('ping')).toBe(false)
  })

  it('fails catalog validation when registry does not contain catalog tool', () => {
    const registry = createAIToolRegistry()
    const catalog = createFinancialToolsCatalog()

    const validation = validateAIToolResolverCatalog({
      registry,
      catalog,
    })

    expect(validation.kind).toBe('failure')
    if (validation.kind === 'failure') {
      expect(validation.code).toBe('TOOL_NOT_FOUND')
    }
  })
})

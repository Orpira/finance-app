import type {
  AITool,
  AIToolFailure,
  AIToolRegistry,
} from '../aiToolContracts'
import { createToolFailure } from '../aiToolValidator'
import {
  createBalanceAITool,
  type BalanceToolDependencies,
} from './balanceTool'
import {
  createTransactionsAITool,
  type TransactionsToolDependencies,
} from './transactionsTool'
import {
  createBudgetAITool,
  type BudgetToolDependencies,
} from './budgetTool'
import {
  createGoalsAITool,
  type GoalsToolDependencies,
} from './goalsTool'
import {
  createReportsAITool,
  type ReportsToolDependencies,
} from './reportsTool'
import {
  createFinancialInsightsAITool,
  type FinancialInsightsToolDependencies,
} from './insightsTool'

export interface FinancialToolsCatalogDependencies {
  readonly balance?: BalanceToolDependencies
  readonly transactions?: TransactionsToolDependencies
  readonly budget?: BudgetToolDependencies
  readonly goals?: GoalsToolDependencies
  readonly reports?: ReportsToolDependencies
  readonly insights?: FinancialInsightsToolDependencies
}

export interface FinancialCatalogRegistrationSuccess {
  readonly kind: 'success'
  readonly toolNames: readonly string[]
}

export type FinancialCatalogRegistrationResult = FinancialCatalogRegistrationSuccess | AIToolFailure

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase()
}

function findDuplicateName(tools: readonly AITool[]): string | null {
  const names = new Set<string>()

  for (const tool of tools) {
    const key = normalizeToolName(tool.definition.name)
    if (names.has(key)) {
      return tool.definition.name
    }
    names.add(key)
  }

  return null
}

function hasRegistryConflict(registry: AIToolRegistry, tools: readonly AITool[]): string | null {
  const existing = new Set(
    registry
      .listDefinitions()
      .map((definition) => normalizeToolName(definition.name)),
  )

  for (const tool of tools) {
    const key = normalizeToolName(tool.definition.name)
    if (existing.has(key)) {
      return tool.definition.name
    }
  }

  return null
}

export function createFinancialToolsCatalog(input: FinancialToolsCatalogDependencies = {}): readonly AITool[] {
  return [
    createBalanceAITool(input.balance),
    createTransactionsAITool(input.transactions),
    createBudgetAITool(input.budget),
    createGoalsAITool(input.goals),
    createReportsAITool(input.reports),
    createFinancialInsightsAITool(input.insights),
  ]
}

export function registerFinancialToolsCatalog(
  registry: AIToolRegistry,
  input: FinancialToolsCatalogDependencies = {},
): FinancialCatalogRegistrationResult {
  const tools = createFinancialToolsCatalog(input)
  const duplicateInCatalog = findDuplicateName(tools)

  if (duplicateInCatalog !== null) {
    return createToolFailure(
      'TOOL_ALREADY_REGISTERED',
      `The financial catalog contains duplicated tool name '${duplicateInCatalog}'.`,
    )
  }

  const conflict = hasRegistryConflict(registry, tools)
  if (conflict !== null) {
    return createToolFailure(
      'TOOL_ALREADY_REGISTERED',
      `The tool '${conflict}' is already registered and blocks financial catalog integration.`,
    )
  }

  const registeredNames: string[] = []

  for (const tool of tools) {
    const added = registry.register(tool)
    if (added.kind === 'failure') {
      return added
    }
    registeredNames.push(tool.definition.name)
  }

  return {
    kind: 'success',
    toolNames: registeredNames,
  }
}

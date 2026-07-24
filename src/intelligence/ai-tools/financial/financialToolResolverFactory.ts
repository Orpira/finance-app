import type { AIToolRegistry } from '../aiToolContracts'
import {
  createAIToolResolver,
  type AIToolResolver,
} from '../aiToolResolver'
import {
  createFinancialToolsCatalog,
  type FinancialToolsCatalogDependencies,
} from './financialToolsCatalog'

export function createFinancialAIToolResolver(input: {
  readonly registry: AIToolRegistry
  readonly dependencies?: FinancialToolsCatalogDependencies
}): AIToolResolver {
  return createAIToolResolver({
    registry: input.registry,
    catalog: createFinancialToolsCatalog(input.dependencies),
  })
}

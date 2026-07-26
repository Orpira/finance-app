export * from './intentResolverContracts'
export * from './intentResolverValidator'
export * from './deterministicIntentResolver'
export * from './intentResolverFactory'

import type { AIToolRegistry } from '../ai-tools'
import { createFinancialToolRegistry } from '../financial-copilot/toolRegistry'
import type {
  IntentResolutionRequest,
  IntentResolver,
  IntentResolverResolveResult,
} from './intentResolverContracts'

/**
 * Wraps a base `IntentResolver` so it reasons about the real capabilities
 * published by the Tool Registry (PB-IS-016.1) instead of classifying by
 * text alone: if the base resolver selects a tool that is not actually
 * registered, the resolution fails closed instead of being forwarded
 * toward execution against a capability that does not exist. This never
 * invents a tool selection.
 */
export function createCapabilityAwareIntentResolver(input: {
  readonly baseResolver: IntentResolver
  readonly toolRegistry: AIToolRegistry
}): IntentResolver {
  const financialToolRegistry = createFinancialToolRegistry(input.toolRegistry)

  return {
    async resolve(request: IntentResolutionRequest): Promise<IntentResolverResolveResult> {
      const base = await input.baseResolver.resolve(request)
      if (base.kind === 'failure') {
        return base
      }

      const knownToolIds = new Set(financialToolRegistry.listTools().map((tool) => tool.toolId))
      const unknownSelections = base.resolution.tools.filter((tool) => !knownToolIds.has(tool.toolId))

      if (unknownSelections.length === 0) {
        return base
      }

      return {
        kind: 'failure',
        code: 'INVALID_INTENT_RESULT',
        retryable: false,
        safeMessage: `Resolved tool(s) [${unknownSelections.map((tool) => tool.toolId).join(', ')}] are not registered in the Tool Registry.`,
      }
    },
  }
}

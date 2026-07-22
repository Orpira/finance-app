import type { AIContext, AIContextSource } from '../context-builder'
import type {
  AIContextResolutionFailure,
  AIContextResolutionResult,
  AIResolvedContext,
  AIResolvedSection,
  AIContextResolutionErrorCode,
  AIResolutionStrategy,
} from './aiContextResolutionContracts'
import {
  createResolvedContext,
  createResolvedSectionFromContextSection,
  resolutionIdFromContext,
  sanitizeResolvedSections,
} from './aiContextResolutionFactory'

export interface AIContextResolver {
  resolve(input: {
    readonly context: AIContext
    readonly strategy?: AIResolutionStrategy
    readonly createdAt: string
  }): AIContextResolutionResult
  resolveByStrategy(input: {
    readonly context: AIContext
    readonly strategy: AIResolutionStrategy
    readonly createdAt: string
  }): AIContextResolutionResult
  includeSection(
    sections: readonly AIResolvedSection[],
    section: AIResolvedSection,
  ): readonly AIResolvedSection[]
  excludeSection(
    sections: readonly AIResolvedSection[],
    sectionId: string,
  ): readonly AIResolvedSection[]
  prioritizeSections(
    sections: readonly AIResolvedSection[],
  ): readonly AIResolvedSection[]
}

interface StrategyRule {
  readonly allowedSources: ReadonlySet<AIContextSource>
  readonly limit?: number
}

const STRATEGY_RULES: Readonly<Record<AIResolutionStrategy, StrategyRule>> = {
  DEFAULT: {
    allowedSources: new Set([
      'CONVERSATION',
      'SESSION',
      'USER_PROFILE',
      'APPLICATION',
      'FINANCIAL_DATA',
      'CONFIGURATION',
    ]),
  },
  MINIMAL: {
    allowedSources: new Set([
      'CONVERSATION',
      'SESSION',
      'USER_PROFILE',
      'APPLICATION',
      'FINANCIAL_DATA',
      'CONFIGURATION',
    ]),
    limit: 1,
  },
  CONVERSATION_ONLY: {
    allowedSources: new Set(['CONVERSATION']),
  },
  APPLICATION_ONLY: {
    allowedSources: new Set(['APPLICATION', 'CONFIGURATION']),
  },
  FINANCIAL_ONLY: {
    allowedSources: new Set(['FINANCIAL_DATA']),
  },
}

function resolverFailure(
  code: AIContextResolutionErrorCode,
  safeMessage: string,
): AIContextResolutionFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function toResolvedSections(
  context: AIContext,
): { readonly sections: readonly AIResolvedSection[] } | AIContextResolutionFailure {
  const resolvedSections: AIResolvedSection[] = []

  for (let index = 0; index < context.sections.length; index += 1) {
    const section = context.sections[index]
    const resolved = createResolvedSectionFromContextSection({
      id: `resolved-section:${context.id}:${String(index + 1).padStart(4, '0')}`,
      section,
    })

    if (resolved.kind === 'failure') {
      return resolverFailure(resolved.code, resolved.safeMessage)
    }

    resolvedSections.push(resolved.section)
  }

  return {
    sections: resolvedSections,
  }
}

function applyStrategy(
  sections: readonly AIResolvedSection[],
  strategy: AIResolutionStrategy,
): readonly AIResolvedSection[] {
  const rule = STRATEGY_RULES[strategy]
  const filtered = sections.filter((section) => rule.allowedSources.has(section.source))
  const prioritized = sanitizeResolvedSections(filtered)

  if (rule.limit === undefined) {
    return prioritized
  }

  return prioritized.slice(0, rule.limit)
}

export function createAIContextResolver(): AIContextResolver {
  return {
    resolve(input) {
      return this.resolveByStrategy({
        context: input.context,
        strategy: input.strategy ?? 'DEFAULT',
        createdAt: input.createdAt,
      })
    },

    resolveByStrategy(input) {
      const toSectionsResult = toResolvedSections(input.context)
      if ('kind' in toSectionsResult) {
        return toSectionsResult
      }

      const strategySections = applyStrategy(toSectionsResult.sections, input.strategy)
      const prioritized = this.prioritizeSections(strategySections)

      if (prioritized.length === 0) {
        return resolverFailure(
          'NO_SECTIONS_RESOLVED',
          'The context resolution produced no sections for the selected strategy.',
        )
      }

      return createResolvedContext({
        id: resolutionIdFromContext(input.context, input.strategy),
        sections: prioritized,
        strategy: input.strategy,
        metadata: {
          createdAt: input.createdAt,
          sourceContextId: input.context.id,
          source: input.context.metadata.source,
          tags: [
            'context-resolution',
            `strategy:${input.strategy}`,
          ],
        },
      })
    },

    includeSection(sections, section) {
      if (sections.some((existing) => existing.id === section.id)) {
        return sanitizeResolvedSections(sections)
      }
      return sanitizeResolvedSections([...sections, section])
    },

    excludeSection(sections, sectionId) {
      return sanitizeResolvedSections(
        sections.filter((section) => section.id !== sectionId),
      )
    },

    prioritizeSections(sections) {
      return sanitizeResolvedSections(sections)
    },
  }
}

export function resolveContext(input: {
  readonly context: AIContext
  readonly strategy?: AIResolutionStrategy
  readonly createdAt: string
}): AIContextResolutionResult {
  return createAIContextResolver().resolve(input)
}

export function isResolvedContext(result: AIContextResolutionResult): result is {
  kind: 'success'
  resolvedContext: AIResolvedContext
} {
  return result.kind === 'success'
}

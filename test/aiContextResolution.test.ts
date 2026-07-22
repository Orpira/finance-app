import { describe, expect, it } from 'vitest'

import {
  createContext,
  createContextSection,
  type AIContext,
} from '../src/intelligence/context-builder'
import {
  createAIContextResolver,
  createResolvedContext,
  createResolutionId,
  createResolvedSection,
  validateResolvedContext,
  validateResolvedSection,
} from '../src/intelligence/context-resolution'

function createFixtureContext(): AIContext {
  const conversation = createContextSection({
    id: 'context-section:conversation:001',
    source: 'CONVERSATION',
    priority: 'HIGH',
    content: {
      text: 'Necesito ayuda con balance mensual.',
    },
    metadata: {
      createdAt: '2026-07-22T00:00:01.000Z',
      source: 'CONVERSATION',
    },
  })

  const session = createContextSection({
    id: 'context-section:session:001',
    source: 'SESSION',
    priority: 'NORMAL',
    content: {
      sessionStatus: 'ACTIVE',
    },
    metadata: {
      createdAt: '2026-07-22T00:00:02.000Z',
      source: 'APPLICATION',
    },
  })

  const application = createContextSection({
    id: 'context-section:application:001',
    source: 'APPLICATION',
    priority: 'CRITICAL',
    content: {
      locale: 'es-ES',
      currency: 'EUR',
    },
    metadata: {
      createdAt: '2026-07-22T00:00:03.000Z',
      source: 'APPLICATION',
    },
  })

  const configuration = createContextSection({
    id: 'context-section:configuration:001',
    source: 'CONFIGURATION',
    priority: 'LOW',
    content: {
      responseStyle: 'brief',
    },
    metadata: {
      createdAt: '2026-07-22T00:00:04.000Z',
      source: 'SYSTEM',
    },
  })

  const financial = createContextSection({
    id: 'context-section:financial:001',
    source: 'FINANCIAL_DATA',
    priority: 'HIGH',
    content: {
      netProfit: 1200,
    },
    metadata: {
      createdAt: '2026-07-22T00:00:05.000Z',
      source: 'APPLICATION',
    },
  })

  if (
    conversation.kind === 'failure' ||
    session.kind === 'failure' ||
    application.kind === 'failure' ||
    configuration.kind === 'failure' ||
    financial.kind === 'failure'
  ) {
    throw new Error('Expected valid context section fixtures')
  }

  const context = createContext({
    id: 'context:fixture:001',
    sections: [
      conversation.section,
      session.section,
      application.section,
      configuration.section,
      financial.section,
    ],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (context.kind === 'failure') {
    throw new Error('Expected valid context fixture')
  }

  return context.context
}

describe('AIContextResolution factory and validator', () => {
  it('creates resolution and resolved section identifiers', () => {
    expect(createResolutionId('resolved-context:default:context:001')).toBe(
      'resolved-context:default:context:001',
    )
    expect(createResolutionId('')).toBeNull()
  })

  it('creates immutable resolved section and context', () => {
    const section = createResolvedSection({
      id: 'resolved-section:main:001',
      source: 'APPLICATION',
      priority: 'CRITICAL',
      content: {
        appVersion: '1.0.0',
      },
      metadata: {
        protocolVersion: 1,
        createdAt: '2026-07-22T00:00:01.000Z',
        source: 'APPLICATION',
        deterministic: true,
        failClosed: true,
      },
    })

    expect(section.kind).toBe('success')
    if (section.kind === 'success') {
      expect(validateResolvedSection(section.section)).toBeNull()
      expect(Object.isFrozen(section.section)).toBe(true)
    }

    if (section.kind === 'failure') {
      throw new Error('Expected valid resolved section fixture')
    }

    const resolved = createResolvedContext({
      id: 'resolved-context:default:main:001',
      sections: [section.section],
      strategy: 'DEFAULT',
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        sourceContextId: 'context:main:001',
        source: 'APPLICATION',
      },
    })

    expect(resolved.kind).toBe('success')
    if (resolved.kind === 'success') {
      expect(validateResolvedContext(resolved.resolvedContext)).toBeNull()
      expect(Object.isFrozen(resolved.resolvedContext)).toBe(true)
      expect(Object.isFrozen(resolved.resolvedContext.sections)).toBe(true)
    }
  })
})

describe('AIContextResolver strategies', () => {
  it('resolves DEFAULT strategy with deterministic priority order', () => {
    const resolver = createAIContextResolver()
    const context = createFixtureContext()

    const result = resolver.resolve({
      context,
      createdAt: '2026-07-22T00:00:06.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolvedContext.strategy).toBe('DEFAULT')
      expect(result.resolvedContext.sections.map((section) => section.source)).toEqual([
        'APPLICATION',
        'CONVERSATION',
        'FINANCIAL_DATA',
        'SESSION',
        'CONFIGURATION',
      ])
    }
  })

  it('resolves MINIMAL strategy keeping only highest-priority section', () => {
    const resolver = createAIContextResolver()
    const context = createFixtureContext()

    const result = resolver.resolveByStrategy({
      context,
      strategy: 'MINIMAL',
      createdAt: '2026-07-22T00:00:06.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolvedContext.sections).toHaveLength(1)
      expect(result.resolvedContext.sections[0].source).toBe('APPLICATION')
    }
  })

  it('resolves CONVERSATION_ONLY strategy', () => {
    const resolver = createAIContextResolver()
    const context = createFixtureContext()

    const result = resolver.resolveByStrategy({
      context,
      strategy: 'CONVERSATION_ONLY',
      createdAt: '2026-07-22T00:00:06.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolvedContext.sections.every((section) => section.source === 'CONVERSATION')).toBe(true)
    }
  })

  it('resolves APPLICATION_ONLY strategy', () => {
    const resolver = createAIContextResolver()
    const context = createFixtureContext()

    const result = resolver.resolveByStrategy({
      context,
      strategy: 'APPLICATION_ONLY',
      createdAt: '2026-07-22T00:00:06.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolvedContext.sections.map((section) => section.source)).toEqual([
        'APPLICATION',
        'CONFIGURATION',
      ])
    }
  })

  it('resolves FINANCIAL_ONLY strategy', () => {
    const resolver = createAIContextResolver()
    const context = createFixtureContext()

    const result = resolver.resolveByStrategy({
      context,
      strategy: 'FINANCIAL_ONLY',
      createdAt: '2026-07-22T00:00:06.000Z',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.resolvedContext.sections).toHaveLength(1)
      expect(result.resolvedContext.sections[0].source).toBe('FINANCIAL_DATA')
    }
  })

  it('supports includeSection and excludeSection deterministically', () => {
    const resolver = createAIContextResolver()
    const context = createFixtureContext()
    const initial = resolver.resolve({
      context,
      createdAt: '2026-07-22T00:00:06.000Z',
    })

    if (initial.kind === 'failure') {
      throw new Error('Expected success resolution fixture')
    }

    const synthetic = createResolvedSection({
      id: 'resolved-section:synthetic:001',
      source: 'SESSION',
      priority: 'LOW',
      content: { synthetic: true },
      metadata: {
        protocolVersion: 1,
        createdAt: '2026-07-22T00:00:07.000Z',
        source: 'SYSTEM',
        deterministic: true,
        failClosed: true,
      },
    })

    if (synthetic.kind === 'failure') {
      throw new Error('Expected synthetic resolved section fixture')
    }

    const withIncluded = resolver.includeSection(
      initial.resolvedContext.sections,
      synthetic.section,
    )
    expect(withIncluded.some((section) => section.id === synthetic.section.id)).toBe(true)

    const withoutIncluded = resolver.excludeSection(withIncluded, synthetic.section.id)
    expect(withoutIncluded.some((section) => section.id === synthetic.section.id)).toBe(false)
  })

  it('does not mutate source AIContext and always creates a new result', () => {
    const resolver = createAIContextResolver()
    const context = createFixtureContext()
    const beforeSerialized = JSON.stringify(context)

    const first = resolver.resolve({
      context,
      createdAt: '2026-07-22T00:00:06.000Z',
    })
    const second = resolver.resolve({
      context,
      createdAt: '2026-07-22T00:00:07.000Z',
    })

    expect(JSON.stringify(context)).toBe(beforeSerialized)
    expect(first.kind).toBe('success')
    expect(second.kind).toBe('success')
    if (first.kind === 'success' && second.kind === 'success') {
      expect(first.resolvedContext).not.toBe(second.resolvedContext)
      expect(first.resolvedContext.metadata.createdAt).not.toBe(
        second.resolvedContext.metadata.createdAt,
      )
    }
  })
})

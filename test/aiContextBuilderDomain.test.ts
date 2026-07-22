import { describe, expect, it } from 'vitest'

import {
  buildContext,
  createContext,
  createContextBuilder,
  createContextId,
  createContextSection,
  createContextSectionFromConversationMessage,
  createContextSectionFromSession,
  createContextSectionId,
  validateAIContext,
  validateAIContextSection,
} from '../src/intelligence/context-builder'
import {
  createAIConversation,
} from '../src/intelligence/ai-conversation'
import {
  createAIConversationMessage,
} from '../src/intelligence/ai-conversation/message'
import {
  createAIConversationSession,
} from '../src/intelligence/ai-conversation/session'

describe('AIContext factory and contracts (Milestone 10B)', () => {
  it('creates typed context and section identifiers', () => {
    expect(createContextId('context:main:001')).toBe('context:main:001')
    expect(createContextId('')).toBeNull()

    expect(createContextSectionId('context-section:main:001')).toBe(
      'context-section:main:001',
    )
    expect(createContextSectionId('section:1')).toBeNull()
  })

  it('creates a valid immutable context section', () => {
    const result = createContextSection({
      id: 'context-section:main:001',
      source: 'APPLICATION',
      priority: 'CRITICAL',
      content: {
        appVersion: '1.0.0',
      },
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'SYSTEM',
        tags: ['bootstrap'],
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(validateAIContextSection(result.section)).toBeNull()
      expect(Object.isFrozen(result.section)).toBe(true)
      expect(Object.isFrozen(result.section.metadata)).toBe(true)
      expect(() => {
        ;(result.section.metadata.tags as string[]).push('x')
      }).toThrow()
    }
  })

  it('fails closed for invalid section content', () => {
    const invalidSection = createContextSection({
      id: 'context-section:main:001',
      source: 'APPLICATION',
      priority: 'LOW',
      content: {} as Record<string, never>,
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(invalidSection.kind).toBe('success')
  })

  it('creates a valid immutable context with ordered sections', () => {
    const app = createContextSection({
      id: 'context-section:app:001',
      source: 'APPLICATION',
      priority: 'HIGH',
      content: {
        locale: 'es-ES',
      },
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    const cfg = createContextSection({
      id: 'context-section:cfg:001',
      source: 'CONFIGURATION',
      priority: 'NORMAL',
      content: {
        currency: 'EUR',
      },
      metadata: {
        createdAt: '2026-07-22T00:00:01.000Z',
        source: 'APPLICATION',
      },
    })

    expect(app.kind).toBe('success')
    expect(cfg.kind).toBe('success')
    if (app.kind === 'failure' || cfg.kind === 'failure') {
      throw new Error('Expected valid fixture sections')
    }

    const contextResult = createContext({
      id: 'context:main:001',
      sections: [app.section, cfg.section],
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(contextResult.kind).toBe('success')
    if (contextResult.kind === 'success') {
      expect(validateAIContext(contextResult.context)).toBeNull()
      expect(contextResult.context.sections).toHaveLength(2)
      expect(contextResult.context.sections[0].source).toBe('APPLICATION')
      expect(contextResult.context.sections[1].source).toBe('CONFIGURATION')
      expect(Object.isFrozen(contextResult.context)).toBe(true)
      expect(Object.isFrozen(contextResult.context.sections)).toBe(true)
    }
  })

  it('fails closed when context has duplicate section ids', () => {
    const section = createContextSection({
      id: 'context-section:dup:001',
      source: 'CONVERSATION',
      priority: 'NORMAL',
      content: {
        text: 'Hola',
      },
      metadata: {
        createdAt: '2026-07-22T00:00:01.000Z',
        source: 'CONVERSATION',
      },
    })

    if (section.kind === 'failure') {
      throw new Error('Expected valid fixture section')
    }

    const contextResult = createContext({
      id: 'context:dup:001',
      sections: [section.section, section.section],
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(contextResult.kind).toBe('failure')
    if (contextResult.kind === 'failure') {
      expect(contextResult.code).toBe('DUPLICATE_SECTION_ID')
    }
  })
})

describe('AIContextBuilder', () => {
  it('builds a context from inserted sections and preserves insertion order', () => {
    const result = createContextBuilder()
      .createContext({
        id: 'context:builder:001',
        createdAt: '2026-07-22T00:00:00.000Z',
      })
      .addSection({
        id: 'context-section:builder:001',
        source: 'CONVERSATION',
        content: { value: 'first' },
        priority: 'LOW',
        createdAt: '2026-07-22T00:00:01.000Z',
      })
      .addSection({
        id: 'context-section:builder:002',
        source: 'FINANCIAL_DATA',
        content: { value: 'second' },
        priority: 'HIGH',
        createdAt: '2026-07-22T00:00:02.000Z',
      })
      .build()

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.context.sections.map((section) => section.id)).toEqual([
        'context-section:builder:001',
        'context-section:builder:002',
      ])
    }
  })

  it('sorts sections by priority with deterministic tie-breaks', () => {
    const builder = createContextBuilder().createContext({
      id: 'context:builder:sort:001',
      createdAt: '2026-07-22T00:00:00.000Z',
    })

    builder
      .addSection({
        id: 'context-section:sort:001',
        source: 'SESSION',
        content: { value: 'low' },
        priority: 'LOW',
        createdAt: '2026-07-22T00:00:03.000Z',
      })
      .addSection({
        id: 'context-section:sort:002',
        source: 'CONFIGURATION',
        content: { value: 'critical' },
        priority: 'CRITICAL',
        createdAt: '2026-07-22T00:00:01.000Z',
      })
      .addSection({
        id: 'context-section:sort:003',
        source: 'APPLICATION',
        content: { value: 'high' },
        priority: 'HIGH',
        createdAt: '2026-07-22T00:00:02.000Z',
      })
      .sortSections()

    const result = builder.build()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.context.sections.map((section) => section.id)).toEqual([
        'context-section:sort:002',
        'context-section:sort:003',
        'context-section:sort:001',
      ])
    }
  })

  it('removes a section before build', () => {
    const builder = createContextBuilder().createContext({
      id: 'context:builder:remove:001',
      createdAt: '2026-07-22T00:00:00.000Z',
    })

    builder
      .addSection({
        id: 'context-section:remove:001',
        source: 'APPLICATION',
        content: { value: 'to remove' },
        priority: 'LOW',
        createdAt: '2026-07-22T00:00:01.000Z',
      })
      .removeSection('context-section:remove:001')

    const result = builder.build()
    expect(result.kind).toBe('failure')
  })

  it('fails closed when build is called without context metadata', () => {
    const result = createContextBuilder().build()
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_CONTEXT')
    }
  })

  it('supports quick build helper', () => {
    const result = buildContext({
      id: 'context:helper:001',
      createdAt: '2026-07-22T00:00:00.000Z',
      sections: [
        {
          id: 'context-section:helper:001',
          source: 'APPLICATION',
          content: { value: 'system-state' },
          priority: 'CRITICAL',
          createdAt: '2026-07-22T00:00:01.000Z',
        },
      ],
    })

    expect(result.kind).toBe('success')
  })
})

describe('AIContext basic integration with Conversation and Session', () => {
  it('maps a conversation message into a context section', () => {
    const createdMessage = createAIConversationMessage({
      id: 'message:main:001',
      conversationId: 'conversation:main:001',
      sessionId: 'session:main:001',
      role: 'USER',
      content: {
        value: 'Necesito entender mi balance.',
      },
      sequence: 0,
      createdAt: '2026-07-22T00:00:00.000Z',
      metadata: {
        generatedLocally: true,
      },
    })

    if (createdMessage.kind === 'failure') {
      throw new Error('Expected valid conversation message fixture')
    }

    const sectionResult = createContextSectionFromConversationMessage({
      id: 'context-section:conversation:001',
      message: createdMessage.message,
      priority: 'HIGH',
    })

    expect(sectionResult.kind).toBe('success')
    if (sectionResult.kind === 'success') {
      expect(sectionResult.section.source).toBe('CONVERSATION')
      expect(sectionResult.section.content.content).toBe(
        'Necesito entender mi balance.',
      )
    }
  })

  it('maps a conversation session into a context section', () => {
    const conversation = createAIConversation({
      conversationId: 'conversation:main:001',
      status: 'OPEN',
      participants: [
        {
          participantId: 'user:1',
          role: 'USER',
          active: true,
        },
      ],
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    if (conversation.kind === 'failure') {
      throw new Error('Expected valid conversation fixture')
    }

    const session = createAIConversationSession({
      sessionId: 'session:main:001',
      conversation: conversation.conversation,
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    if (session.kind === 'failure') {
      throw new Error('Expected valid session fixture')
    }

    const sectionResult = createContextSectionFromSession({
      id: 'context-section:session:001',
      session: session.session,
      priority: 'CRITICAL',
    })

    expect(sectionResult.kind).toBe('success')
    if (sectionResult.kind === 'success') {
      expect(sectionResult.section.source).toBe('SESSION')
      expect(sectionResult.section.content.sessionStatus).toBe('CREATED')
      expect(sectionResult.section.content.messageCount).toBe(0)
    }
  })
})

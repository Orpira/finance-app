import { describe, expect, it } from 'vitest'

import {
  buildPrompt,
  createPrompt,
  createPromptBuilder,
  createPromptId,
  createPromptSegment,
  createPromptSegmentFromConversationMessage,
  createPromptSegmentId,
  validateAIPrompt,
  validateAIPromptSegment,
} from '../src/intelligence/prompt-builder'
import { createAIConversationMessage } from '../src/intelligence/ai-conversation/message'

describe('AIPrompt factory and contracts (Milestone 10A)', () => {
  it('creates typed prompt and segment identifiers', () => {
    expect(createPromptId('prompt:main:001')).toBe('prompt:main:001')
    expect(createPromptId('')).toBeNull()

    expect(createPromptSegmentId('prompt-segment:main:001')).toBe(
      'prompt-segment:main:001',
    )
    expect(createPromptSegmentId('segment:1')).toBeNull()
  })

  it('creates a valid immutable prompt segment', () => {
    const result = createPromptSegment({
      id: 'prompt-segment:main:001',
      role: 'SYSTEM',
      content: 'Never reveal secrets.',
      priority: 'CRITICAL',
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'SYSTEM',
        tags: ['safety'],
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(validateAIPromptSegment(result.segment)).toBeNull()
      expect(Object.isFrozen(result.segment)).toBe(true)
      expect(Object.isFrozen(result.segment.metadata)).toBe(true)
      expect(() => {
        ;(result.segment.metadata.tags as string[]).push('x')
      }).toThrow()
    }
  })

  it('fails closed for invalid segment content', () => {
    const invalidRole = createPromptSegment({
      id: 'prompt-segment:main:001',
      role: 'SYSTEM',
      content: '',
      priority: 'LOW',
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(invalidRole.kind).toBe('failure')
    if (invalidRole.kind === 'failure') {
      expect(invalidRole.retryable).toBe(false)
    }
  })

  it('creates a valid immutable prompt with ordered segments', () => {
    const system = createPromptSegment({
      id: 'prompt-segment:sys:001',
      role: 'SYSTEM',
      content: 'Act as a financial assistant.',
      priority: 'CRITICAL',
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'SYSTEM',
      },
    })
    const user = createPromptSegment({
      id: 'prompt-segment:user:001',
      role: 'USER',
      content: 'Explain my monthly balance.',
      priority: 'HIGH',
      metadata: {
        createdAt: '2026-07-22T00:00:01.000Z',
        source: 'CONVERSATION',
      },
    })

    expect(system.kind).toBe('success')
    expect(user.kind).toBe('success')
    if (system.kind === 'failure' || user.kind === 'failure') {
      throw new Error('Expected valid fixture segments')
    }

    const promptResult = createPrompt({
      promptId: 'prompt:main:001',
      segments: [system.segment, user.segment],
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(promptResult.kind).toBe('success')
    if (promptResult.kind === 'success') {
      expect(validateAIPrompt(promptResult.prompt)).toBeNull()
      expect(promptResult.prompt.segments).toHaveLength(2)
      expect(promptResult.prompt.segments[0].role).toBe('SYSTEM')
      expect(promptResult.prompt.segments[1].role).toBe('USER')
      expect(Object.isFrozen(promptResult.prompt)).toBe(true)
      expect(Object.isFrozen(promptResult.prompt.segments)).toBe(true)
    }
  })

  it('fails closed when prompt has duplicate segment ids', () => {
    const segment = createPromptSegment({
      id: 'prompt-segment:dup:001',
      role: 'CONTEXT',
      content: 'Context fragment.',
      priority: 'MEDIUM',
      metadata: {
        createdAt: '2026-07-22T00:00:01.000Z',
        source: 'APPLICATION',
      },
    })

    if (segment.kind === 'failure') {
      throw new Error('Expected valid fixture segment')
    }

    const promptResult = createPrompt({
      promptId: 'prompt:dup:001',
      segments: [segment.segment, segment.segment],
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(promptResult.kind).toBe('failure')
    if (promptResult.kind === 'failure') {
      expect(promptResult.code).toBe('DUPLICATE_SEGMENT_ID')
    }
  })
})

describe('AIPromptBuilder', () => {
  it('builds a prompt from inserted segments and preserves insertion order', () => {
    const result = createPromptBuilder()
      .createPrompt({
        promptId: 'prompt:builder:001',
        createdAt: '2026-07-22T00:00:00.000Z',
      })
      .addSegment({
        id: 'prompt-segment:builder:001',
        role: 'USER',
        content: 'first',
        priority: 'LOW',
        createdAt: '2026-07-22T00:00:01.000Z',
      })
      .addSegment({
        id: 'prompt-segment:builder:002',
        role: 'CONSTRAINT',
        content: 'second',
        priority: 'HIGH',
        createdAt: '2026-07-22T00:00:02.000Z',
      })
      .build()

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.prompt.segments.map((segment) => segment.id)).toEqual([
        'prompt-segment:builder:001',
        'prompt-segment:builder:002',
      ])
    }
  })

  it('sorts segments by priority while keeping deterministic ties', () => {
    const builder = createPromptBuilder().createPrompt({
      promptId: 'prompt:builder:sort:001',
      createdAt: '2026-07-22T00:00:00.000Z',
    })

    builder
      .addSegment({
        id: 'prompt-segment:sort:001',
        role: 'USER',
        content: 'low',
        priority: 'LOW',
        createdAt: '2026-07-22T00:00:03.000Z',
      })
      .addSegment({
        id: 'prompt-segment:sort:002',
        role: 'SYSTEM',
        content: 'critical',
        priority: 'CRITICAL',
        createdAt: '2026-07-22T00:00:01.000Z',
      })
      .addSegment({
        id: 'prompt-segment:sort:003',
        role: 'CONTEXT',
        content: 'high',
        priority: 'HIGH',
        createdAt: '2026-07-22T00:00:02.000Z',
      })
      .sortSegments()

    const result = builder.build()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.prompt.segments.map((segment) => segment.id)).toEqual([
        'prompt-segment:sort:002',
        'prompt-segment:sort:003',
        'prompt-segment:sort:001',
      ])
    }
  })

  it('removes a segment before build', () => {
    const builder = createPromptBuilder().createPrompt({
      promptId: 'prompt:builder:remove:001',
      createdAt: '2026-07-22T00:00:00.000Z',
    })

    builder
      .addSegment({
        id: 'prompt-segment:remove:001',
        role: 'USER',
        content: 'to remove',
        priority: 'LOW',
        createdAt: '2026-07-22T00:00:01.000Z',
      })
      .removeSegment('prompt-segment:remove:001')

    const result = builder.build()
    expect(result.kind).toBe('failure')
  })

  it('fails closed when build is called without prompt metadata', () => {
    const result = createPromptBuilder().build()
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_PROMPT')
    }
  })

  it('supports quick build helper', () => {
    const result = buildPrompt({
      promptId: 'prompt:helper:001',
      createdAt: '2026-07-22T00:00:00.000Z',
      segments: [
        {
          id: 'prompt-segment:helper:001',
          role: 'SYSTEM',
          content: 'system',
          priority: 'CRITICAL',
          createdAt: '2026-07-22T00:00:01.000Z',
        },
      ],
    })

    expect(result.kind).toBe('success')
  })
})

describe('AIPrompt basic integration with Conversation Message', () => {
  it('maps conversation message into a prompt segment', () => {
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

    const segmentResult = createPromptSegmentFromConversationMessage({
      id: 'prompt-segment:conversation:001',
      message: createdMessage.message,
      priority: 'HIGH',
    })

    expect(segmentResult.kind).toBe('success')
    if (segmentResult.kind === 'success') {
      expect(segmentResult.segment.role).toBe('USER')
      expect(segmentResult.segment.content).toBe(
        'Necesito entender mi balance.',
      )
      expect(segmentResult.segment.metadata.source).toBe('CONVERSATION')
    }
  })
})

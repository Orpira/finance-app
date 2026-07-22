import type {
  AIPrompt,
  AIPromptJsonValue,
  AIPromptPriority,
  AIPromptResult,
  AIPromptSegment,
  AIPromptSegmentResult,
} from './aiPromptContracts'
import {
  createPrompt,
  createPromptSegment,
  priorityRank,
} from './aiPromptFactory'

export interface AIPromptBuilder {
  createPrompt(input: {
    readonly promptId: string
    readonly createdAt: string
    readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    readonly tags?: readonly string[]
    readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
  }): AIPromptBuilder
  addSegment(input: {
    readonly id: string
    readonly role: AIPromptSegment['role']
    readonly content: string
    readonly priority: AIPromptPriority
    readonly createdAt: string
    readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    readonly tags?: readonly string[]
    readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
  }): AIPromptBuilder
  removeSegment(segmentId: string): AIPromptBuilder
  sortSegments(): AIPromptBuilder
  build(): AIPromptResult
  getSegments(): readonly AIPromptSegment[]
}

interface BuilderState {
  promptId: string
  metadata: {
    createdAt: string
    source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    tags?: readonly string[]
    attributes?: Readonly<Record<string, AIPromptJsonValue>>
  } | null
  segments: AIPromptSegment[]
}

function fail(
  result: AIPromptSegmentResult,
): never {
  if (result.kind === 'failure') {
    throw new Error(result.safeMessage)
  }

  throw new Error('Unexpected prompt segment failure state.')
}

function cloneSegments(segments: readonly AIPromptSegment[]): AIPromptSegment[] {
  return segments.map((segment) => ({
    ...segment,
    metadata: {
      ...segment.metadata,
      ...(segment.metadata.tags === undefined
        ? {}
        : { tags: [...segment.metadata.tags] }),
      ...(segment.metadata.attributes === undefined
        ? {}
        : { attributes: structuredClone(segment.metadata.attributes) }),
    },
  }))
}

export function createPromptBuilder(): AIPromptBuilder {
  const state: BuilderState = {
    promptId: '',
    metadata: null,
    segments: [],
  }

  const builder: AIPromptBuilder = {
    createPrompt(input) {
      state.promptId = input.promptId
      state.metadata = {
        createdAt: input.createdAt,
        source: input.source ?? 'APPLICATION',
        ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
        ...(input.attributes === undefined
          ? {}
          : { attributes: structuredClone(input.attributes) }),
      }
      state.segments = []
      return builder
    },

    addSegment(input) {
      const created = createPromptSegment({
        id: input.id,
        role: input.role,
        content: input.content,
        priority: input.priority,
        metadata: {
          createdAt: input.createdAt,
          source: input.source ?? 'APPLICATION',
          ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
          ...(input.attributes === undefined
            ? {}
            : { attributes: structuredClone(input.attributes) }),
        },
      })

      if (created.kind === 'failure') {
        fail(created)
      }

      state.segments.push(created.segment)
      return builder
    },

    removeSegment(segmentId) {
      state.segments = state.segments.filter((segment) => segment.id !== segmentId)
      return builder
    },

    sortSegments() {
      const withIndex = state.segments.map((segment, index) => ({ segment, index }))
      withIndex.sort((left, right) => {
        const byPriority = priorityRank(left.segment.priority) - priorityRank(right.segment.priority)
        if (byPriority !== 0) {
          return byPriority
        }

        const byCreatedAt = left.segment.metadata.createdAt.localeCompare(
          right.segment.metadata.createdAt,
        )
        if (byCreatedAt !== 0) {
          return byCreatedAt
        }

        return left.index - right.index
      })

      state.segments = withIndex.map((item) => item.segment)
      return builder
    },

    build() {
      if (state.metadata === null) {
        return {
          kind: 'failure',
          code: 'INVALID_PROMPT',
          retryable: false,
          safeMessage: 'The AI prompt cannot be built without prompt metadata.',
        }
      }

      return createPrompt({
        promptId: state.promptId,
        segments: cloneSegments(state.segments),
        metadata: {
          createdAt: state.metadata.createdAt,
          source: state.metadata.source,
          ...(state.metadata.tags === undefined
            ? {}
            : { tags: [...state.metadata.tags] }),
          ...(state.metadata.attributes === undefined
            ? {}
            : { attributes: structuredClone(state.metadata.attributes) }),
        },
      })
    },

    getSegments() {
      return cloneSegments(state.segments)
    },
  }

  return builder
}

export function buildPrompt(input: {
  readonly promptId: string
  readonly createdAt: string
  readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly segments: readonly {
    readonly id: string
    readonly role: AIPromptSegment['role']
    readonly content: string
    readonly priority: AIPromptPriority
    readonly createdAt: string
    readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    readonly tags?: readonly string[]
    readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
  }[]
}): AIPromptResult {
  const builder = createPromptBuilder().createPrompt({
    promptId: input.promptId,
    createdAt: input.createdAt,
    source: input.source,
  })

  for (const segment of input.segments) {
    builder.addSegment(segment)
  }

  return builder.build()
}

export function isBuiltPrompt(result: AIPromptResult): result is { kind: 'success'; prompt: AIPrompt } {
  return result.kind === 'success'
}

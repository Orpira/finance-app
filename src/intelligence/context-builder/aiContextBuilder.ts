import type {
  AIContext,
  AIContextJsonValue,
  AIContextPriority,
  AIContextResult,
  AIContextSection,
  AIContextSectionResult,
} from './aiContextContracts'
import {
  createContext,
  createContextSection,
  priorityRank,
} from './aiContextFactory'

export interface AIContextBuilder {
  createContext(input: {
    readonly id: string
    readonly createdAt: string
    readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    readonly tags?: readonly string[]
    readonly attributes?: Readonly<Record<string, AIContextJsonValue>>
  }): AIContextBuilder
  addSection(input: {
    readonly id: string
    readonly source: AIContextSection['source']
    readonly priority: AIContextPriority
    readonly content: Readonly<Record<string, AIContextJsonValue>>
    readonly createdAt: string
    readonly sourceMetadata?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    readonly tags?: readonly string[]
    readonly attributes?: Readonly<Record<string, AIContextJsonValue>>
  }): AIContextBuilder
  removeSection(sectionId: string): AIContextBuilder
  sortSections(): AIContextBuilder
  build(): AIContextResult
  getSections(): readonly AIContextSection[]
}

interface BuilderState {
  contextId: string
  metadata: {
    createdAt: string
    source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    tags?: readonly string[]
    attributes?: Readonly<Record<string, AIContextJsonValue>>
  } | null
  sections: AIContextSection[]
}

function cloneSections(sections: readonly AIContextSection[]): AIContextSection[] {
  return sections.map((section) => ({
    ...section,
    content: structuredClone(section.content),
    metadata: {
      ...section.metadata,
      ...(section.metadata.tags === undefined
        ? {}
        : { tags: [...section.metadata.tags] }),
      ...(section.metadata.attributes === undefined
        ? {}
        : { attributes: structuredClone(section.metadata.attributes) }),
    },
  }))
}

function fail(result: AIContextSectionResult): never {
  if (result.kind === 'failure') {
    throw new Error(result.safeMessage)
  }

  throw new Error('Unexpected context section failure state.')
}

export function createContextBuilder(): AIContextBuilder {
  const state: BuilderState = {
    contextId: '',
    metadata: null,
    sections: [],
  }

  const builder: AIContextBuilder = {
    createContext(input) {
      state.contextId = input.id
      state.metadata = {
        createdAt: input.createdAt,
        source: input.source ?? 'APPLICATION',
        ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
        ...(input.attributes === undefined
          ? {}
          : { attributes: structuredClone(input.attributes) }),
      }
      state.sections = []
      return builder
    },

    addSection(input) {
      const created = createContextSection({
        id: input.id,
        source: input.source,
        priority: input.priority,
        content: structuredClone(input.content),
        metadata: {
          createdAt: input.createdAt,
          source: input.sourceMetadata ?? 'APPLICATION',
          ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
          ...(input.attributes === undefined
            ? {}
            : { attributes: structuredClone(input.attributes) }),
        },
      })

      if (created.kind === 'failure') {
        fail(created)
      }

      state.sections.push(created.section)
      return builder
    },

    removeSection(sectionId) {
      state.sections = state.sections.filter((section) => section.id !== sectionId)
      return builder
    },

    sortSections() {
      const withIndex = state.sections.map((section, index) => ({ section, index }))
      withIndex.sort((left, right) => {
        const byPriority = priorityRank(left.section.priority) - priorityRank(right.section.priority)
        if (byPriority !== 0) {
          return byPriority
        }

        const byCreatedAt = left.section.metadata.createdAt.localeCompare(
          right.section.metadata.createdAt,
        )
        if (byCreatedAt !== 0) {
          return byCreatedAt
        }

        return left.index - right.index
      })

      state.sections = withIndex.map((item) => item.section)
      return builder
    },

    build() {
      if (state.metadata === null) {
        return {
          kind: 'failure',
          code: 'INVALID_CONTEXT',
          retryable: false,
          safeMessage: 'The AI context cannot be built without context metadata.',
        }
      }

      return createContext({
        id: state.contextId,
        sections: cloneSections(state.sections),
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

    getSections() {
      return cloneSections(state.sections)
    },
  }

  return builder
}

export function buildContext(input: {
  readonly id: string
  readonly createdAt: string
  readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly sections: readonly {
    readonly id: string
    readonly source: AIContextSection['source']
    readonly priority: AIContextPriority
    readonly content: Readonly<Record<string, AIContextJsonValue>>
    readonly createdAt: string
    readonly sourceMetadata?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
    readonly tags?: readonly string[]
    readonly attributes?: Readonly<Record<string, AIContextJsonValue>>
  }[]
}): AIContextResult {
  const builder = createContextBuilder().createContext({
    id: input.id,
    createdAt: input.createdAt,
    source: input.source,
  })

  for (const section of input.sections) {
    builder.addSection(section)
  }

  return builder.build()
}

export function isBuiltContext(result: AIContextResult): result is { kind: 'success'; context: AIContext } {
  return result.kind === 'success'
}

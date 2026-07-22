import type {
  AIContext,
  AIContextMetadata,
  AIContextPriority,
  AIContextSource,
} from '../context-builder'
import {
  AI_CONTEXT_RESOLUTION_PROTOCOL_VERSION,
  type AIContextResolutionFailure,
  type AIContextResolutionResult,
  type AIResolvedContext,
  type AIResolvedSection,
  type AIResolvedSectionFailure,
  type AIResolvedSectionId,
  type AIResolvedSectionResult,
  type AIResolutionId,
  type AIResolutionMetadata,
  type AIResolutionStrategy,
  type CreateResolvedContextInput,
  type CreateResolvedSectionInput,
} from './aiContextResolutionContracts'
import {
  isValidResolutionId,
  isValidResolvedSectionId,
  validateResolvedContext,
  validateResolvedSection,
} from './aiContextResolutionValidator'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function cloneMetadata(metadata: AIContextMetadata): AIContextMetadata {
  return {
    ...metadata,
    ...(metadata.tags === undefined ? {} : { tags: [...metadata.tags] }),
    ...(metadata.attributes === undefined
      ? {}
      : { attributes: structuredClone(metadata.attributes) }),
  }
}

function cloneResolvedSection(section: AIResolvedSection): AIResolvedSection {
  return {
    ...section,
    content: structuredClone(section.content),
    metadata: cloneMetadata(section.metadata),
  }
}

function createContextFailure(
  code: AIContextResolutionFailure['code'],
  safeMessage: string,
): AIContextResolutionResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function createSectionFailure(
  code: AIResolvedSectionFailure['code'],
  safeMessage: string,
): AIResolvedSectionResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function normalizeResolutionMetadata(
  input: CreateResolvedContextInput['metadata'],
): AIResolutionMetadata {
  return {
    protocolVersion: input.protocolVersion ?? AI_CONTEXT_RESOLUTION_PROTOCOL_VERSION,
    createdAt: input.createdAt,
    sourceContextId: input.sourceContextId,
    source: input.source,
    deterministic: input.deterministic ?? true,
    failClosed: input.failClosed ?? true,
    ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
    ...(input.attributes === undefined
      ? {}
      : { attributes: structuredClone(input.attributes) }),
  }
}

function sourceRank(source: AIContextSource): number {
  switch (source) {
    case 'CONVERSATION':
      return 0
    case 'SESSION':
      return 1
    case 'USER_PROFILE':
      return 2
    case 'APPLICATION':
      return 3
    case 'FINANCIAL_DATA':
      return 4
    case 'CONFIGURATION':
      return 5
  }
}

function priorityRank(priority: AIContextPriority): number {
  switch (priority) {
    case 'CRITICAL':
      return 0
    case 'HIGH':
      return 1
    case 'NORMAL':
      return 2
    case 'LOW':
      return 3
  }
}

export function compareResolvedSections(
  left: AIResolvedSection,
  right: AIResolvedSection,
): number {
  const byPriority = priorityRank(left.priority) - priorityRank(right.priority)
  if (byPriority !== 0) return byPriority

  const bySource = sourceRank(left.source) - sourceRank(right.source)
  if (bySource !== 0) return bySource

  const byCreatedAt = left.metadata.createdAt.localeCompare(right.metadata.createdAt)
  if (byCreatedAt !== 0) return byCreatedAt

  return left.id.localeCompare(right.id)
}

export function createResolutionId(value: string): AIResolutionId | null {
  const normalized = value.trim()
  if (!isValidResolutionId(normalized)) {
    return null
  }

  return normalized as AIResolutionId
}

export function createResolvedSectionId(value: string): AIResolvedSectionId | null {
  const normalized = value.trim()
  if (!isValidResolvedSectionId(normalized)) {
    return null
  }

  return normalized as AIResolvedSectionId
}

export function createResolvedSection(
  input: CreateResolvedSectionInput,
): AIResolvedSectionResult {
  const id = createResolvedSectionId(input.id)
  if (!id) {
    return createSectionFailure(
      'INVALID_RESOLVED_SECTION_ID',
      'The resolved section identifier is invalid.',
    )
  }

  const section: AIResolvedSection = {
    id,
    source: input.source,
    priority: input.priority,
    content: structuredClone(input.content),
    metadata: cloneMetadata(input.metadata),
  }

  const validation = validateResolvedSection(section)
  if (validation) {
    return createSectionFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    section: deepFreeze(section),
  }
}

export function createResolvedContext(
  input: CreateResolvedContextInput,
): AIContextResolutionResult {
  const id = createResolutionId(input.id)
  if (!id) {
    return createContextFailure(
      'INVALID_RESOLUTION_ID',
      'The context resolution identifier is invalid.',
    )
  }

  const resolvedContext: AIResolvedContext = {
    id,
    sections: input.sections.map((section) => cloneResolvedSection(section)),
    strategy: input.strategy,
    metadata: normalizeResolutionMetadata(input.metadata),
  }

  const validation = validateResolvedContext(resolvedContext)
  if (validation) {
    return createContextFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    resolvedContext: deepFreeze(resolvedContext),
  }
}

export function createResolvedSectionFromContextSection(input: {
  readonly id: string
  readonly section: AIContext['sections'][number]
}): AIResolvedSectionResult {
  return createResolvedSection({
    id: input.id,
    source: input.section.source,
    priority: input.section.priority,
    content: input.section.content,
    metadata: input.section.metadata,
  })
}

export function sanitizeResolvedSections(
  sections: readonly AIResolvedSection[],
): readonly AIResolvedSection[] {
  const cloned = sections.map((section) => cloneResolvedSection(section))
  cloned.sort(compareResolvedSections)
  return cloned
}

export function resolutionIdFromContext(
  context: AIContext,
  strategy: AIResolutionStrategy,
): string {
  const normalizedContextId = context.id.replace(/[^a-z0-9:-]/gi, '-').toLowerCase()
  const normalizedStrategy = strategy.toLowerCase().replace(/_/g, '-')
  return `resolved-context:${normalizedStrategy}:${normalizedContextId}`
}

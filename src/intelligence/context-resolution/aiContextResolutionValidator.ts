import {
  AI_CONTEXT_PRIORITIES,
  AI_CONTEXT_SOURCES,
  type AIContextJsonValue,
  type AIContextMetadata,
} from '../context-builder'
import {
  AI_CONTEXT_RESOLUTION_PROTOCOL_VERSION,
  AI_RESOLUTION_STRATEGIES,
  type AIContextResolutionErrorCode,
  type AIResolvedContext,
  type AIResolvedSection,
  type AIResolutionMetadata,
  type AIResolutionStrategy,
} from './aiContextResolutionContracts'

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SOURCE_SET = new Set<string>(AI_CONTEXT_SOURCES)
const PRIORITY_SET = new Set<string>(AI_CONTEXT_PRIORITIES)
const STRATEGY_SET = new Set<string>(AI_RESOLUTION_STRATEGIES)

function createError(code: AIContextResolutionErrorCode, safeMessage: string) {
  return {
    code,
    safeMessage,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidJsonValue(value: unknown, seen: ReadonlySet<object>): value is AIContextJsonValue {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (value instanceof Date || seen.has(value)) {
    return false
  }

  const nextSeen = new Set(seen)
  nextSeen.add(value)

  if (Array.isArray(value)) {
    return value.every((item) => isValidJsonValue(item, nextSeen))
  }

  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    return false
  }

  return Object.values(value).every((item) => isValidJsonValue(item, nextSeen))
}

function validateSectionMetadata(
  metadata: AIContextMetadata,
): ReturnType<typeof createError> | null {
  if (!isNonEmpty(metadata.createdAt) || !UTC_INSTANT_PATTERN.test(metadata.createdAt)) {
    return createError(
      'INVALID_RESOLVED_SECTION_METADATA',
      'The resolved section metadata creation time is invalid.',
    )
  }

  if (
    metadata.source !== 'APPLICATION' &&
    metadata.source !== 'CONVERSATION' &&
    metadata.source !== 'SYSTEM'
  ) {
    return createError(
      'INVALID_RESOLVED_SECTION_METADATA',
      'The resolved section metadata source is invalid.',
    )
  }

  if (metadata.deterministic !== true || metadata.failClosed !== true) {
    return createError(
      'INVALID_RESOLVED_SECTION_METADATA',
      'The resolved section metadata must be deterministic and fail-closed.',
    )
  }

  if (metadata.tags !== undefined && !metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError(
      'INVALID_RESOLVED_SECTION_METADATA',
      'The resolved section metadata tags are invalid.',
    )
  }

  if (metadata.attributes !== undefined && !isValidJsonValue(metadata.attributes, new Set())) {
    return createError(
      'INVALID_RESOLVED_SECTION_METADATA',
      'The resolved section metadata attributes are invalid.',
    )
  }

  return null
}

function validateResolutionMetadata(
  metadata: AIResolutionMetadata,
): ReturnType<typeof createError> | null {
  if (metadata.protocolVersion !== AI_CONTEXT_RESOLUTION_PROTOCOL_VERSION) {
    return createError(
      'INVALID_RESOLUTION_METADATA',
      'The context resolution metadata protocol version is invalid.',
    )
  }

  if (!isNonEmpty(metadata.createdAt) || !UTC_INSTANT_PATTERN.test(metadata.createdAt)) {
    return createError(
      'INVALID_RESOLUTION_METADATA',
      'The context resolution metadata creation time is invalid.',
    )
  }

  if (!isNonEmpty(metadata.sourceContextId)) {
    return createError(
      'INVALID_RESOLUTION_METADATA',
      'The context resolution source context identifier is invalid.',
    )
  }

  if (
    metadata.source !== 'APPLICATION' &&
    metadata.source !== 'CONVERSATION' &&
    metadata.source !== 'SYSTEM'
  ) {
    return createError(
      'INVALID_RESOLUTION_METADATA',
      'The context resolution metadata source is invalid.',
    )
  }

  if (metadata.deterministic !== true || metadata.failClosed !== true) {
    return createError(
      'INVALID_RESOLUTION_METADATA',
      'The context resolution metadata must be deterministic and fail-closed.',
    )
  }

  if (metadata.tags !== undefined && !metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError(
      'INVALID_RESOLUTION_METADATA',
      'The context resolution metadata tags are invalid.',
    )
  }

  if (metadata.attributes !== undefined && !isValidJsonValue(metadata.attributes, new Set())) {
    return createError(
      'INVALID_RESOLUTION_METADATA',
      'The context resolution metadata attributes are invalid.',
    )
  }

  return null
}

export function isValidResolutionStrategy(value: string): value is AIResolutionStrategy {
  return STRATEGY_SET.has(value)
}

export function isValidResolutionId(value: string): boolean {
  return /^resolved-context:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function isValidResolvedSectionId(value: string): boolean {
  return /^resolved-section:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function validateResolvedSection(section: AIResolvedSection) {
  if (!isValidResolvedSectionId(section.id)) {
    return createError(
      'INVALID_RESOLVED_SECTION_ID',
      'The resolved section identifier is invalid.',
    )
  }

  if (!SOURCE_SET.has(section.source)) {
    return createError(
      'INVALID_RESOLVED_SECTION',
      'The resolved section source is invalid.',
    )
  }

  if (!PRIORITY_SET.has(section.priority)) {
    return createError(
      'INVALID_RESOLVED_SECTION',
      'The resolved section priority is invalid.',
    )
  }

  if (!isRecord(section.content) || !isValidJsonValue(section.content, new Set())) {
    return createError(
      'INVALID_RESOLVED_SECTION_CONTENT',
      'The resolved section content is invalid.',
    )
  }

  return validateSectionMetadata(section.metadata)
}

export function validateResolvedContext(context: AIResolvedContext) {
  if (!isValidResolutionId(context.id)) {
    return createError('INVALID_RESOLUTION_ID', 'The resolution identifier is invalid.')
  }

  if (!isValidResolutionStrategy(context.strategy)) {
    return createError(
      'INVALID_RESOLUTION_STRATEGY',
      'The context resolution strategy is invalid.',
    )
  }

  const metadataValidation = validateResolutionMetadata(context.metadata)
  if (metadataValidation) {
    return metadataValidation
  }

  if (!Array.isArray(context.sections) || context.sections.length === 0) {
    return createError(
      'NO_SECTIONS_RESOLVED',
      'The context resolution produced no sections.',
    )
  }

  const seenIds = new Set<string>()
  for (const section of context.sections) {
    if (seenIds.has(section.id)) {
      return createError(
        'DUPLICATE_RESOLVED_SECTION_ID',
        'The context resolution contains duplicated section identifiers.',
      )
    }

    seenIds.add(section.id)

    const sectionValidation = validateResolvedSection(section)
    if (sectionValidation) {
      return sectionValidation
    }
  }

  return null
}

import {
  AI_CONTEXT_PRIORITIES,
  AI_CONTEXT_PROTOCOL_VERSION,
  AI_CONTEXT_SOURCES,
  type AIContext,
  type AIContextJsonValue,
  type AIContextMetadata,
  type AIContextPriority,
  type AIContextSection,
  type AIContextSource,
  type AIContextValidationError,
  type AIContextValidationErrorCode,
} from './aiContextContracts'

const SOURCE_SET = new Set<string>(AI_CONTEXT_SOURCES)
const PRIORITY_SET = new Set<string>(AI_CONTEXT_PRIORITIES)
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function createError(
  code: AIContextValidationErrorCode,
  safeMessage: string,
): AIContextValidationError {
  return { code, safeMessage }
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

function validateMetadata(metadata: AIContextMetadata): AIContextValidationError | null {
  if (metadata.protocolVersion !== AI_CONTEXT_PROTOCOL_VERSION) {
    return createError(
      'INVALID_CONTEXT_METADATA',
      'The AI context metadata protocol version is invalid.',
    )
  }

  if (!isNonEmpty(metadata.createdAt) || !UTC_INSTANT_PATTERN.test(metadata.createdAt)) {
    return createError(
      'INVALID_CONTEXT_METADATA',
      'The AI context metadata creation time is invalid.',
    )
  }

  if (
    metadata.source !== 'APPLICATION' &&
    metadata.source !== 'CONVERSATION' &&
    metadata.source !== 'SYSTEM'
  ) {
    return createError('INVALID_CONTEXT_METADATA', 'The AI context metadata source is invalid.')
  }

  if (metadata.deterministic !== true || metadata.failClosed !== true) {
    return createError(
      'INVALID_CONTEXT_METADATA',
      'The AI context metadata must be deterministic and fail-closed.',
    )
  }

  if (metadata.tags !== undefined && !metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError('INVALID_CONTEXT_METADATA', 'The AI context metadata tags are invalid.')
  }

  if (metadata.attributes !== undefined && !isValidJsonValue(metadata.attributes, new Set())) {
    return createError(
      'INVALID_CONTEXT_METADATA',
      'The AI context metadata attributes are invalid.',
    )
  }

  return null
}

export function isValidAIContextSource(value: string): value is AIContextSource {
  return SOURCE_SET.has(value)
}

export function isValidAIContextPriority(value: string): value is AIContextPriority {
  return PRIORITY_SET.has(value)
}

export function isValidAIContextId(value: string): boolean {
  return /^context:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function isValidAIContextSectionId(value: string): boolean {
  return /^context-section:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function validateAIContextSection(
  section: AIContextSection,
): AIContextValidationError | null {
  if (!isValidAIContextSectionId(section.id)) {
    return createError('INVALID_SECTION_ID', 'The AI context section identifier is invalid.')
  }

  if (!isValidAIContextSource(section.source)) {
    return createError('INVALID_SECTION_SOURCE', 'The AI context section source is invalid.')
  }

  if (!isValidAIContextPriority(section.priority)) {
    return createError('INVALID_SECTION_PRIORITY', 'The AI context section priority is invalid.')
  }

  if (!isRecord(section.content) || !isValidJsonValue(section.content, new Set())) {
    return createError('INVALID_SECTION_CONTENT', 'The AI context section content is invalid.')
  }

  const metadataValidation = validateMetadata(section.metadata)
  if (metadataValidation) {
    return createError('INVALID_SECTION_METADATA', metadataValidation.safeMessage)
  }

  return null
}

export function validateAIContext(context: AIContext): AIContextValidationError | null {
  if (!isValidAIContextId(context.id)) {
    return createError('INVALID_CONTEXT_ID', 'The AI context identifier is invalid.')
  }

  const metadataValidation = validateMetadata(context.metadata)
  if (metadataValidation) {
    return metadataValidation
  }

  if (!Array.isArray(context.sections) || context.sections.length === 0) {
    return createError(
      'INVALID_CONTEXT_SECTIONS',
      'The AI context must include at least one section.',
    )
  }

  const seenIds = new Set<string>()
  for (const section of context.sections) {
    if (seenIds.has(section.id)) {
      return createError(
        'DUPLICATE_SECTION_ID',
        'The AI context contains duplicated section identifiers.',
      )
    }

    seenIds.add(section.id)

    const sectionValidation = validateAIContextSection(section)
    if (sectionValidation) {
      return sectionValidation
    }

    if (section.metadata.createdAt < context.metadata.createdAt) {
      return createError(
        'INVALID_SECTION_ORDER',
        'The AI context section order is inconsistent.',
      )
    }
  }

  return null
}

import {
  AI_PROMPT_PRIORITIES,
  AI_PROMPT_PROTOCOL_VERSION,
  AI_PROMPT_ROLES,
  type AIPrompt,
  type AIPromptJsonValue,
  type AIPromptMetadata,
  type AIPromptPriority,
  type AIPromptRole,
  type AIPromptSegment,
  type AIPromptValidationError,
  type AIPromptValidationErrorCode,
} from './aiPromptContracts'

const ROLE_SET = new Set<string>(AI_PROMPT_ROLES)
const PRIORITY_SET = new Set<string>(AI_PROMPT_PRIORITIES)
const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function createError(
  code: AIPromptValidationErrorCode,
  safeMessage: string,
): AIPromptValidationError {
  return { code, safeMessage }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isValidJsonValue(value: unknown, seen: ReadonlySet<object>): value is AIPromptJsonValue {
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

function validateMetadata(metadata: AIPromptMetadata): AIPromptValidationError | null {
  if (metadata.protocolVersion !== AI_PROMPT_PROTOCOL_VERSION) {
    return createError(
      'INVALID_PROMPT_METADATA',
      'The AI prompt metadata protocol version is invalid.',
    )
  }

  if (!isNonEmpty(metadata.createdAt) || !UTC_INSTANT_PATTERN.test(metadata.createdAt)) {
    return createError(
      'INVALID_PROMPT_METADATA',
      'The AI prompt metadata creation time is invalid.',
    )
  }

  if (
    metadata.source !== 'APPLICATION' &&
    metadata.source !== 'CONVERSATION' &&
    metadata.source !== 'SYSTEM'
  ) {
    return createError('INVALID_PROMPT_METADATA', 'The AI prompt metadata source is invalid.')
  }

  if (metadata.deterministic !== true || metadata.failClosed !== true) {
    return createError(
      'INVALID_PROMPT_METADATA',
      'The AI prompt metadata must be deterministic and fail-closed.',
    )
  }

  if (metadata.tags !== undefined && !metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createError('INVALID_PROMPT_METADATA', 'The AI prompt metadata tags are invalid.')
  }

  if (
    metadata.attributes !== undefined &&
    !isValidJsonValue(metadata.attributes, new Set())
  ) {
    return createError(
      'INVALID_PROMPT_METADATA',
      'The AI prompt metadata attributes are invalid.',
    )
  }

  return null
}

export function isValidAIPromptRole(value: string): value is AIPromptRole {
  return ROLE_SET.has(value)
}

export function isValidAIPromptPriority(value: string): value is AIPromptPriority {
  return PRIORITY_SET.has(value)
}

export function isValidAIPromptId(value: string): boolean {
  return /^prompt:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function isValidAIPromptSegmentId(value: string): boolean {
  return /^prompt-segment:[a-z0-9]+(?:[a-z0-9:-]*[a-z0-9])?$/.test(value)
}

export function validateAIPromptSegment(
  segment: AIPromptSegment,
): AIPromptValidationError | null {
  if (!isValidAIPromptSegmentId(segment.id)) {
    return createError('INVALID_SEGMENT_ID', 'The AI prompt segment identifier is invalid.')
  }

  if (!isValidAIPromptRole(segment.role)) {
    return createError('INVALID_SEGMENT_ROLE', 'The AI prompt segment role is invalid.')
  }

  if (!isNonEmpty(segment.content)) {
    return createError('INVALID_SEGMENT_CONTENT', 'The AI prompt segment content is invalid.')
  }

  if (!isValidAIPromptPriority(segment.priority)) {
    return createError('INVALID_SEGMENT_PRIORITY', 'The AI prompt segment priority is invalid.')
  }

  const metadataValidation = validateMetadata(segment.metadata)
  if (metadataValidation) {
    return createError('INVALID_SEGMENT_METADATA', metadataValidation.safeMessage)
  }

  return null
}

export function validateAIPrompt(prompt: AIPrompt): AIPromptValidationError | null {
  if (!isValidAIPromptId(prompt.promptId)) {
    return createError('INVALID_PROMPT_ID', 'The AI prompt identifier is invalid.')
  }

  const metadataValidation = validateMetadata(prompt.metadata)
  if (metadataValidation) {
    return metadataValidation
  }

  if (!Array.isArray(prompt.segments) || prompt.segments.length === 0) {
    return createError(
      'INVALID_PROMPT_SEGMENTS',
      'The AI prompt must include at least one segment.',
    )
  }

  const seenIds = new Set<string>()
  for (let index = 0; index < prompt.segments.length; index += 1) {
    const segment = prompt.segments[index]

    if (seenIds.has(segment.id)) {
      return createError(
        'DUPLICATE_SEGMENT_ID',
        'The AI prompt contains duplicated segment identifiers.',
      )
    }

    seenIds.add(segment.id)

    const segmentValidation = validateAIPromptSegment(segment)
    if (segmentValidation) {
      return segmentValidation
    }

    if (segment.metadata.createdAt < prompt.metadata.createdAt) {
      return createError(
        'INVALID_SEGMENT_ORDER',
        'The AI prompt segment order is inconsistent.',
      )
    }
  }

  return null
}

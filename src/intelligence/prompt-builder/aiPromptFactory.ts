import type { AIConversationMessage } from '../ai-conversation/message'
import {
  AI_PROMPT_PROTOCOL_VERSION,
  type AIPrompt,
  type AIPromptFailure,
  type AIPromptId,
  type AIPromptMetadata,
  type AIPromptPriority,
  type AIPromptResult,
  type AIPromptRole,
  type AIPromptSegmentFailure,
  type AIPromptSegment,
  type AIPromptSegmentId,
  type AIPromptSegmentResult,
  type CreateAIPromptInput,
  type CreateAIPromptSegmentInput,
} from './aiPromptContracts'
import {
  isValidAIPromptId,
  isValidAIPromptSegmentId,
  validateAIPrompt,
  validateAIPromptSegment,
} from './aiPromptValidator'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function cloneMetadata(metadata: AIPromptMetadata): AIPromptMetadata {
  return {
    ...metadata,
    ...(metadata.tags === undefined ? {} : { tags: [...metadata.tags] }),
    ...(metadata.attributes === undefined
      ? {}
      : { attributes: structuredClone(metadata.attributes) }),
  }
}

function cloneSegment(segment: AIPromptSegment): AIPromptSegment {
  return {
    ...segment,
    metadata: cloneMetadata(segment.metadata),
  }
}

function createPromptFailure(
  code: AIPromptFailure['code'],
  safeMessage: string,
): AIPromptResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function createSegmentFailure(
  code: AIPromptSegmentFailure['code'],
  safeMessage: string,
): AIPromptSegmentResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function normalizeMetadata(
  input: CreateAIPromptSegmentInput['metadata'] | CreateAIPromptInput['metadata'],
): AIPromptMetadata {
  const metadata: AIPromptMetadata = {
    protocolVersion: input.protocolVersion ?? AI_PROMPT_PROTOCOL_VERSION,
    createdAt: input.createdAt,
    source: input.source,
    deterministic: input.deterministic ?? true,
    failClosed: input.failClosed ?? true,
    ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
    ...(input.attributes === undefined
      ? {}
      : { attributes: structuredClone(input.attributes) }),
  }

  return metadata
}

function conversationRoleToPromptRole(role: AIConversationMessage['role']): AIPromptRole {
  if (role === 'SYSTEM') return 'SYSTEM'
  if (role === 'USER') return 'USER'
  return 'ASSISTANT'
}

export function priorityRank(priority: AIPromptPriority): number {
  switch (priority) {
    case 'CRITICAL':
      return 0
    case 'HIGH':
      return 1
    case 'MEDIUM':
      return 2
    case 'LOW':
      return 3
  }
}

export function createPromptId(value: string): AIPromptId | null {
  const normalized = value.trim()
  if (!isValidAIPromptId(normalized)) {
    return null
  }

  return normalized as AIPromptId
}

export function createPromptSegmentId(value: string): AIPromptSegmentId | null {
  const normalized = value.trim()
  if (!isValidAIPromptSegmentId(normalized)) {
    return null
  }

  return normalized as AIPromptSegmentId
}

export function createPromptSegment(
  input: CreateAIPromptSegmentInput,
): AIPromptSegmentResult {
  const segmentId = createPromptSegmentId(input.id)
  if (!segmentId) {
    return createSegmentFailure(
      'INVALID_SEGMENT_ID',
      'The AI prompt segment identifier is invalid.',
    )
  }

  const segment: AIPromptSegment = {
    id: segmentId,
    role: input.role,
    content: input.content,
    priority: input.priority,
    metadata: normalizeMetadata(input.metadata),
  }

  const validation = validateAIPromptSegment(segment)
  if (validation) {
    return createSegmentFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    segment: deepFreeze(segment),
  }
}

export function createPrompt(input: CreateAIPromptInput): AIPromptResult {
  const promptId = createPromptId(input.promptId)
  if (!promptId) {
    return createPromptFailure('INVALID_PROMPT_ID', 'The AI prompt identifier is invalid.')
  }

  const prompt: AIPrompt = {
    protocolVersion: AI_PROMPT_PROTOCOL_VERSION,
    promptId,
    segments: input.segments.map((segment) => cloneSegment(segment)),
    metadata: normalizeMetadata(input.metadata),
  }

  const validation = validateAIPrompt(prompt)
  if (validation) {
    return createPromptFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    prompt: deepFreeze(prompt),
  }
}

export function createPromptSegmentFromConversationMessage(input: {
  readonly id: string
  readonly message: AIConversationMessage
  readonly priority?: AIPromptPriority
}): AIPromptSegmentResult {
  return createPromptSegment({
    id: input.id,
    role: conversationRoleToPromptRole(input.message.role),
    content: input.message.content.value,
    priority: input.priority ?? 'MEDIUM',
    metadata: {
      createdAt: input.message.createdAt,
      source: 'CONVERSATION',
      tags: [
        'conversation-message',
        `conversation:${input.message.conversationId}`,
        `session:${input.message.sessionId}`,
      ],
      attributes: {
        messageId: input.message.id,
        messageStatus: input.message.status,
        messageSequence: input.message.sequence,
        messageFormat: input.message.content.format,
      },
    },
  })
}

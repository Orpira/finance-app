import type { AIConversationMessage } from '../ai-conversation/message'
import type { AIConversationSessionSnapshot } from '../ai-conversation/session'
import {
  AI_CONTEXT_PROTOCOL_VERSION,
  type AIContext,
  type AIContextFailure,
  type AIContextId,
  type AIContextMetadata,
  type AIContextPriority,
  type AIContextResult,
  type AIContextSection,
  type AIContextSectionFailure,
  type AIContextSectionId,
  type AIContextSectionResult,
  type AIContextSource,
  type CreateAIContextInput,
  type CreateAIContextSectionInput,
} from './aiContextContracts'
import {
  isValidAIContextId,
  isValidAIContextSectionId,
  validateAIContext,
  validateAIContextSection,
} from './aiContextValidator'

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

function cloneSection(section: AIContextSection): AIContextSection {
  return {
    ...section,
    content: structuredClone(section.content),
    metadata: cloneMetadata(section.metadata),
  }
}

function createContextFailure(
  code: AIContextFailure['code'],
  safeMessage: string,
): AIContextResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function createSectionFailure(
  code: AIContextSectionFailure['code'],
  safeMessage: string,
): AIContextSectionResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function normalizeMetadata(
  input: CreateAIContextSectionInput['metadata'] | CreateAIContextInput['metadata'],
): AIContextMetadata {
  return {
    protocolVersion: input.protocolVersion ?? AI_CONTEXT_PROTOCOL_VERSION,
    createdAt: input.createdAt,
    source: input.source,
    deterministic: input.deterministic ?? true,
    failClosed: input.failClosed ?? true,
    ...(input.tags === undefined ? {} : { tags: [...input.tags] }),
    ...(input.attributes === undefined
      ? {}
      : { attributes: structuredClone(input.attributes) }),
  }
}

function conversationRoleToSource(role: AIConversationMessage['role']): AIContextSource {
  if (role === 'SYSTEM') {
    return 'APPLICATION'
  }

  if (role === 'USER') {
    return 'CONVERSATION'
  }

  return 'SESSION'
}

export function priorityRank(priority: AIContextPriority): number {
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

export function createContextId(value: string): AIContextId | null {
  const normalized = value.trim()
  if (!isValidAIContextId(normalized)) {
    return null
  }

  return normalized as AIContextId
}

export function createContextSectionId(value: string): AIContextSectionId | null {
  const normalized = value.trim()
  if (!isValidAIContextSectionId(normalized)) {
    return null
  }

  return normalized as AIContextSectionId
}

export function createContextSection(
  input: CreateAIContextSectionInput,
): AIContextSectionResult {
  const sectionId = createContextSectionId(input.id)
  if (!sectionId) {
    return createSectionFailure(
      'INVALID_SECTION_ID',
      'The AI context section identifier is invalid.',
    )
  }

  const section: AIContextSection = {
    id: sectionId,
    source: input.source,
    priority: input.priority,
    content: structuredClone(input.content),
    metadata: normalizeMetadata(input.metadata),
  }

  const validation = validateAIContextSection(section)
  if (validation) {
    return createSectionFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    section: deepFreeze(section),
  }
}

export function createContext(input: CreateAIContextInput): AIContextResult {
  const contextId = createContextId(input.id)
  if (!contextId) {
    return createContextFailure('INVALID_CONTEXT_ID', 'The AI context identifier is invalid.')
  }

  const context: AIContext = {
    protocolVersion: AI_CONTEXT_PROTOCOL_VERSION,
    id: contextId,
    sections: input.sections.map((section) => cloneSection(section)),
    metadata: normalizeMetadata(input.metadata),
  }

  const validation = validateAIContext(context)
  if (validation) {
    return createContextFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    context: deepFreeze(context),
  }
}

export function createContextSectionFromConversationMessage(input: {
  readonly id: string
  readonly message: AIConversationMessage
  readonly priority?: AIContextPriority
}): AIContextSectionResult {
  return createContextSection({
    id: input.id,
    source: conversationRoleToSource(input.message.role),
    priority: input.priority ?? 'NORMAL',
    content: {
      messageId: input.message.id,
      conversationId: input.message.conversationId,
      sessionId: input.message.sessionId,
      role: input.message.role,
      content: input.message.content.value,
      format: input.message.content.format,
      status: input.message.status,
      sequence: input.message.sequence,
      createdAt: input.message.createdAt,
    },
    metadata: {
      createdAt: input.message.createdAt,
      source: 'CONVERSATION',
      tags: ['conversation-message'],
    },
  })
}

export function createContextSectionFromSession(input: {
  readonly id: string
  readonly session: AIConversationSessionSnapshot
  readonly priority?: AIContextPriority
}): AIContextSectionResult {
  return createContextSection({
    id: input.id,
    source: 'SESSION',
    priority: input.priority ?? 'HIGH',
    content: {
      sessionId: input.session.sessionId,
      conversationId: input.session.conversation.conversationId,
      sessionStatus: input.session.status,
      participantCount: input.session.participants.length,
      messageCount: input.session.messages.length,
      interactionState: input.session.interaction?.lifecycleState ?? null,
      policyDecision: input.session.interaction?.policyDecision ?? null,
    },
    metadata: {
      createdAt: input.session.metadata.createdAt,
      source: 'APPLICATION',
      tags: ['conversation-session'],
    },
  })
}

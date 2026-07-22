import {
  validateAIConversationMessage,
  AIConversationSessionValidator,
} from '../ai-conversation'
import { validateAIContext } from '../context-builder'
import { validateAIExecutionRequest } from '../execution-pipeline'
import { validateResolvedContext } from '../context-resolution'
import { validateAIPrompt } from '../prompt-builder'
import {
  validateAIProviderRequest,
  validateAIProviderResponse,
} from '../provider'
import {
  AI_EXECUTION_INSPECTOR_ERROR_CODES,
  AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION,
  AI_EXECUTION_STAGE_NAMES,
  AI_EXECUTION_STAGE_STATUSES,
  AI_EXECUTION_TRACE_STATUSES,
  type AIExecutionInspectorErrorCode,
  type AIExecutionInspectorFailure,
  type AIExecutionSnapshot,
  type AIExecutionStage,
  type AIExecutionStageName,
  type AIExecutionStageStatus,
  type AIExecutionTrace,
  type AIExecutionTraceStatus,
} from './aiExecutionInspectorContracts'

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const STAGE_NAME_SET = new Set<string>(AI_EXECUTION_STAGE_NAMES)
const STAGE_STATUS_SET = new Set<string>(AI_EXECUTION_STAGE_STATUSES)
const TRACE_STATUS_SET = new Set<string>(AI_EXECUTION_TRACE_STATUSES)

function createFailure(
  code: AIExecutionInspectorErrorCode,
  safeMessage: string,
): AIExecutionInspectorFailure {
  if (!AI_EXECUTION_INSPECTOR_ERROR_CODES.includes(code)) {
    throw new Error(`Unknown execution inspector error code: ${code}`)
  }

  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isValidJsonValue(value: unknown, seen: ReadonlySet<object>): boolean {
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

export function isValidAIExecutionStageName(value: string): value is AIExecutionStageName {
  return STAGE_NAME_SET.has(value)
}

export function isValidAIExecutionStageStatus(value: string): value is AIExecutionStageStatus {
  return STAGE_STATUS_SET.has(value)
}

export function isValidAIExecutionTraceStatus(value: string): value is AIExecutionTraceStatus {
  return TRACE_STATUS_SET.has(value)
}

function validateSnapshotMetadata(snapshot: AIExecutionSnapshot) {
  if (snapshot.protocolVersion !== AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION) {
    return createFailure('INVALID_SNAPSHOT', 'The execution snapshot protocol version is invalid.')
  }

  if (!isNonEmpty(snapshot.createdAt) || !UTC_INSTANT_PATTERN.test(snapshot.createdAt)) {
    return createFailure('INVALID_TIMESTAMP', 'The execution snapshot creation time is invalid.')
  }

  if (snapshot.source !== 'SYSTEM') {
    return createFailure('INVALID_SNAPSHOT', 'The execution snapshot source is invalid.')
  }

  if (snapshot.deterministic !== true || snapshot.failClosed !== true) {
    return createFailure('INVALID_SNAPSHOT', 'The execution snapshot flags are invalid.')
  }

  return null
}

export function validateAIExecutionSnapshot(snapshot: AIExecutionSnapshot) {
  const metadataValidation = validateSnapshotMetadata(snapshot)
  if (metadataValidation) {
    return metadataValidation
  }

  if (snapshot.executionRequest) {
    const validation = validateAIExecutionRequest(snapshot.executionRequest)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (snapshot.context) {
    const validation = validateAIContext(snapshot.context)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (snapshot.resolvedContext) {
    const validation = validateResolvedContext(snapshot.resolvedContext)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (snapshot.prompt) {
    const validation = validateAIPrompt(snapshot.prompt)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (snapshot.providerRequest) {
    const validation = validateAIProviderRequest(snapshot.providerRequest)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (snapshot.providerResponse) {
    const validation = validateAIProviderResponse(snapshot.providerResponse)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (snapshot.assistantMessage) {
    const validation = validateAIConversationMessage(snapshot.assistantMessage)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (snapshot.session) {
    const validation = new AIConversationSessionValidator().validate(snapshot.session)
    if (validation) {
      return createFailure('INVALID_SNAPSHOT_CONTENT', validation.safeMessage)
    }
  }

  if (
    snapshot.failure !== undefined &&
    (!isNonEmpty(snapshot.failure.code) || !isNonEmpty(snapshot.failure.safeMessage))
  ) {
    return createFailure('INVALID_SNAPSHOT_CONTENT', 'The execution snapshot failure payload is invalid.')
  }

  return null
}

export function validateAIExecutionStage(stage: AIExecutionStage) {
  if (!isValidAIExecutionStageName(stage.name)) {
    return createFailure('INVALID_STAGE_NAME', 'The execution stage name is invalid.')
  }

  if (!isValidAIExecutionStageStatus(stage.status)) {
    return createFailure('INVALID_STAGE_STATUS', 'The execution stage status is invalid.')
  }

  if (!Number.isSafeInteger(stage.duration) || stage.duration < 0) {
    return createFailure('INVALID_STAGE_DURATION', 'The execution stage duration is invalid.')
  }

  if (stage.startedAt !== null && (!isNonEmpty(stage.startedAt) || !UTC_INSTANT_PATTERN.test(stage.startedAt))) {
    return createFailure('INVALID_TIMESTAMP', 'The execution stage start time is invalid.')
  }

  if (stage.finishedAt !== null && (!isNonEmpty(stage.finishedAt) || !UTC_INSTANT_PATTERN.test(stage.finishedAt))) {
    return createFailure('INVALID_TIMESTAMP', 'The execution stage finish time is invalid.')
  }

  if ((stage.startedAt === null) !== (stage.finishedAt === null)) {
    return createFailure('INVALID_TIMESTAMP', 'The execution stage timestamps are inconsistent.')
  }

  if (stage.startedAt !== null && stage.finishedAt !== null && stage.finishedAt < stage.startedAt) {
    return createFailure('INVALID_TIMESTAMP', 'The execution stage timestamps are inconsistent.')
  }

  const snapshotValidation = validateAIExecutionSnapshot(stage.snapshot)
  if (snapshotValidation) {
    return snapshotValidation
  }

  if (stage.status === 'PENDING' && (stage.startedAt !== null || stage.finishedAt !== null || stage.duration !== 0)) {
    return createFailure('INVALID_STAGE', 'A pending execution stage must not include timing information.')
  }

  return null
}

export function validateAIExecutionTrace(trace: AIExecutionTrace) {
  if (trace.protocolVersion !== AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION) {
    return createFailure('INVALID_TRACE', 'The execution trace protocol version is invalid.')
  }

  if (!isNonEmpty(trace.id)) {
    return createFailure('INVALID_TRACE_ID', 'The execution trace identifier is invalid.')
  }

  if (!isNonEmpty(trace.startedAt) || !UTC_INSTANT_PATTERN.test(trace.startedAt)) {
    return createFailure('INVALID_TIMESTAMP', 'The execution trace start time is invalid.')
  }

  if (trace.finishedAt !== null && (!isNonEmpty(trace.finishedAt) || !UTC_INSTANT_PATTERN.test(trace.finishedAt))) {
    return createFailure('INVALID_TIMESTAMP', 'The execution trace finish time is invalid.')
  }

  if (trace.finishedAt !== null && trace.finishedAt < trace.startedAt) {
    return createFailure('INVALID_TIMESTAMP', 'The execution trace timestamps are inconsistent.')
  }

  const metadata = trace.metadata
  if (metadata.protocolVersion !== AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION) {
    return createFailure('INVALID_TRACE_METADATA', 'The execution trace metadata protocol version is invalid.')
  }

  if (metadata.source !== 'SYSTEM' || metadata.deterministic !== true || metadata.failClosed !== true) {
    return createFailure('INVALID_TRACE_METADATA', 'The execution trace metadata is invalid.')
  }

  if (!isValidAIExecutionTraceStatus(metadata.status)) {
    return createFailure('INVALID_TRACE_METADATA', 'The execution trace status is invalid.')
  }

  if (
    !isNonEmpty(metadata.conversationId) ||
    !isNonEmpty(metadata.sessionId) ||
    !isNonEmpty(metadata.providerId) ||
    !isNonEmpty(metadata.model)
  ) {
    return createFailure('INVALID_TRACE_METADATA', 'The execution trace metadata is invalid.')
  }

  if (metadata.tags !== undefined && !metadata.tags.every((tag) => isNonEmpty(tag))) {
    return createFailure('INVALID_TRACE_METADATA', 'The execution trace metadata tags are invalid.')
  }

  if (
    metadata.attributes !== undefined &&
    !isValidJsonValue(metadata.attributes, new Set())
  ) {
    return createFailure('INVALID_TRACE_METADATA', 'The execution trace metadata attributes are invalid.')
  }

  if (!Array.isArray(trace.stages) || trace.stages.length !== AI_EXECUTION_STAGE_NAMES.length) {
    return createFailure('INVALID_STAGE_ORDER', 'The execution trace stages are incomplete.')
  }

  const expectedNames = [...AI_EXECUTION_STAGE_NAMES]
  for (let index = 0; index < trace.stages.length; index += 1) {
    const stage = trace.stages[index]
    const stageValidation = validateAIExecutionStage(stage)
    if (stageValidation) {
      return stageValidation
    }

    if (stage.name !== expectedNames[index]) {
      return createFailure('INVALID_STAGE_ORDER', 'The execution trace stage order is invalid.')
    }

    if (stage.startedAt !== null && stage.startedAt < trace.startedAt) {
      return createFailure('INVALID_TIMESTAMP', 'The execution trace stage timestamps are inconsistent.')
    }

    if (trace.finishedAt !== null && stage.finishedAt !== null && stage.finishedAt > trace.finishedAt) {
      return createFailure('INVALID_TIMESTAMP', 'The execution trace stage timestamps are inconsistent.')
    }
  }

  return null
}

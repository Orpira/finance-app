import {
  AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION,
  type AIExecutionInspectorErrorCode,
  type AIExecutionInspectorFailure,
  type AIExecutionSnapshot,
  type AIExecutionSnapshotResult,
  type AIExecutionStage,
  type AIExecutionStageResult,
  type AIExecutionTrace,
  type AIExecutionTraceResult,
  type CreateAIExecutionSnapshotInput,
  type CreateAIExecutionStageInput,
  type CreateAIExecutionTraceInput,
} from './aiExecutionInspectorContracts'
import {
  validateAIExecutionSnapshot,
  validateAIExecutionStage,
  validateAIExecutionTrace,
} from './aiExecutionInspectorValidator'

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested)
  }

  return Object.freeze(value)
}

function createFailure(
  code: AIExecutionInspectorErrorCode,
  safeMessage: string,
): AIExecutionInspectorFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function cloneOptional<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value)
}

export function createSnapshot(
  input: CreateAIExecutionSnapshotInput,
): AIExecutionSnapshotResult {
  const snapshot: AIExecutionSnapshot = {
    protocolVersion: AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION,
    createdAt: input.createdAt,
    source: 'SYSTEM',
    deterministic: true,
    failClosed: true,
    ...(input.executionRequest === undefined
      ? {}
      : { executionRequest: cloneOptional(input.executionRequest) }),
    ...(input.context === undefined ? {} : { context: cloneOptional(input.context) }),
    ...(input.resolvedContext === undefined
      ? {}
      : { resolvedContext: cloneOptional(input.resolvedContext) }),
    ...(input.prompt === undefined ? {} : { prompt: cloneOptional(input.prompt) }),
    ...(input.providerRequest === undefined
      ? {}
      : { providerRequest: cloneOptional(input.providerRequest) }),
    ...(input.providerResponse === undefined
      ? {}
      : { providerResponse: cloneOptional(input.providerResponse) }),
    ...(input.assistantMessage === undefined
      ? {}
      : { assistantMessage: cloneOptional(input.assistantMessage) }),
    ...(input.session === undefined ? {} : { session: cloneOptional(input.session) }),
    ...(input.failure === undefined ? {} : { failure: structuredClone(input.failure) }),
  }

  const validation = validateAIExecutionSnapshot(snapshot)
  if (validation) {
    return createFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    snapshot: deepFreeze(snapshot),
  }
}

export function createStage(
  input: CreateAIExecutionStageInput,
): AIExecutionStageResult {
  const stage: AIExecutionStage = {
    name: input.name,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    duration: input.duration,
    snapshot: structuredClone(input.snapshot),
  }

  const validation = validateAIExecutionStage(stage)
  if (validation) {
    return createFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    stage: deepFreeze(stage),
  }
}

export function createTrace(
  input: CreateAIExecutionTraceInput,
): AIExecutionTraceResult {
  const trace: AIExecutionTrace = {
    protocolVersion: AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION,
    id: input.id,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt ?? null,
    stages: input.stages.map((stage) => structuredClone(stage)),
    metadata: {
      protocolVersion: input.metadata.protocolVersion ?? AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION,
      source: input.metadata.source ?? 'SYSTEM',
      deterministic: input.metadata.deterministic ?? true,
      failClosed: input.metadata.failClosed ?? true,
      status: input.metadata.status,
      conversationId: input.metadata.conversationId,
      sessionId: input.metadata.sessionId,
      providerId: input.metadata.providerId,
      model: input.metadata.model,
      ...(input.metadata.tags === undefined ? {} : { tags: [...input.metadata.tags] }),
      ...(input.metadata.attributes === undefined
        ? {}
        : { attributes: structuredClone(input.metadata.attributes) }),
    },
  }

  const validation = validateAIExecutionTrace(trace)
  if (validation) {
    return createFailure(validation.code, validation.safeMessage)
  }

  return {
    kind: 'success',
    trace: deepFreeze(trace),
  }
}

import type {
  AIConversationExecution,
  AIConversationFacade,
  AIConversationFacadeFailure,
  AIConversationRequest,
} from '../../intelligence/ai-conversation'
import {
  validateAIConversationRequest,
  validateAIConversationResponse,
} from '../../intelligence/ai-conversation'
import {
  type ChatMessage,
  type MockConversationalRenderer,
  validateChatMessage,
} from '../../intelligence/mock-conversational-renderer/mockConversationalRenderer'
import type { PromptContext } from '../../intelligence/prompt-context-builder'
import type { ConversationResponse } from '../../intelligence/response-composer'

export type AIDeveloperPlaygroundStage =
  | 'conversation-request'
  | 'conversation-orchestrator'
  | 'prompt-context-builder'
  | 'response-composer'
  | 'mock-conversational-renderer'

export interface AIDeveloperPlaygroundError {
  readonly stage: AIDeveloperPlaygroundStage
  readonly code: string
  readonly safeMessage: string
}

export type AIDeveloperPlaygroundStatus = 'idle' | 'running' | 'ready' | 'error'

export interface AIDeveloperPlaygroundState {
  readonly status: AIDeveloperPlaygroundStatus
  readonly requestDraft: string
  readonly submittedAt: string | null
  readonly request: AIConversationRequest | null
  readonly executionResult: AIConversationExecution | null
  readonly promptContext: PromptContext | null
  readonly response: ConversationResponse | null
  readonly renderedMessage: ChatMessage | null
  readonly error: AIDeveloperPlaygroundError | null
}

export interface AIDeveloperPlaygroundControllerDependencies {
  readonly facade: AIConversationFacade
  readonly renderer: MockConversationalRenderer
  readonly now?: () => string
  readonly createInitialDraft: () => AIConversationRequest
}

export interface AIDeveloperPlaygroundController {
  getState(): AIDeveloperPlaygroundState
  subscribe(listener: (state: AIDeveloperPlaygroundState) => void): () => void
  updateRequestDraft(draft: string): void
  run(): Promise<void>
  dispose(): void
}

const INITIAL_STATE: Omit<
  AIDeveloperPlaygroundState,
  'requestDraft'
> = {
  status: 'idle',
  submittedAt: null,
  request: null,
  executionResult: null,
  promptContext: null,
  response: null,
  renderedMessage: null,
  error: null,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function toExecutionResult(response: ConversationResponse): AIConversationExecution {
  const promptContext = response.promptContext
  const successfulSteps = promptContext.steps.filter((step) => step.kind === 'success').length
  const failedSteps = promptContext.steps.length - successfulSteps

  return {
    executionId: promptContext.execution.executionId,
    startedAt: promptContext.execution.startedAt,
    finishedAt: promptContext.execution.finishedAt,
    status: promptContext.execution.status,
    summary: {
      totalSteps: promptContext.steps.length,
      successfulSteps,
      failedSteps,
    },
    steps: promptContext.steps.map((step) => {
      if (step.kind === 'success') {
        return {
          kind: 'success' as const,
          stepId: step.stepId,
          order: step.order,
          toolId: step.toolId,
          resolvedToolName: step.resolvedToolName,
          execution: {
            toolName: step.resolvedToolName,
            output: structuredClone(step.output),
            permission: step.permission,
            durationMs: step.durationMs,
          },
        }
      }

      return {
        kind: 'failure' as const,
        stepId: step.stepId,
        order: step.order,
        toolId: step.toolId,
        error: {
          ...step.error,
          ...(step.error.details === undefined
            ? {}
            : { details: structuredClone(step.error.details) }),
        },
      }
    }),
  }
}

function mapFailureToStage(code: AIConversationFacadeFailure['code']): AIDeveloperPlaygroundStage {
  if (code === 'CONVERSATION_ORCHESTRATION_FAILED' || code === 'INVALID_CONVERSATION_EXECUTION_RESULT') {
    return 'conversation-orchestrator'
  }

  if (code === 'PROMPT_CONTEXT_BUILD_FAILED' || code === 'INVALID_PROMPT_CONTEXT') {
    return 'prompt-context-builder'
  }

  if (code === 'CONVERSATION_RESPONSE_BUILD_FAILED' || code === 'INVALID_CONVERSATION_RESPONSE') {
    return 'response-composer'
  }

  return 'conversation-request'
}

function parseRequestDraft(draft: string):
  | { readonly kind: 'success'; readonly request: AIConversationRequest }
  | { readonly kind: 'failure'; readonly error: AIDeveloperPlaygroundError } {
  let parsed: unknown
  try {
    parsed = JSON.parse(draft)
  } catch {
    return {
      kind: 'failure',
      error: {
        stage: 'conversation-request',
        code: 'INVALID_JSON',
        safeMessage: 'La solicitud no es JSON valido.',
      },
    }
  }

  if (!isRecord(parsed)) {
    return {
      kind: 'failure',
      error: {
        stage: 'conversation-request',
        code: 'INVALID_REQUEST_SHAPE',
        safeMessage: 'La solicitud debe ser un objeto JSON.',
      },
    }
  }

  const request = parsed as unknown as AIConversationRequest
  const validation = validateAIConversationRequest(request)
  if (validation) {
    return {
      kind: 'failure',
      error: {
        stage: 'conversation-request',
        code: validation.code,
        safeMessage: validation.safeMessage,
      },
    }
  }

  return {
    kind: 'success',
    request,
  }
}

export function validateAIDeveloperPlaygroundState(
  state: AIDeveloperPlaygroundState,
): AIDeveloperPlaygroundError | null {
  if (state.status === 'ready') {
    if (state.request === null || state.executionResult === null || state.promptContext === null || state.response === null) {
      return {
        stage: 'response-composer',
        code: 'INVALID_VISUAL_STATE',
        safeMessage: 'El estado visual del playground es inconsistente.',
      }
    }

    if (state.renderedMessage === null) {
      return {
        stage: 'mock-conversational-renderer',
        code: 'INVALID_VISUAL_STATE',
        safeMessage: 'El estado visual del playground no incluye mensaje renderizado.',
      }
    }

    const responseValidation = validateAIConversationResponse(state.response)
    if (responseValidation) {
      return {
        stage: 'response-composer',
        code: responseValidation.code,
        safeMessage: responseValidation.safeMessage,
      }
    }

    const renderedMessageValidation = validateChatMessage(state.renderedMessage)
    if (renderedMessageValidation) {
      return {
        stage: 'mock-conversational-renderer',
        code: renderedMessageValidation.code,
        safeMessage: renderedMessageValidation.safeMessage,
      }
    }
  }

  if (state.status === 'error' && state.error === null) {
    return {
      stage: 'response-composer',
      code: 'MISSING_ERROR',
      safeMessage: 'El playground esta en error sin detalle de error.',
    }
  }

  return null
}

export function createAIDeveloperPlaygroundController(
  dependencies: AIDeveloperPlaygroundControllerDependencies,
): AIDeveloperPlaygroundController {
  const now = dependencies.now ?? (() => new Date().toISOString())
  const listeners = new Set<(state: AIDeveloperPlaygroundState) => void>()

  let disposed = false
  let state: AIDeveloperPlaygroundState = {
    ...INITIAL_STATE,
    requestDraft: safeStringify(dependencies.createInitialDraft()),
  }

  function emit(nextState: AIDeveloperPlaygroundState): void {
    if (disposed) {
      return
    }

    state = nextState
    for (const listener of listeners) {
      listener(state)
    }
  }

  return {
    getState() {
      return state
    },

    subscribe(listener) {
      listeners.add(listener)
      listener(state)

      return () => {
        listeners.delete(listener)
      }
    },

    updateRequestDraft(draft) {
      emit({
        ...state,
        requestDraft: draft,
      })
    },

    async run() {
      const parsed = parseRequestDraft(state.requestDraft)
      const submittedAt = now()

      if (parsed.kind === 'failure') {
        emit({
          ...state,
          status: 'error',
          submittedAt,
          error: parsed.error,
        })
        return
      }

      emit({
        ...state,
        status: 'running',
        submittedAt,
        request: parsed.request,
        error: null,
      })

      const result = await dependencies.facade.execute(parsed.request)
      if (result.kind === 'failure') {
        emit({
          ...state,
          status: 'error',
          submittedAt,
          request: parsed.request,
          error: {
            stage: mapFailureToStage(result.code),
            code: result.code,
            safeMessage: result.safeMessage,
          },
        })
        return
      }

      const responseValidation = validateAIConversationResponse(result.response)
      if (responseValidation) {
        emit({
          ...state,
          status: 'error',
          submittedAt,
          request: parsed.request,
          error: {
            stage: 'response-composer',
            code: responseValidation.code,
            safeMessage: responseValidation.safeMessage,
          },
        })
        return
      }

      const renderedResult = dependencies.renderer.render(result.response)
      if (renderedResult.kind === 'failure') {
        emit({
          ...state,
          status: 'error',
          submittedAt,
          request: parsed.request,
          error: {
            stage: 'mock-conversational-renderer',
            code: renderedResult.code,
            safeMessage: renderedResult.safeMessage,
          },
        })
        return
      }

      emit({
        ...state,
        status: 'ready',
        submittedAt,
        request: parsed.request,
        executionResult: toExecutionResult(result.response),
        promptContext: result.response.promptContext,
        response: result.response,
        renderedMessage: renderedResult.message,
        error: null,
      })
    },

    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}

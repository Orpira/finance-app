import type {
  AIConversationMessage,
  AIConversationSessionSnapshot,
} from '../ai-conversation'
import {
  createPrompt,
  type AIPrompt,
} from '../prompt-builder'
import { createProviderRequest } from '../provider'
import type {
  AIExecutionFailure,
  AIExecutionPipeline,
  AIExecutionPipelineDependencies,
  AIExecutionResult,
  AIExecutionErrorCode,
  AIExecutionRequest,
} from './aiExecutionContracts'
import {
  createExecutionResponse,
} from './aiExecutionFactory'
import {
  validateAIExecutionRequest,
} from './aiExecutionValidator'

function nowIso(): string {
  return new Date().toISOString()
}

function nowMs(): number {
  return Date.now()
}

function debugConversationBoundary(event: string, payload: Record<string, unknown>): void {
  // Temporal: trazas sanitizadas para auditar pérdida de estado entre provider, pipeline y UI.
  console.info('[ConversationTrace]', event, payload)
}

function safeBeginTrace(dependencies: AIExecutionPipelineDependencies, request: AIExecutionRequest): void {
  try {
    dependencies.inspector?.beginTrace({
      id: request.id,
      startedAt: nowIso(),
      metadata: {
        conversationId: request.conversation.conversationId,
        sessionId: request.session.sessionId,
        providerId: request.metadata.providerId,
        model: request.metadata.model,
        tags: [
          'execution-inspector',
          `execution:${request.id}`,
        ],
      },
    })
  } catch {
    return
  }
}

function safeCaptureStage(
  dependencies: AIExecutionPipelineDependencies,
  input: Parameters<NonNullable<AIExecutionPipelineDependencies['inspector']>['captureStage']>[0],
): void {
  try {
    dependencies.inspector?.captureStage(input)
  } catch {
    return
  }
}

function safeFinishTrace(
  dependencies: AIExecutionPipelineDependencies,
  status: 'SUCCESS' | 'FAILED',
): void {
  try {
    dependencies.inspector?.finishTrace({
      finishedAt: nowIso(),
      status,
    })
  } catch {
    return
  }
}

function normalizeIdentifierFragment(value: string): string {
  return value.replace(/[^a-z0-9:-]/gi, '-').toLowerCase()
}

function createFailure(
  code: AIExecutionErrorCode,
  safeMessage: string,
  retryable = false,
  details?: AIExecutionFailure['details'],
): AIExecutionFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
    ...(details === undefined ? {} : { details }),
  }
}

function providerRequestIdFromExecution(request: AIExecutionRequest): string {
  return `provider-request:execution:${normalizeIdentifierFragment(request.id)}`
}

function assistantMessageIdFromExecution(request: AIExecutionRequest): string {
  return `message:execution:${normalizeIdentifierFragment(request.id)}:assistant`
}

function toolResultPromptSegmentId(request: AIExecutionRequest): string {
  return `prompt-segment:tool-result:${normalizeIdentifierFragment(request.id)}`
}

function providerToolRequestIdFromExecution(request: AIExecutionRequest): string {
  return `provider-request:execution:${normalizeIdentifierFragment(request.id)}:tool-result`
}

function createToolResultPrompt(
  prompt: AIPrompt,
  request: AIExecutionRequest,
  output: {
    readonly toolName: string
    readonly output: unknown
    readonly durationMs: number
    readonly permission: string
  },
): { kind: 'success'; prompt: AIPrompt } | AIExecutionFailure {
  const enriched = createPrompt({
    promptId: prompt.promptId,
    segments: [
      ...prompt.segments,
      {
        id: toolResultPromptSegmentId(request) as AIPrompt['segments'][number]['id'],
        role: 'CONTEXT',
        content: JSON.stringify({
          type: 'tool_result',
          toolName: output.toolName,
          output: output.output,
          durationMs: output.durationMs,
          permission: output.permission,
        }),
        priority: 'HIGH',
        metadata: {
          protocolVersion: prompt.metadata.protocolVersion,
          createdAt: request.metadata.createdAt,
          source: 'APPLICATION',
          deterministic: true,
          failClosed: true,
          tags: [
            'tool-calling',
            `tool:${output.toolName}`,
          ],
          attributes: {
            executionId: request.id,
            toolName: output.toolName,
          },
        },
      },
    ],
    metadata: {
      protocolVersion: prompt.metadata.protocolVersion,
      createdAt: prompt.metadata.createdAt,
      source: prompt.metadata.source,
      deterministic: true,
      failClosed: true,
      ...(prompt.metadata.tags === undefined ? {} : { tags: [...prompt.metadata.tags] }),
      ...(prompt.metadata.attributes === undefined
        ? {}
        : { attributes: structuredClone(prompt.metadata.attributes) }),
    },
  })

  if (enriched.kind === 'failure') {
    return createFailure(
      'TOOL_EXECUTION_FAILED',
      'The tool result could not be transformed into a valid follow-up prompt.',
      false,
      { promptErrorCode: enriched.code },
    )
  }

  return {
    kind: 'success',
    prompt: enriched.prompt,
  }
}

function mapConversationFailure(
  failure: { readonly code: string; readonly safeMessage: string },
): AIExecutionFailure {
  return createFailure(
    'CONVERSATION_UPDATE_FAILED',
    failure.safeMessage,
    false,
    { conversationErrorCode: failure.code },
  )
}

function createAssistantMessage(
  dependencies: AIExecutionPipelineDependencies,
  request: AIExecutionRequest,
  session: AIConversationSessionSnapshot,
  content: string,
): { kind: 'success'; message: AIConversationMessage } | AIExecutionFailure {
  const created = dependencies.conversationPort.createAssistantMessage({
    id: assistantMessageIdFromExecution(request),
    conversationId: request.conversation.conversationId,
    sessionId: request.session.sessionId,
    content: {
      value: content,
    },
    sequence: session.messages.length,
    createdAt: request.metadata.createdAt,
    metadata: {
      generatedLocally: false,
      correlationId: request.id,
      tags: [
        'execution-pipeline',
        `provider:${request.metadata.providerId.toLowerCase()}`,
      ],
    },
  })

  if (created.kind === 'failure') {
    return mapConversationFailure(created)
  }

  return {
    kind: 'success',
    message: created.value,
  }
}

export function createAIExecutionPipeline(
  dependencies: AIExecutionPipelineDependencies,
): AIExecutionPipeline {
  return {
    async execute(request) {
      safeBeginTrace(dependencies, request)

      const requestValidation = validateAIExecutionRequest(request)
      if (requestValidation) {
        safeFinishTrace(dependencies, 'FAILED')
        return createFailure(requestValidation.code, requestValidation.safeMessage)
      }

      const contextBuildStartedAt = nowIso()
      const contextBuildStartedMs = nowMs()
      const builtContext = dependencies.contextBuilder.buildContext({ request })
      if (builtContext.kind === 'failure') {
        safeCaptureStage(dependencies, {
          name: 'CONTEXT_BUILD',
          status: 'FAILED',
          startedAt: contextBuildStartedAt,
          finishedAt: nowIso(),
          duration: Math.max(0, nowMs() - contextBuildStartedMs),
          snapshot: {
            createdAt: nowIso(),
            executionRequest: request,
            failure: {
              code: builtContext.code,
              safeMessage: builtContext.safeMessage,
            },
          },
        })
        safeFinishTrace(dependencies, 'FAILED')
        return createFailure(
          'CONTEXT_BUILD_FAILED',
          builtContext.safeMessage,
          builtContext.retryable,
          { contextErrorCode: builtContext.code },
        )
      }

      safeCaptureStage(dependencies, {
        name: 'CONTEXT_BUILD',
        status: 'SUCCESS',
        startedAt: contextBuildStartedAt,
        finishedAt: nowIso(),
        duration: Math.max(0, nowMs() - contextBuildStartedMs),
        snapshot: {
          createdAt: nowIso(),
          executionRequest: request,
          context: builtContext.context,
        },
      })

      const contextResolutionStartedAt = nowIso()
      const contextResolutionStartedMs = nowMs()
      const resolvedContext = dependencies.contextResolver.resolveContext({
        request,
        context: builtContext.context,
      })
      if (resolvedContext.kind === 'failure') {
        safeCaptureStage(dependencies, {
          name: 'CONTEXT_RESOLUTION',
          status: 'FAILED',
          startedAt: contextResolutionStartedAt,
          finishedAt: nowIso(),
          duration: Math.max(0, nowMs() - contextResolutionStartedMs),
          snapshot: {
            createdAt: nowIso(),
            context: builtContext.context,
            failure: {
              code: resolvedContext.code,
              safeMessage: resolvedContext.safeMessage,
            },
          },
        })
        safeFinishTrace(dependencies, 'FAILED')
        return createFailure(
          'CONTEXT_RESOLUTION_FAILED',
          resolvedContext.safeMessage,
          resolvedContext.retryable,
          { resolutionErrorCode: resolvedContext.code },
        )
      }

      safeCaptureStage(dependencies, {
        name: 'CONTEXT_RESOLUTION',
        status: 'SUCCESS',
        startedAt: contextResolutionStartedAt,
        finishedAt: nowIso(),
        duration: Math.max(0, nowMs() - contextResolutionStartedMs),
        snapshot: {
          createdAt: nowIso(),
          context: builtContext.context,
          resolvedContext: resolvedContext.resolvedContext,
        },
      })

      const promptBuildStartedAt = nowIso()
      const promptBuildStartedMs = nowMs()
      const prompt = dependencies.promptBuilder.buildPrompt({
        request,
        context: builtContext.context,
        resolvedContext: resolvedContext.resolvedContext,
      })
      if (prompt.kind === 'failure') {
        safeCaptureStage(dependencies, {
          name: 'PROMPT_BUILD',
          status: 'FAILED',
          startedAt: promptBuildStartedAt,
          finishedAt: nowIso(),
          duration: Math.max(0, nowMs() - promptBuildStartedMs),
          snapshot: {
            createdAt: nowIso(),
            resolvedContext: resolvedContext.resolvedContext,
            failure: {
              code: prompt.code,
              safeMessage: prompt.safeMessage,
            },
          },
        })
        safeFinishTrace(dependencies, 'FAILED')
        return createFailure(
          'PROMPT_BUILD_FAILED',
          prompt.safeMessage,
          prompt.retryable,
          { promptErrorCode: prompt.code },
        )
      }

      safeCaptureStage(dependencies, {
        name: 'PROMPT_BUILD',
        status: 'SUCCESS',
        startedAt: promptBuildStartedAt,
        finishedAt: nowIso(),
        duration: Math.max(0, nowMs() - promptBuildStartedMs),
        snapshot: {
          createdAt: nowIso(),
          resolvedContext: resolvedContext.resolvedContext,
          prompt: prompt.prompt,
        },
      })

      const providerRequestStartedAt = nowIso()
      const providerRequestStartedMs = nowMs()
      const providerRequest = createProviderRequest({
        id: providerRequestIdFromExecution(request),
        prompt: prompt.prompt,
        metadata: {
          createdAt: request.metadata.createdAt,
          source: request.metadata.source,
          providerId: request.metadata.providerId,
          model: request.metadata.model,
          ...(request.metadata.temperature === undefined
            ? {}
            : { temperature: request.metadata.temperature }),
          ...(request.metadata.maxOutputTokens === undefined
            ? {}
            : { maxOutputTokens: request.metadata.maxOutputTokens }),
          ...(request.metadata.timeoutMs === undefined
            ? {}
            : { timeoutMs: request.metadata.timeoutMs }),
          ...(request.metadata.responseFormat === undefined
            ? {}
            : { responseFormat: request.metadata.responseFormat }),
          tags: [
            'execution-pipeline',
            `execution:${request.id}`,
          ],
          attributes: {
            executionId: request.id,
          },
        },
      })
      if (providerRequest.kind === 'failure') {
        safeCaptureStage(dependencies, {
          name: 'PROVIDER_REQUEST',
          status: 'FAILED',
          startedAt: providerRequestStartedAt,
          finishedAt: nowIso(),
          duration: Math.max(0, nowMs() - providerRequestStartedMs),
          snapshot: {
            createdAt: nowIso(),
            prompt: prompt.prompt,
            failure: {
              code: providerRequest.code,
              safeMessage: providerRequest.safeMessage,
            },
          },
        })
        safeFinishTrace(dependencies, 'FAILED')
        return createFailure(
          'PROVIDER_EXECUTION_FAILED',
          providerRequest.safeMessage,
          providerRequest.retryable,
          { providerRequestErrorCode: providerRequest.code },
        )
      }

      safeCaptureStage(dependencies, {
        name: 'PROVIDER_REQUEST',
        status: 'SUCCESS',
        startedAt: providerRequestStartedAt,
        finishedAt: nowIso(),
        duration: Math.max(0, nowMs() - providerRequestStartedMs),
        snapshot: {
          createdAt: nowIso(),
          prompt: prompt.prompt,
          providerRequest: providerRequest.request,
        },
      })

      const providerResponseStartedAt = nowIso()
      const providerResponseStartedMs = nowMs()
      const providerResult = await dependencies.provider.executePrompt(providerRequest.request)
      if (providerResult.kind === 'failure') {
        safeCaptureStage(dependencies, {
          name: 'PROVIDER_RESPONSE',
          status: 'FAILED',
          startedAt: providerResponseStartedAt,
          finishedAt: nowIso(),
          duration: Math.max(0, nowMs() - providerResponseStartedMs),
          snapshot: {
            createdAt: nowIso(),
            providerRequest: providerRequest.request,
            failure: {
              code: providerResult.code,
              safeMessage: providerResult.safeMessage,
            },
          },
        })
        safeFinishTrace(dependencies, 'FAILED')
        return createFailure(
          'PROVIDER_EXECUTION_FAILED',
          providerResult.safeMessage,
          providerResult.retryable,
          { providerErrorCode: providerResult.code },
        )
      }

      safeCaptureStage(dependencies, {
        name: 'PROVIDER_RESPONSE',
        status: 'SUCCESS',
        startedAt: providerResponseStartedAt,
        finishedAt: nowIso(),
        duration: Math.max(0, nowMs() - providerResponseStartedMs),
        snapshot: {
          createdAt: nowIso(),
          providerRequest: providerRequest.request,
          providerResponse: providerResult.response,
        },
      })

      debugConversationBoundary('pipeline.result.produced', {
        executionId: request.id,
        providerId: providerResult.response.metadata.providerId,
        model: providerResult.response.metadata.model,
        providerResponseId: providerResult.response.id,
        responseContentLength: providerResult.response.content.length,
      })

      let effectiveProviderResponse = providerResult.response

      if (dependencies.toolExecutor !== undefined) {
        const toolRequest = dependencies.toolExecutor.resolveRequestFromProviderResponse({
          content: providerResult.response.content,
          context: {
            executionId: request.id,
            conversationId: request.conversation.conversationId,
            sessionId: request.session.sessionId,
            providerId: request.metadata.providerId,
            model: request.metadata.model,
            requestedAt: request.metadata.createdAt,
            caller: 'PIPELINE',
            allowedPermissions: [
              'read-only',
              'write',
              'dangerous',
              'future-confirmation-required',
            ],
          },
          ...(request.metadata.timeoutMs === undefined ? {} : { timeoutMs: request.metadata.timeoutMs }),
        })

        if (toolRequest.kind === 'failure') {
          safeFinishTrace(dependencies, 'FAILED')
          return createFailure(
            'TOOL_EXECUTION_FAILED',
            toolRequest.safeMessage,
            toolRequest.retryable,
            { toolErrorCode: toolRequest.code },
          )
        }

        if (toolRequest.request !== null) {
          const toolExecution = await dependencies.toolExecutor.execute(toolRequest.request)
          if (toolExecution.kind === 'failure') {
            safeFinishTrace(dependencies, 'FAILED')
            return createFailure(
              'TOOL_EXECUTION_FAILED',
              toolExecution.safeMessage,
              toolExecution.retryable,
              { toolErrorCode: toolExecution.code },
            )
          }

          const toolPrompt = createToolResultPrompt(prompt.prompt, request, toolExecution.value)
          if (toolPrompt.kind === 'failure') {
            safeFinishTrace(dependencies, 'FAILED')
            return toolPrompt
          }

          const providerToolRequest = createProviderRequest({
            id: providerToolRequestIdFromExecution(request),
            prompt: toolPrompt.prompt,
            metadata: {
              createdAt: request.metadata.createdAt,
              source: request.metadata.source,
              providerId: request.metadata.providerId,
              model: request.metadata.model,
              ...(request.metadata.temperature === undefined
                ? {}
                : { temperature: request.metadata.temperature }),
              ...(request.metadata.maxOutputTokens === undefined
                ? {}
                : { maxOutputTokens: request.metadata.maxOutputTokens }),
              ...(request.metadata.timeoutMs === undefined
                ? {}
                : { timeoutMs: request.metadata.timeoutMs }),
              ...(request.metadata.responseFormat === undefined
                ? {}
                : { responseFormat: request.metadata.responseFormat }),
              tags: [
                'execution-pipeline',
                `execution:${request.id}`,
                'tool-calling-follow-up',
              ],
              attributes: {
                executionId: request.id,
                toolName: toolExecution.value.toolName,
              },
            },
          })

          if (providerToolRequest.kind === 'failure') {
            safeFinishTrace(dependencies, 'FAILED')
            return createFailure(
              'PROVIDER_EXECUTION_FAILED',
              providerToolRequest.safeMessage,
              providerToolRequest.retryable,
              { providerRequestErrorCode: providerToolRequest.code },
            )
          }

          const providerToolResponse = await dependencies.provider.executePrompt(providerToolRequest.request)
          if (providerToolResponse.kind === 'failure') {
            safeFinishTrace(dependencies, 'FAILED')
            return createFailure(
              'PROVIDER_EXECUTION_FAILED',
              providerToolResponse.safeMessage,
              providerToolResponse.retryable,
              { providerErrorCode: providerToolResponse.code },
            )
          }

          effectiveProviderResponse = providerToolResponse.response
        }
      }

      const assistantMessageStartedAt = nowIso()
      const assistantMessageStartedMs = nowMs()
      const assistantMessage = createAssistantMessage(
        dependencies,
        request,
        request.session,
        effectiveProviderResponse.content,
      )
      if (assistantMessage.kind === 'failure') {
        safeCaptureStage(dependencies, {
          name: 'ASSISTANT_MESSAGE',
          status: 'FAILED',
          startedAt: assistantMessageStartedAt,
          finishedAt: nowIso(),
          duration: Math.max(0, nowMs() - assistantMessageStartedMs),
          snapshot: {
            createdAt: nowIso(),
            providerResponse: effectiveProviderResponse,
            failure: {
              code: assistantMessage.code,
              safeMessage: assistantMessage.safeMessage,
            },
          },
        })
        safeFinishTrace(dependencies, 'FAILED')
        return assistantMessage
      }

      safeCaptureStage(dependencies, {
        name: 'ASSISTANT_MESSAGE',
        status: 'SUCCESS',
        startedAt: assistantMessageStartedAt,
        finishedAt: nowIso(),
        duration: Math.max(0, nowMs() - assistantMessageStartedMs),
        snapshot: {
          createdAt: nowIso(),
            providerResponse: effectiveProviderResponse,
          assistantMessage: assistantMessage.message,
        },
      })

      const conversationUpdateStartedAt = nowIso()
      const conversationUpdateStartedMs = nowMs()
      const appendedSession = dependencies.conversationPort.appendMessage(
        request.session,
        assistantMessage.message,
      )
      if (appendedSession.kind === 'failure') {
        safeCaptureStage(dependencies, {
          name: 'CONVERSATION_UPDATE',
          status: 'FAILED',
          startedAt: conversationUpdateStartedAt,
          finishedAt: nowIso(),
          duration: Math.max(0, nowMs() - conversationUpdateStartedMs),
          snapshot: {
            createdAt: nowIso(),
            assistantMessage: assistantMessage.message,
            failure: {
              code: appendedSession.code,
              safeMessage: appendedSession.safeMessage,
            },
          },
        })
        safeFinishTrace(dependencies, 'FAILED')
        return mapConversationFailure(appendedSession)
      }

      safeCaptureStage(dependencies, {
        name: 'CONVERSATION_UPDATE',
        status: 'SUCCESS',
        startedAt: conversationUpdateStartedAt,
        finishedAt: nowIso(),
        duration: Math.max(0, nowMs() - conversationUpdateStartedMs),
        snapshot: {
          createdAt: nowIso(),
          assistantMessage: assistantMessage.message,
          session: appendedSession.value,
        },
      })

      debugConversationBoundary('pipeline.updatedSession.returned', {
        executionId: request.id,
        sessionId: appendedSession.value.sessionId,
        messageCount: appendedSession.value.messages.length,
        assistantMessageId: assistantMessage.message.id,
      })

      const response = createExecutionResponse({
        id: request.id,
        session: appendedSession.value,
        assistantMessage: assistantMessage.message,
        providerResponse: effectiveProviderResponse,
        metadata: {
          createdAt: request.metadata.createdAt,
          source: request.metadata.source,
          requestId: request.id,
          conversationId: request.conversation.conversationId,
          sessionId: appendedSession.value.sessionId,
          contextId: builtContext.context.id,
          resolvedContextId: resolvedContext.resolvedContext.id,
          promptId: prompt.prompt.promptId,
          providerId: providerResult.response.metadata.providerId,
          model: providerResult.response.metadata.model,
          tags: [
            'execution-pipeline',
            `provider:${providerResult.response.metadata.providerId.toLowerCase()}`,
          ],
          attributes: {
            providerResponseId: providerResult.response.id,
            assistantMessageId: assistantMessage.message.id,
            messageCount: appendedSession.value.messages.length,
          },
        },
      })
      if (response.kind === 'failure') {
        safeFinishTrace(dependencies, 'FAILED')
        return createFailure(response.code, response.safeMessage, response.retryable)
      }

      safeFinishTrace(dependencies, 'SUCCESS')

      debugConversationBoundary('pipeline.execution.success', {
        executionId: request.id,
        sessionId: response.response.session.sessionId,
        messageCount: response.response.session.messages.length,
      })

      return {
        kind: 'success',
        response: response.response,
      }
    },
  }
}

export async function executeAIExecutionPipeline(input: {
  readonly pipeline: AIExecutionPipeline
  readonly request: AIExecutionRequest
}): Promise<AIExecutionResult> {
  return input.pipeline.execute(input.request)
}

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import type {
  AIConversationExecution,
  AIConversationFacade,
  AIConversationRequest,
} from '../src/intelligence/ai-conversation'
import {
  createAIDeveloperPlaygroundDependencies,
  createDefaultAIDeveloperPlaygroundRequest,
} from '../src/pages/Debug/aiDeveloperPlaygroundComposition'
import {
  createAIDeveloperPlaygroundController,
  validateAIDeveloperPlaygroundState,
} from '../src/pages/Debug/aiDeveloperPlaygroundController'
import AIDeveloperPlaygroundPage from '../src/pages/Debug/AIDeveloperPlaygroundPage'
import { createMockConversationalRenderer } from '../src/intelligence/mock-conversational-renderer/mockConversationalRenderer'
import { createPromptContextBuilder } from '../src/intelligence/prompt-context-builder'
import { createConversationResponseComposer } from '../src/intelligence/response-composer'

function createExecutionResultFixture(): AIConversationExecution {
  return {
    executionId: 'conversation-orchestration:playground-fixture' as AIConversationExecution['executionId'],
    startedAt: '2026-07-24T12:00:00.000Z',
    finishedAt: '2026-07-24T12:00:01.000Z',
    status: 'success',
    summary: {
      totalSteps: 1,
      successfulSteps: 1,
      failedSteps: 0,
    },
    steps: [
      {
        kind: 'success',
        stepId: 'step-1',
        order: 1,
        toolId: 'ping',
        resolvedToolName: 'ping',
        execution: {
          toolName: 'ping',
          output: 'PONG',
          permission: 'read-only',
          durationMs: 1,
        },
      },
    ],
  }
}

function createResponseFixture() {
  const promptContextResult = createPromptContextBuilder().build({
    executionResult: createExecutionResultFixture(),
  })

  if (promptContextResult.kind !== 'success') {
    throw new Error('Expected valid prompt context fixture')
  }

  const responseResult = createConversationResponseComposer().build({
    promptContext: promptContextResult.context,
  })

  if (responseResult.kind !== 'success') {
    throw new Error('Expected valid response fixture')
  }

  return responseResult.response
}

function createFacadeSuccessMock(): AIConversationFacade {
  const response = createResponseFixture()

  return {
    execute: vi.fn(async () => ({
      kind: 'success',
      response,
    })),
  }
}

describe('AI Developer Playground (PB-IS-013.6)', () => {
  it('renderiza la pantalla con los cinco paneles requeridos', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(AIDeveloperPlaygroundPage),
      ),
    )

    expect(html).toContain('AI Developer Playground')
    expect(html).toContain('Panel 1 · Conversation Request')
    expect(html).toContain('Panel 2 · Conversation Execution Result')
    expect(html).toContain('Panel 3 · Prompt Context')
    expect(html).toContain('Panel 4 · Conversation Response')
    expect(html).toContain('Panel 5 · Rendered Conversation')
    expect(html).toContain('Ejecutar pipeline')
  })

  it('ejecuta el pipeline y visualiza request, execution result, prompt context y response', async () => {
    const facade = createFacadeSuccessMock()
    const initialRequest = createDefaultAIDeveloperPlaygroundRequest(new Date('2026-07-24T12:00:00.000Z'))
    const controller = createAIDeveloperPlaygroundController({
      facade,
      renderer: createMockConversationalRenderer(),
      now: () => '2026-07-24T12:00:02.000Z',
      createInitialDraft: () => initialRequest,
    })

    await controller.run()

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(state.request).not.toBeNull()
    expect(state.executionResult).not.toBeNull()
    expect(state.promptContext).not.toBeNull()
    expect(state.response).not.toBeNull()
    expect(state.renderedMessage).not.toBeNull()
    expect(state.error).toBeNull()
    expect(validateAIDeveloperPlaygroundState(state)).toBeNull()

    controller.dispose()
  })

  it('reporta errores de solicitud invalida preservando estado previo', async () => {
    const facade = createFacadeSuccessMock()
    const initialRequest = createDefaultAIDeveloperPlaygroundRequest(new Date('2026-07-24T12:00:00.000Z'))
    const controller = createAIDeveloperPlaygroundController({
      facade,
      renderer: createMockConversationalRenderer(),
      now: () => '2026-07-24T12:00:03.000Z',
      createInitialDraft: () => initialRequest,
    })

    await controller.run()
    const previousReadyState = controller.getState()
    expect(previousReadyState.status).toBe('ready')

    controller.updateRequestDraft('{ invalid json')
    await controller.run()

    const state = controller.getState()
    expect(state.status).toBe('error')
    expect(state.error?.stage).toBe('conversation-request')
    expect(state.executionResult).not.toBeNull()
    expect(state.promptContext).not.toBeNull()
    expect(state.response).not.toBeNull()
    expect(state.renderedMessage).not.toBeNull()

    controller.dispose()
  })

  it('reporta errores de fachada con etapa controlada', async () => {
    const request = createDefaultAIDeveloperPlaygroundRequest(new Date('2026-07-24T12:00:00.000Z'))
    const facade: AIConversationFacade = {
      execute: vi.fn(async (input: AIConversationRequest) => {
        void input
        return {
        kind: 'failure',
        code: 'PROMPT_CONTEXT_BUILD_FAILED',
        retryable: false,
        safeMessage: 'Prompt context failed.',
      }
      }),
    }

    const controller = createAIDeveloperPlaygroundController({
      facade,
      renderer: createMockConversationalRenderer(),
      now: () => '2026-07-24T12:00:04.000Z',
      createInitialDraft: () => request,
    })

    await controller.run()

    const state = controller.getState()
    expect(state.status).toBe('error')
    expect(state.error?.stage).toBe('prompt-context-builder')
    expect(state.error?.code).toBe('PROMPT_CONTEXT_BUILD_FAILED')

    controller.dispose()
  })

  it('ejecuta el pipeline completo con la composicion real del playground via fachada', async () => {
    const dependencies = createAIDeveloperPlaygroundDependencies()
    const request = createDefaultAIDeveloperPlaygroundRequest(new Date('2026-07-24T12:00:00.000Z'))

    dependencies.controller.updateRequestDraft(JSON.stringify(request, null, 2))
    await dependencies.controller.run()

    const state = dependencies.controller.getState()
    expect(state.status).toBe('ready')
    expect(state.response?.blocks[0]?.kind).toBe('summary')
    expect(state.executionResult?.summary.totalSteps).toBe(1)
    expect(state.renderedMessage?.origin).toBe('MOCK_RENDERER')

    dependencies.controller.dispose()
  })

  it('registra navegacion del playground en debug y rutas', () => {
    const routesPath = resolve(__dirname, '../src/routes/index.tsx')
    const debugPath = resolve(__dirname, '../src/pages/Debug/DebugPage.tsx')

    const routesSource = readFileSync(routesPath, 'utf8')
    const debugSource = readFileSync(debugPath, 'utf8')

    expect(routesSource).toContain('debug/ai-developer-playground')
    expect(routesSource).toContain('AIDeveloperPlaygroundPage')
    expect(debugSource).toContain('/debug/ai-developer-playground')
    expect(debugSource).toContain('AI Developer Playground')
  })
})

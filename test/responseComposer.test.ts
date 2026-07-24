import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { createConversationExecutionResult } from '../src/intelligence/conversation-orchestrator'
import {
  buildPromptContext,
} from '../src/intelligence/prompt-context-builder'
import {
  buildConversationResponse,
  createConversationResponseComposer,
  validateConversationResponse,
} from '../src/intelligence/response-composer'

function createPromptContextFixture() {
  const result = createConversationExecutionResult({
    executionId: 'conversation-orchestration:response:001' as never,
    startedAt: '2026-07-24T13:00:00.000Z',
    finishedAt: '2026-07-24T13:00:01.000Z',
    steps: [
      {
        kind: 'success',
        stepId: 'step-1',
        order: 1,
        toolId: 'financial_reports',
        resolvedToolName: 'financial_reports',
        execution: {
          toolName: 'financial_reports',
          output: {
            reportId: 'report-1',
            format: 'json',
          },
          permission: 'read-only',
          durationMs: 10,
        },
      },
      {
        kind: 'failure',
        stepId: 'step-2',
        order: 2,
        toolId: 'financial_missing',
        error: {
          kind: 'failure',
          code: 'TOOL_NOT_FOUND',
          retryable: false,
          safeMessage: 'Missing tool',
        },
      },
    ],
    summary: {
      totalSteps: 2,
      successfulSteps: 1,
      failedSteps: 1,
    },
    status: 'partial-failure',
  })

  if (result.kind !== 'success') {
    throw new Error('Expected valid execution result fixture')
  }

  const promptContext = buildPromptContext({ executionResult: result.result })
  if (promptContext.kind !== 'success') {
    throw new Error('Expected valid prompt context fixture')
  }

  return promptContext.context
}

describe('AI Response Composer (PB-IS-013.4)', () => {
  it('builds a correct ConversationResponse from a valid PromptContext', () => {
    const composer = createConversationResponseComposer()
    const promptContext = createPromptContextFixture()
    const composed = composer.build({ promptContext })

    expect(composed.kind).toBe('success')
    if (composed.kind !== 'success') {
      throw new Error('Expected successful response composition')
    }

    expect(composed.response.responseId).toBe('conversation-response:conversation-orchestration:response:001')
    expect(composed.response.promptContext).toEqual(promptContext)
    expect(composed.response.blocks[0]?.kind).toBe('summary')
    expect(composed.response.blocks).toHaveLength(3)
  })

  it('preserves multiple conversational blocks', () => {
    const promptContext = createPromptContextFixture()
    const composed = buildConversationResponse({ promptContext })

    expect(composed.kind).toBe('success')
    if (composed.kind !== 'success') {
      throw new Error('Expected successful response composition')
    }

    expect(composed.response.blocks.map((block) => block.kind)).toEqual([
      'summary',
      'step-success',
      'step-failure',
    ])

    const stepSuccess = composed.response.blocks[1]
    expect(stepSuccess?.kind).toBe('step-success')
    if (stepSuccess?.kind === 'step-success') {
      expect(stepSuccess.resolvedToolName).toBe('financial_reports')
      expect(stepSuccess.output).toEqual({ reportId: 'report-1', format: 'json' })
    }
  })

  it('serializes the ConversationResponse without extra transformations', () => {
    const composed = buildConversationResponse({ promptContext: createPromptContextFixture() })

    expect(composed.kind).toBe('success')
    if (composed.kind !== 'success') {
      throw new Error('Expected successful response composition')
    }

    const json = JSON.stringify(composed.response)
    const parsed = JSON.parse(json) as Record<string, unknown>

    expect(parsed.responseId).toBe('conversation-response:conversation-orchestration:response:001')
    expect(Array.isArray(parsed.blocks)).toBe(true)
    expect(parsed.promptContext).toBeDefined()
  })

  it('fails closed on invalid PromptContext input', () => {
    const composer = createConversationResponseComposer()
    const invalidPromptContext = {
      protocolVersion: 1,
      contextId: 'prompt-context:invalid',
      execution: {
        executionId: 'conversation-orchestration:response:invalid',
        startedAt: '2026-07-24T13:00:01.000Z',
        finishedAt: '2026-07-24T13:00:00.000Z',
        status: 'success',
        blockCount: 1,
        stepCount: 1,
        successCount: 1,
        failureCount: 0,
      },
      metadata: {
        protocolVersion: 1,
        createdAt: '2026-07-24T13:00:01.000Z',
        source: 'APPLICATION',
        deterministic: true,
        failClosed: true,
      },
      blocks: [],
    }

    const result = composer.build({ promptContext: invalidPromptContext as never })
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_CONVERSATION_RESPONSE_PROMPT_CONTEXT')
    }

    expect(validateConversationResponse(invalidPromptContext as never)).not.toBeNull()
  })

  it('exports public response composer APIs and avoids provider dependencies', async () => {
    const module = await import('../src/intelligence/response-composer')
    expect(typeof module.createConversationResponseComposer).toBe('function')
    expect(typeof module.buildConversationResponse).toBe('function')
    expect(typeof module.validateConversationResponse).toBe('function')
    expect(typeof module.validateConversationResponseResult).toBe('function')

    const source = readFileSync(
      resolve(process.cwd(), 'src/intelligence/response-composer/responseComposerFactory.ts'),
      'utf8',
    )

    expect(source).not.toContain('OpenAI')
    expect(source).not.toContain('Gemini')
    expect(source).not.toContain('Claude')
    expect(source).not.toContain('Prompt Templates')
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { createToolFailure } from '../src/intelligence/ai-tools'
import {
  createConversationExecutionResult,
} from '../src/intelligence/conversation-orchestrator'
import {
  buildPromptContext,
  createPromptContextBuilder,
  validatePromptContextInput,
} from '../src/intelligence/prompt-context-builder'

function createExecutionResultFixture() {
  const result = createConversationExecutionResult({
    executionId: 'conversation-orchestration:prompt-context:001' as never,
    startedAt: '2026-07-24T12:30:00.000Z',
    finishedAt: '2026-07-24T12:30:01.000Z',
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
          durationMs: 12,
        },
      },
      {
        kind: 'failure',
        stepId: 'step-2',
        order: 2,
        toolId: 'financial_missing',
        error: createToolFailure('TOOL_NOT_FOUND', 'Missing tool'),
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
    throw new Error('Expected valid conversation execution result fixture')
  }

  return result.result
}

describe('Prompt Context Builder (PB-IS-013.3)', () => {
  it('builds a correct PromptContext from a valid ConversationExecutionResult', () => {
    const builder = createPromptContextBuilder()
    const executionResult = createExecutionResultFixture()
    const built = builder.build({ executionResult })

    expect(built.kind).toBe('success')
    if (built.kind !== 'success') {
      throw new Error('Expected prompt context build success')
    }

    expect(built.context.contextId).toBe('prompt-context:conversation-orchestration:prompt-context:001')
    expect(built.context.execution).toEqual({
      executionId: 'conversation-orchestration:prompt-context:001',
      startedAt: '2026-07-24T12:30:00.000Z',
      finishedAt: '2026-07-24T12:30:01.000Z',
      status: 'partial-failure',
    })
    expect(built.context.steps.map((step) => step.order)).toEqual([1, 2])
    expect(built.context.steps[0]?.kind).toBe('success')
    expect(built.context.steps[1]?.kind).toBe('failure')
  })

  it('preserves multiple tool results and errors without interpretation', () => {
    const executionResult = createExecutionResultFixture()
    const built = buildPromptContext({ executionResult })

    expect(built.kind).toBe('success')
    if (built.kind !== 'success') {
      throw new Error('Expected prompt context build success')
    }

    const [firstStep, secondStep] = built.context.steps
    expect(firstStep?.kind).toBe('success')
    if (firstStep?.kind === 'success') {
      expect(firstStep.output).toEqual({ reportId: 'report-1', format: 'json' })
    }

    expect(secondStep?.kind).toBe('failure')
    if (secondStep?.kind === 'failure') {
      expect(secondStep.error.code).toBe('TOOL_NOT_FOUND')
      expect(secondStep.error.safeMessage).toBe('Missing tool')
    }
  })

  it('serializes to JSON without extra transformations', () => {
    const built = buildPromptContext({ executionResult: createExecutionResultFixture() })

    expect(built.kind).toBe('success')
    if (built.kind !== 'success') {
      throw new Error('Expected prompt context build success')
    }

    const json = JSON.stringify(built.context)
    const parsed = JSON.parse(json) as Record<string, unknown>

    expect(parsed.contextId).toBe('prompt-context:conversation-orchestration:prompt-context:001')
    expect(parsed.execution).toBeDefined()
    expect(Array.isArray(parsed.steps)).toBe(true)
  })

  it('fails closed on invalid execution result input', () => {
    const builder = createPromptContextBuilder()
    const invalidExecutionResult = {
      executionId: 'conversation-orchestration:invalid' as never,
      startedAt: '2026-07-24T12:30:00.000Z',
      finishedAt: '2026-07-24T12:30:01.000Z',
      status: 'success',
      summary: {
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
      },
      steps: [],
    }

    const validation = validatePromptContextInput({ executionResult: invalidExecutionResult as never })
    expect(validation).not.toBeNull()

    const built = builder.build({ executionResult: invalidExecutionResult as never })
    expect(built.kind).toBe('failure')
    if (built.kind === 'failure') {
      expect(built.code).toBe('INVALID_PROMPT_CONTEXT_EXECUTION')
    }
  })

  it('exports public prompt context builder APIs and avoids provider dependencies', async () => {
    const module = await import('../src/intelligence/prompt-context-builder')
    expect(typeof module.createPromptContextBuilder).toBe('function')
    expect(typeof module.buildPromptContext).toBe('function')
    expect(typeof module.validatePromptContext).toBe('function')

    const source = readFileSync(
      resolve(process.cwd(), 'src/intelligence/prompt-context-builder/promptContextFactory.ts'),
      'utf8',
    )

    expect(source).not.toContain('OpenAI')
    expect(source).not.toContain('Gemini')
    expect(source).not.toContain('Claude')
    expect(source).not.toContain('Prompt Templates')
  })
})

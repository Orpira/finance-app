import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  createAdapterInvocationRecorder,
  createEndToEndPipelineValidator,
} from '../src/intelligence/ai-foundation/endToEndPipelineValidator'
import {
  PIPELINE_VALIDATION_STAGES,
  type PipelineValidationReport,
  type PipelineValidationStage,
} from '../src/intelligence/ai-foundation/endToEndPipelineContracts'
import {
  createMockAdapterFixtures,
} from '../src/intelligence/ai-foundation/mockAdapterFixtures'

const MILESTONE_8F_SOURCE_FILES = [
  new URL('../src/intelligence/ai-foundation/endToEndPipelineContracts.ts', import.meta.url),
  new URL('../src/intelligence/ai-foundation/endToEndPipelineValidator.ts', import.meta.url),
  new URL('../src/intelligence/ai-foundation/mockAdapterFixtures.ts', import.meta.url),
  new URL('../src/intelligence/ai-foundation/mockLLMAdapter.ts', import.meta.url),
  new URL('../src/intelligence/ai-foundation/mockLLMResponseFactory.ts', import.meta.url),
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonSafe(
  value: unknown,
  ancestors: ReadonlySet<object> = new Set(),
): boolean {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry, ancestors))
  }

  if (!isRecord(value)) {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  for (const entry of Object.values(value)) {
    if (!isJsonSafe(entry, nextAncestors)) {
      return false
    }
  }

  return true
}

function asSuccess(report: PipelineValidationReport) {
  expect(report.ok).toBe(true)
  if (!report.ok) {
    throw new Error(`expected success but got ${report.failure?.code ?? 'unknown'}`)
  }

  return report
}

function asFailure(report: PipelineValidationReport) {
  expect(report.ok).toBe(false)
  if (report.ok) {
    throw new Error('expected failure report')
  }

  return report
}

function createFailureCompletedStages(expectedFailedStage: PipelineValidationStage) {
  return PIPELINE_VALIDATION_STAGES.filter((stage) => {
    return stage !== expectedFailedStage
  }).slice(0, PIPELINE_VALIDATION_STAGES.indexOf(expectedFailedStage))
}

function readMilestone8FSources(): readonly string[] {
  return MILESTONE_8F_SOURCE_FILES.map((sourceFile) => {
    return readFileSync(sourceFile, 'utf8')
  })
}

function expectSourcesToExclude(tokens: readonly string[]): void {
  const sources = readMilestone8FSources()

  for (const source of sources) {
    for (const token of tokens) {
      expect(source.includes(token)).toBe(false)
    }
  }
}

describe('End-to-End Mock LLM Pipeline Validator (Milestone 8F)', () => {
  it('pipeline completo exitoso', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = asSuccess(validator.validate(fixtures.createSuccessFixture()))

    expect(report.status).toBe('success')
    expect(report.completedStages).toEqual(PIPELINE_VALIDATION_STAGES)
    expect(report.summary.failedStage).toBeNull()
    expect(report.response).not.toBeNull()
    expect(report.response?.output.responseCode).toBe('MOCK_RESPONSE_EXPLAIN_INSIGHT_LOCAL')
    expect(report.invocationRecords).toHaveLength(1)
    expect(report.invocationResult?.ok).toBe(true)
  })

  it('fallo de autorizacion', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = asFailure(
      validator.validate(fixtures.createAuthorizationFailureFixture()),
    )

    expect(report.failure?.stage).toBe('PRIVACY_BOUNDARY')
    expect(report.failure?.code).toBe('PRIVACY_AUTHORIZATION_FAILED')
    expect(report.completedStages).toEqual([])
    expect(report.response).toBeNull()
    expect(report.invocationResult).toBeNull()
    expect(report.invocationRecords).toHaveLength(0)
  })

  it('fallo de contexto', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = asFailure(
      validator.validate(fixtures.createContextFailureFixture()),
    )

    expect(report.failure?.stage).toBe('AUTHORIZED_CONTEXT_BUILDER')
    expect(report.failure?.code).toBe('CONTEXT_BUILD_FAILED')
    expect(report.completedStages).toEqual(['PRIVACY_BOUNDARY'])
    expect(report.response).toBeNull()
    expect(report.invocationResult).toBeNull()
  })

  it('fallo de compatibilidad', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = asFailure(
      validator.validate(fixtures.createCompatibilityFailureFixture()),
    )

    expect(report.failure?.stage).toBe('PIPELINE_COMPATIBILITY')
    expect(report.failure?.code).toBe('PIPELINE_COMPATIBILITY_FAILED')
    expect(report.completedStages).toEqual(
      createFailureCompletedStages('PIPELINE_COMPATIBILITY'),
    )
    expect(report.capabilityResolution?.ok).toBe(true)
    expect(report.complianceReport).toBeNull()
    expect(report.invocationResult).toBeNull()
  })

  it('fallo del adapter', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = asFailure(
      validator.validate(fixtures.createAdapterFailureFixture()),
    )

    expect(report.failure?.stage).toBe('MOCK_ADAPTER')
    expect(report.failure?.code).toBe('ADAPTER_INVOCATION_FAILED')
    expect(report.completedStages).toEqual(
      createFailureCompletedStages('MOCK_ADAPTER'),
    )
    expect(report.invocationResult).not.toBeNull()
    expect(report.invocationResult?.ok).toBe(false)

    if (report.invocationResult !== null && !report.invocationResult.ok) {
      expect(report.invocationResult.code).toBe('TOKEN_BUDGET_INVALID')
    }

    expect(report.response).toBeNull()
    expect(report.invocationRecords).toHaveLength(1)
  })

  it('respuesta determinista', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const fixture = fixtures.createSuccessFixture()
    const first = validator.validate(fixture)
    const second = validator.validate(fixture)

    expect(first).toEqual(second)
  })

  it('JSON-safe', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = validator.validate(fixtures.createSuccessFixture())

    expect(isJsonSafe(report)).toBe(true)
    expect(() => JSON.stringify(report)).not.toThrow()
  })

  it('readonly', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = validator.validate(fixtures.createSuccessFixture())

    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.completedStages)).toBe(true)
    expect(Object.isFrozen(report.summary)).toBe(true)
    expect(Object.isFrozen(report.invocationRecords)).toBe(true)

    expect(() => {
      const mutableStages = report.completedStages as PipelineValidationStage[]
      mutableStages.push('MOCK_ADAPTER')
    }).toThrow()
  })

  it('fail-closed', () => {
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator()

    const report = asFailure(
      validator.validate(fixtures.createCompatibilityFailureFixture()),
    )

    expect(report.failClosed).toBe(true)
    expect(report.deterministic).toBe(true)
    expect(report.response).toBeNull()
    expect(report.complianceReport).toBeNull()
    expect(report.invocationResult).toBeNull()
  })

  it('recorder en memoria sin persistencia entre ejecuciones', () => {
    const recorder = createAdapterInvocationRecorder()
    const fixtures = createMockAdapterFixtures()
    const validator = createEndToEndPipelineValidator({ recorder })

    const first = asSuccess(validator.validate(fixtures.createSuccessFixture()))
    expect(first.invocationRecords).toHaveLength(1)
    expect(recorder.count()).toBe(1)

    const second = asFailure(
      validator.validate(fixtures.createAuthorizationFailureFixture()),
    )
    expect(second.invocationRecords).toHaveLength(0)
    expect(recorder.count()).toBe(0)
  })

  it('ausencia de APIs no deterministas', () => {
    expectSourcesToExclude([
      'Date.now(',
      'new Date(',
      'Math.random(',
      'crypto.randomUUID(',
    ])
  })

  it('ausencia de red', () => {
    expectSourcesToExclude(['fetch(', 'axios', 'HTTP'])
  })

  it('ausencia de SDK y proveedores reales', () => {
    expectSourcesToExclude([
      'OpenAI',
      'Anthropic',
      'Gemini',
      'Ollama',
      'SDK',
    ])
  })

  it('ausencia de prompts reales, streaming y tool calling', () => {
    expectSourcesToExclude([
      'prompt',
      'PROMPT',
      'chat',
      'streaming',
      'tool calling',
      'tool_calling',
    ])
  })

  it('ausencia de persistencia local', () => {
    expectSourcesToExclude([
      'Dexie',
      'IndexedDB',
      'localStorage',
      'sessionStorage',
    ])
  })
})

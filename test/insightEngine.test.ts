import { describe, expect, it, vi } from 'vitest'

import { createInsightEngine } from '../src/insight/insightEngine'
import type {
  InsightEngineBuilderPort,
  InsightEngineValidatorPort,
} from '../src/insight/engineInterfaces'
import { createInsightRepository } from '../src/insight/insightRepository'
import type { InsightRepository } from '../src/insight/repositoryInterfaces'
import type {
  InsightBuildAssessment,
  InsightCollection,
} from '../src/insight/types'
import { createValidationReport } from '../src/insight/validationReport'
import { INSIGHT_RULE_PROTOCOL_VERSION } from '../src/types/insightRule'
import type {
  SealedSnapshotId,
  SnapshotKey,
} from '../src/types/financialSnapshot'
import type {
  KnowledgeBuilderVersion,
  KnowledgeCollection,
  KnowledgeCollectionId,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'

function brand<T>(value: string): T {
  return value as T
}

const SOURCE_SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/2.0.0:1111111111111111111111111111111111111111111111111111111111111111',
)
const SOURCE_SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-07')
const SOURCE_KNOWLEDGE_COLLECTION_ID = brand<KnowledgeCollectionId>(
  'knowledge-collection:insight-engine-fixture',
)

const KNOWLEDGE_VERSION = brand<KnowledgeVersion>('knowledge/1.0.0')
const BUILDER_VERSION =
  brand<KnowledgeBuilderVersion>('knowledge-builder/1.0.0')
const RULES_VERSION = brand<KnowledgeRulesVersion>('knowledge-rules/1.0.0')
const PROJECTION_VERSION =
  brand<KnowledgeProjectionVersion>('knowledge-projection/1.0.0')

function createKnowledgeCollection(): KnowledgeCollection {
  return {
    state: 'validated',
    identity: {
      knowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
      sourceSnapshotId: SOURCE_SNAPSHOT_ID,
      sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
      sourceSnapshotRevision: 1,
      sourceFingerprintValue:
        '1111111111111111111111111111111111111111111111111111111111111111',
    },
    versions: {
      knowledgeVersion: KNOWLEDGE_VERSION,
      builderVersion: BUILDER_VERSION,
      rulesVersion: RULES_VERSION,
      projectionVersion: PROJECTION_VERSION,
    },
    facts: [],
    relationships: [],
    factCount: 0,
    validation: {
      status: 'valid',
      checks: [{ code: 'fixture.valid', passed: true }],
      failedChecks: 0,
    },
  }
}

function createInsightCollection(): InsightCollection {
  return {
    protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    sourceKnowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
    sourceSnapshotId: SOURCE_SNAPSHOT_ID,
    sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
    sourceSnapshotRevision: 1,
    deterministicOutput: true,
    failClosed: true,
    insights: [],
    executions: [],
  }
}

function createAssessment(): InsightBuildAssessment {
  return {
    status: 'ok',
    failures: [],
    generatedInsights: 0,
    skippedRules: 0,
  }
}

function createRepositorySpy(
  repository: InsightRepository = createInsightRepository(),
): {
  readonly repository: InsightRepository
  readonly replaceSpy: ReturnType<typeof vi.fn>
} {
  const replaceSpy = vi.fn((collection: InsightCollection) =>
    repository.replace(collection),
  )

  return {
    repository: {
      ...repository,
      replace: replaceSpy,
    },
    replaceSpy,
  }
}

function createMockPorts(input: {
  readonly collection?: InsightCollection
  readonly assessment?: InsightBuildAssessment
  readonly validatorReport?: ReturnType<typeof createValidationReport>
}): {
  readonly builder: InsightEngineBuilderPort
  readonly validator: InsightEngineValidatorPort
  readonly buildSpy: ReturnType<typeof vi.fn>
  readonly validateSpy: ReturnType<typeof vi.fn>
} {
  const collection = input.collection ?? createInsightCollection()
  const assessment = input.assessment ?? createAssessment()
  const validatorReport = input.validatorReport ?? createValidationReport([])

  const buildSpy = vi.fn(() => ({
    collection,
    assessment,
  }))
  const validateSpy = vi.fn(() => validatorReport)

  return {
    builder: { build: buildSpy },
    validator: { validate: validateSpy },
    buildSpy,
    validateSpy,
  }
}

describe('Insight Engine Orchestrator deterministic pipeline (Milestone 6F)', () => {
  it('pipeline exitoso y coleccion vacia', () => {
    const engine = createInsightEngine()
    const baseRepository = createInsightRepository(createInsightCollection())

    const result = engine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository: baseRepository,
    })

    expect(result.status).toBe('accepted')
    expect(result.repositoryUpdated).toBe(true)
    expect(result.validationReport.status).toBe('valid')
    expect(result.collection.insights).toEqual([])
    expect(result.repository.count()).toBe(0)
  })

  it('validator invalido y repository no actualizado', () => {
    const { builder, validator } = createMockPorts({
      validatorReport: createValidationReport([
        {
          code: 'INSIGHT_VALIDATION_INVALID_STRUCTURE',
          path: 'collection',
          message: 'invalid collection',
        },
      ]),
    })
    const engine = createInsightEngine({ builder, validator })
    const { repository, replaceSpy } = createRepositorySpy()

    const result = engine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository,
    })

    expect(result.status).toBe('rejected')
    expect(result.repositoryUpdated).toBe(false)
    expect(result.validationReport.status).toBe('invalid')
    expect(replaceSpy).toHaveBeenCalledTimes(0)
    expect(result.repository).toBe(repository)
  })

  it('repository actualizado cuando validation es valida', () => {
    const { builder, validator } = createMockPorts({})
    const engine = createInsightEngine({ builder, validator })
    const { repository, replaceSpy } = createRepositorySpy()

    const result = engine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository,
    })

    expect(result.status).toBe('accepted')
    expect(result.repositoryUpdated).toBe(true)
    expect(replaceSpy).toHaveBeenCalledTimes(1)
  })

  it('builder invocado una sola vez', () => {
    const { builder, validator, buildSpy } = createMockPorts({})
    const engine = createInsightEngine({ builder, validator })

    engine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository: createInsightRepository(),
    })

    expect(buildSpy).toHaveBeenCalledTimes(1)
  })

  it('validator invocado una sola vez', () => {
    const { builder, validator, validateSpy } = createMockPorts({})
    const engine = createInsightEngine({ builder, validator })

    engine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository: createInsightRepository(),
    })

    expect(validateSpy).toHaveBeenCalledTimes(1)
  })

  it('repository invocado unicamente cuando corresponde', () => {
    const repositorySpy = createRepositorySpy()
    const firstPorts = createMockPorts({})
    const firstEngine = createInsightEngine({
      builder: firstPorts.builder,
      validator: firstPorts.validator,
    })
    const secondPorts = createMockPorts({
      validatorReport: createValidationReport([
        {
          code: 'INSIGHT_VALIDATION_INVALID_SCOPE',
          path: 'collection',
          message: 'scope mismatch',
        },
      ]),
    })
    const secondEngine = createInsightEngine({
      builder: secondPorts.builder,
      validator: secondPorts.validator,
    })

    firstEngine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository: repositorySpy.repository,
    })
    secondEngine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository: repositorySpy.repository,
    })

    expect(repositorySpy.replaceSpy).toHaveBeenCalledTimes(1)
  })

  it('determinismo', () => {
    const ports = createMockPorts({})
    const engine = createInsightEngine({
      builder: ports.builder,
      validator: ports.validator,
    })
    const input = {
      knowledgeCollection: createKnowledgeCollection(),
      rules: [] as const,
      repository: createInsightRepository(),
    }

    const first = engine.run(input)
    const second = engine.run(input)

    expect(first.status).toBe(second.status)
    expect(first.repositoryUpdated).toBe(second.repositoryUpdated)
    expect(first.collection).toEqual(second.collection)
    expect(first.assessment).toEqual(second.assessment)
    expect(first.validationReport).toEqual(second.validationReport)
  })

  it('fail-closed', () => {
    const ports = createMockPorts({})
    const corruptedValidator: InsightEngineValidatorPort = {
      validate: vi.fn(
        () =>
          ({
            status: 'valid',
            failClosed: false,
            deterministic: true,
            issueCount: 0,
            issues: [],
          }) as unknown as ReturnType<typeof createValidationReport>,
      ),
    }
    const engine = createInsightEngine({
      builder: ports.builder,
      validator: corruptedValidator,
    })
    const { repository, replaceSpy } = createRepositorySpy()

    const result = engine.run({
      knowledgeCollection: createKnowledgeCollection(),
      rules: [],
      repository,
    })

    expect(result.status).toBe('rejected')
    expect(result.repositoryUpdated).toBe(false)
    expect(result.validationReport.status).toBe('invalid')
    expect(replaceSpy).toHaveBeenCalledTimes(0)
  })
})
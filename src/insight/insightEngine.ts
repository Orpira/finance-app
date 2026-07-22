import { INSIGHT_RULE_PROTOCOL_VERSION } from '../types/insightRule'
import {
  buildInsightCollection,
} from './insightBuilder'
import type {
  InsightEngine,
  InsightEngineDependencies,
  InsightEngineBuilderPort,
  InsightEngineValidatorPort,
  RunInsightEngineInput,
} from './engineInterfaces'
import type { InsightEngineResult } from './engineResult'
import type { InsightBuildAssessment, InsightCollection } from './types'
import {
  validateInsightCollection,
} from './insightValidator'
import {
  createValidationReport,
} from './validationReport'

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = deepClone(item)
  }

  return result as T
}

function buildDefaultBuilderPort(): InsightEngineBuilderPort {
  return {
    build(input) {
      return buildInsightCollection(input)
    },
  }
}

function buildDefaultValidatorPort(): InsightEngineValidatorPort {
  return {
    validate(input) {
      return validateInsightCollection(input)
    },
  }
}

function resolveDependencies(
  dependencies: Partial<InsightEngineDependencies>,
): InsightEngineDependencies {
  return {
    builder: dependencies.builder ?? buildDefaultBuilderPort(),
    validator: dependencies.validator ?? buildDefaultValidatorPort(),
  }
}

function createFailClosedReport(path: string, message: string) {
  return createValidationReport([
    {
      code: 'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
      path,
      message,
    },
  ])
}

function buildEmptyCollection(input: RunInsightEngineInput): InsightCollection {
  return {
    protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    sourceKnowledgeCollectionId: input.knowledgeCollection.identity.knowledgeCollectionId,
    sourceSnapshotId: input.knowledgeCollection.identity.sourceSnapshotId,
    sourceSnapshotKey: input.knowledgeCollection.identity.sourceSnapshotKey,
    sourceSnapshotRevision: input.knowledgeCollection.identity.sourceSnapshotRevision,
    deterministicOutput: true,
    failClosed: true,
    insights: [],
    executions: [],
  }
}

function buildFailClosedAssessment(input: RunInsightEngineInput): InsightBuildAssessment {
  return {
    status: 'blocked',
    failures: [
      {
        code: 'RULE_EXECUTION_BLOCKED',
        message: 'insight engine orchestrator blocked by fail-closed policy',
      },
    ],
    generatedInsights: 0,
    skippedRules: input.rules.length,
  }
}

function canUpdateRepository(
  validationReport: InsightEngineResult['validationReport'],
  collection: InsightCollection,
): boolean {
  return (
    validationReport.status === 'valid' &&
    validationReport.failClosed === true &&
    validationReport.deterministic === true &&
    collection.failClosed === true &&
    collection.deterministicOutput === true
  )
}

function rejectResult(input: {
  readonly repository: RunInsightEngineInput['repository']
  readonly collection: InsightCollection
  readonly assessment: InsightBuildAssessment
  readonly validationReport: InsightEngineResult['validationReport']
}): InsightEngineResult {
  return {
    status: 'rejected',
    deterministic: true,
    failClosed: true,
    repositoryUpdated: false,
    collection: deepClone(input.collection),
    assessment: deepClone(input.assessment),
    validationReport: deepClone(input.validationReport),
    repository: input.repository,
  }
}

export function createInsightEngine(
  dependencies: Partial<InsightEngineDependencies> = {},
): InsightEngine {
  const ports = resolveDependencies(dependencies)

  return {
    run(input: RunInsightEngineInput): InsightEngineResult {
      try {
        const rules = [...input.rules]

        const buildResult = ports.builder.build({
          knowledgeCollection: deepClone(input.knowledgeCollection),
          rules: deepClone(rules),
        })

        const validationReport = ports.validator.validate({
          collection: deepClone(buildResult.collection),
          rules: deepClone(rules),
        })

        if (!canUpdateRepository(validationReport, buildResult.collection)) {
          const failClosedReport =
            validationReport.status === 'invalid'
              ? validationReport
              : createFailClosedReport(
                  'engine.validation',
                  'validator reported valid result without fail-closed invariants',
                )

          return rejectResult({
            repository: input.repository,
            collection: buildResult.collection,
            assessment: buildResult.assessment,
            validationReport: failClosedReport,
          })
        }

        const updatedRepository = input.repository.replace(
          deepClone(buildResult.collection),
        )

        return {
          status: 'accepted',
          deterministic: true,
          failClosed: true,
          repositoryUpdated: true,
          collection: deepClone(buildResult.collection),
          assessment: deepClone(buildResult.assessment),
          validationReport: deepClone(validationReport),
          repository: updatedRepository,
        }
      } catch {
        return rejectResult({
          repository: input.repository,
          collection: buildEmptyCollection(input),
          assessment: buildFailClosedAssessment(input),
          validationReport: createFailClosedReport(
            'engine.run',
            'pipeline execution failed and was rejected by fail-closed policy',
          ),
        })
      }
    },
  }
}
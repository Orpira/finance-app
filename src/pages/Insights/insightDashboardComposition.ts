import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import {
  createInsightExecutionService,
} from '../../services/insightExecutionService'
import type {
  InsightExecutionRequest,
} from '../../services/insightExecutionResult'
import { createInsightReadModels } from '../../services/insightReadModels'
import {
  createKnowledgeIntegration,
} from '../../services/knowledgeIntegration'
import type {
  KnowledgeIntegrationRuntimeAdapterPort,
} from '../../services/knowledgeIntegrationInterfaces'
import {
  DEFAULT_RUNTIME_ADAPTER_VERSIONS,
} from '../../services/runtimeAdapter'
import {
  createSnapshotKnowledgeIntegration,
  createSnapshotKnowledgeLayerPort,
} from '../../services/snapshotKnowledgeIntegration'
import { getSettings } from '../../services/settingsService'
import {
  createInsightEngine,
} from '../../insight/insightEngine'
import {
  createInsightRepository,
} from '../../insight/insightRepository'
import {
  createInsightRuntime,
} from '../../insight/insightRuntime'
import type {
  InsightRuntimeRequest,
} from '../../insight/runtimeRequest'
import {
  FinancialSnapshotRepository,
  FinancialSnapshotPersistenceError,
} from '../../intelligence/financial-snapshot/financialSnapshotRepository'
import { deriveSnapshotKey } from '../../intelligence/financial-snapshot/snapshotSealer'
import {
  materializeMetadataFromCanonicalDocument,
  materializeScopeFromCanonicalDocument,
} from '../../intelligence/financial-snapshot/snapshotProtocol'
import {
  EMPTY_INSIGHT_RULES_CATALOG,
  INSIGHT_RULE_PROTOCOL_VERSION,
} from '../../types/insightRule'
import type {
  CanonicalSnapshotDocument,
  IanaTimeZone,
  SealedFinancialSnapshot,
  SnapshotKey,
  UtcInstant,
} from '../../types/financialSnapshot'
import type {
  PersistedFinancialSnapshot,
} from '../../types/persistedFinancialSnapshot'
import type {
  RuntimeAdapterResult,
} from '../../services/adapterInterfaces'
import type {
  ValidatedKnowledgeCollection,
} from '../../types/knowledgeLayer'
import type {
  InsightDashboardControllerDependencies,
  InsightDashboardRequestFactory,
} from './insightDashboardController'

function clone<T>(value: T): T {
  return structuredClone(value)
}

function monthRange(): {
  readonly periodStart: string
  readonly periodEndExclusive: string
} {
  const now = new Date()
  const periodStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toLocaleDateString('en-CA')
  const periodEndExclusive = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
  ).toLocaleDateString('en-CA')

  return {
    periodStart,
    periodEndExclusive,
  }
}

function buildCurrentMonthlySnapshotKey(input: {
  readonly usageMode: string
  readonly currency: string
  readonly earningPeriodId?: number
}): SnapshotKey {
  const range = monthRange()
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone as IanaTimeZone
  const asOf = new Date().toISOString() as UtcInstant

  const canonicalDocument = {
    canonicalizationVersion: 'financial-snapshot-c14n/1.0.0',
    payload: {
      scope: {
        kind: 'monthly',
        periodStart: range.periodStart,
        periodEndExclusive: range.periodEndExclusive,
        periodBoundary: '[start,end)',
        asOf,
        timezone,
        usageMode: input.usageMode,
        currency: input.currency,
        ...(input.earningPeriodId === undefined
          ? {}
          : { earningPeriodId: input.earningPeriodId }),
        filters: {},
      },
    },
  } as unknown as CanonicalSnapshotDocument<unknown>

  return deriveSnapshotKey(canonicalDocument)
}

function toSealedSnapshot(
  persisted: PersistedFinancialSnapshot,
): SealedFinancialSnapshot<unknown> {
  return {
    identity: {
      snapshotId: persisted.snapshotId,
      snapshotKey: persisted.snapshotKey,
    },
    revision: {
      revision: persisted.revision,
      reasonCode: persisted.revisionReasonCode,
      ...(persisted.supersedesSnapshotId === undefined
        ? {}
        : { supersedesSnapshotId: persisted.supersedesSnapshotId }),
    },
    status: 'sealed',
    canonicalDocument: clone(persisted.canonicalDocument),
    fingerprint: clone(persisted.fingerprint),
    sealedAt: persisted.sealedAt,
    snapshotVersion: persisted.snapshotVersion,
    canonicalizationVersion: persisted.canonicalizationVersion,
    engineVersion: persisted.engineVersion,
    rulesetVersion: persisted.rulesetVersion,
    scope: materializeScopeFromCanonicalDocument(persisted.canonicalDocument),
    evidence: clone(persisted.canonicalDocument.payload.evidence),
    appliedRules: clone(persisted.canonicalDocument.payload.appliedRules),
    metadata: materializeMetadataFromCanonicalDocument(persisted.canonicalDocument),
  }
}

function createDashboardRequestFactory(): InsightDashboardRequestFactory {
  const snapshotRepository = new FinancialSnapshotRepository()

  return {
    async createRequest(): Promise<InsightExecutionRequest | null> {
      const settings = await getSettings()
      const activePeriod = await getActiveEarningPeriod()
      const isProfessional = settings.usageMode === 'professional'

      const snapshotKey = buildCurrentMonthlySnapshotKey({
        usageMode: settings.usageMode,
        currency: settings.defaultCurrency,
        ...(isProfessional && activePeriod?.id !== undefined
          ? { earningPeriodId: activePeriod.id }
          : {}),
      })

      let persistedSnapshot: PersistedFinancialSnapshot
      try {
        persistedSnapshot = await snapshotRepository.getLatestBySnapshotKey(snapshotKey)
      } catch (error) {
        if (
          error instanceof FinancialSnapshotPersistenceError &&
          error.code === 'SNAPSHOT_PERSISTENCE_NOT_FOUND'
        ) {
          return null
        }

        throw error
      }

      const snapshot = toSealedSnapshot(persistedSnapshot)

      return {
        executionId: `insight-dashboard:${snapshot.identity.snapshotId}:${snapshot.revision.revision}`,
        snapshotIntegrationId:
          `insight-dashboard:snapshot:${snapshot.identity.snapshotId}:${snapshot.revision.revision}`,
        knowledgeIntegrationId:
          `insight-dashboard:knowledge:${snapshot.identity.snapshotId}:${snapshot.revision.revision}`,
        snapshot,
        rules: EMPTY_INSIGHT_RULES_CATALOG.rules,
        versions: DEFAULT_RUNTIME_ADAPTER_VERSIONS,
        protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
      }
    },
  }
}

function createRuntimeAdapterBridge(): KnowledgeIntegrationRuntimeAdapterPort {
  const runtime = createInsightRuntime({
    orchestrator: createInsightEngine(),
    repository: createInsightRepository(),
  })

  return {
    execute(request: InsightRuntimeRequest): RuntimeAdapterResult {
      if (request.knowledgeCollection.state !== 'validated') {
        return {
          ok: false,
          status: 'adapter-failure',
          deterministic: true,
          failClosed: true,
          executionId: request.executionId,
          code: 'ADAPTER_INVALID_INPUT',
          message: 'runtime bridge requires validated knowledgeCollection',
        }
      }

      const validatedCollection = clone(
        request.knowledgeCollection,
      ) as ValidatedKnowledgeCollection
      const response = runtime.execute(clone(request))

      if (response.ok) {
        return {
          ok: true,
          status: 'success',
          deterministic: true,
          failClosed: true,
          request: clone(request),
          knowledgeCollection: validatedCollection,
          response: clone(response),
        }
      }

      return {
        ok: false,
        status: 'runtime-failure',
        deterministic: true,
        failClosed: true,
        request: clone(request),
        knowledgeCollection: validatedCollection,
        response: clone(response),
      }
    },
  }
}

export function createInsightDashboardDependencies(): InsightDashboardControllerDependencies {
  const snapshotIntegration = createSnapshotKnowledgeIntegration({
    knowledgeLayer: createSnapshotKnowledgeLayerPort(),
  })

  const knowledgeIntegration = createKnowledgeIntegration({
    runtimeAdapter: createRuntimeAdapterBridge(),
  })

  const executionService = createInsightExecutionService({
    snapshotIntegration,
    knowledgeIntegration,
  })

  return {
    executionService,
    readModels: createInsightReadModels(),
    requestFactory: createDashboardRequestFactory(),
  }
}

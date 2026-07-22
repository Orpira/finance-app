import type { InsightRuntimeRequest } from '../insight/runtimeRequest'
import type {
  RuntimeAdapterResult,
} from './adapterInterfaces'
import type {
  KnowledgeCollectionVersions,
} from '../types/knowledgeLayer'
import type {
  InsightRuleProtocolVersion,
} from '../types/insightRule'
import type {
  KnowledgeIntegrationRequest,
  KnowledgeIntegrationResult,
} from './knowledgeIntegrationResult'

export interface KnowledgeIntegrationRuntimeAdapterPort {
  execute(request: InsightRuntimeRequest): RuntimeAdapterResult
}

export interface KnowledgeIntegrationDependencies {
  readonly runtimeAdapter?: KnowledgeIntegrationRuntimeAdapterPort
  readonly supportedVersions?: KnowledgeCollectionVersions
  readonly supportedProtocolVersion?: InsightRuleProtocolVersion
}

export interface KnowledgeIntegration {
  integrate(
    request: KnowledgeIntegrationRequest | null | undefined,
  ): KnowledgeIntegrationResult
}

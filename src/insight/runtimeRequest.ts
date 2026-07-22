import type {
  InsightRuleDescriptor,
  InsightRuleProtocolVersion,
} from '../types/insightRule'
import type { KnowledgeCollection } from '../types/knowledgeLayer'

export interface InsightRuntimeRequest {
  readonly executionId: string
  readonly protocolVersion: InsightRuleProtocolVersion
  readonly knowledgeCollection: KnowledgeCollection
  readonly rules: readonly InsightRuleDescriptor[]
}

import type {
  InsightRuleDescriptor,
  InsightRulePolicyCode,
} from '../types/insightRule'
import type {
  KnowledgeCollection,
  KnowledgeFact,
} from '../types/knowledgeLayer'

export interface InsightConfidenceEvaluationContext {
  readonly knowledgeCollection: KnowledgeCollection
  readonly rule: InsightRuleDescriptor
  readonly matchedFacts: readonly KnowledgeFact[]
}

export interface InsightRuleEnablement {
  isRuleEnabled(rule: InsightRuleDescriptor): boolean
}

export interface InsightConfidencePolicyResolver {
  evaluateEvidenceDerivedConfidence(
    policyCode: InsightRulePolicyCode,
    context: InsightConfidenceEvaluationContext,
  ): number | null
}

export interface InsightBuilderDependencies {
  readonly ruleEnablement?: InsightRuleEnablement
  readonly confidencePolicyResolver?: InsightConfidencePolicyResolver
}

export interface BuildInsightCollectionInput {
  readonly knowledgeCollection: KnowledgeCollection
  readonly rules: readonly InsightRuleDescriptor[]
}

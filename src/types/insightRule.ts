import type { IanaTimeZone } from './financialSnapshot'
import type {
  KnowledgeFactId,
  KnowledgeRevision,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
} from './knowledgeLayer'
import type { CurrencyCode } from './settings'

declare const insightRuleIdBrand: unique symbol
declare const insightRuleVersionBrand: unique symbol
declare const insightRuleParameterIdBrand: unique symbol
declare const insightRuleDependencyIdBrand: unique symbol
declare const insightRuleTitleCodeBrand: unique symbol
declare const insightRuleMessageCodeBrand: unique symbol
declare const insightRuleSummaryCodeBrand: unique symbol
declare const insightRulePolicyCodeBrand: unique symbol
declare const insightRuleCatalogVersionBrand: unique symbol

export const INSIGHT_RULE_PROTOCOL_VERSION = 1 as const

export type InsightRuleProtocolVersion = number

export const INSIGHT_RULE_CATEGORIES = [
  'cash-flow',
  'spending',
  'income',
  'savings',
  'balance',
  'trend',
  'anomaly',
  'recurring',
  'data-quality',
] as const

export const INSIGHT_RULE_SEVERITIES = [
  'info',
  'notice',
  'warning',
  'critical',
] as const

export const INSIGHT_RULE_STATUSES = [
  'draft',
  'active',
  'deprecated',
  'retired',
] as const

export const INSIGHT_RULE_SNAPSHOT_TYPES = ['knowledge'] as const

export const INSIGHT_RULE_SCOPE_KINDS = ['aggregate', 'account'] as const

export const INSIGHT_RULE_FACT_MATCH_POLICIES = [
  'all-required',
  'any-required',
  'at-least-one',
] as const

export const INSIGHT_RULE_EVIDENCE_TYPES = [
  'knowledge-fact-set',
  'knowledge-fact-link',
  'knowledge-snapshot-derivation',
] as const

export const INSIGHT_RULE_PARAMETER_KINDS = [
  'string',
  'integer',
  'boolean',
  'enum',
  'string-list',
  'integer-list',
  'json-object',
] as const

export const INSIGHT_RULE_OUTPUT_KINDS = [
  'observation',
  'warning',
  'anomaly',
  'trend',
] as const

export const INSIGHT_RULE_FAIL_CLOSED_INVARIANTS = [
  'duplicate-rule-identity',
  'incompatible-protocol-version',
  'unknown-rule-category',
  'missing-dependency-contract',
  'missing-message-code',
  'missing-title-code',
  'invalid-confidence-policy',
  'incompatible-facts-contract',
] as const

export type InsightRuleCategory = (typeof INSIGHT_RULE_CATEGORIES)[number]

export type InsightRuleSeverity = (typeof INSIGHT_RULE_SEVERITIES)[number]

export type InsightRuleStatus = (typeof INSIGHT_RULE_STATUSES)[number]

export type InsightRuleSnapshotType =
  (typeof INSIGHT_RULE_SNAPSHOT_TYPES)[number]

export type InsightRuleScopeKind = (typeof INSIGHT_RULE_SCOPE_KINDS)[number]

export type InsightRuleFactMatchPolicy =
  (typeof INSIGHT_RULE_FACT_MATCH_POLICIES)[number]

export type InsightRuleEvidenceType =
  (typeof INSIGHT_RULE_EVIDENCE_TYPES)[number]

export type InsightRuleParameterKind =
  (typeof INSIGHT_RULE_PARAMETER_KINDS)[number]

export type InsightRuleOutputKind = (typeof INSIGHT_RULE_OUTPUT_KINDS)[number]

export type InsightRuleFailClosedInvariant =
  (typeof INSIGHT_RULE_FAIL_CLOSED_INVARIANTS)[number]

export type InsightRuleId = string & {
  readonly [insightRuleIdBrand]: 'InsightRuleId'
}

export type InsightRuleVersion = string & {
  readonly [insightRuleVersionBrand]: 'InsightRuleVersion'
}

export type InsightRuleParameterId = string & {
  readonly [insightRuleParameterIdBrand]: 'InsightRuleParameterId'
}

export type InsightRuleDependencyId = string & {
  readonly [insightRuleDependencyIdBrand]: 'InsightRuleDependencyId'
}

export type InsightRuleTitleCode = string & {
  readonly [insightRuleTitleCodeBrand]: 'InsightRuleTitleCode'
}

export type InsightRuleMessageCode = string & {
  readonly [insightRuleMessageCodeBrand]: 'InsightRuleMessageCode'
}

export type InsightRuleSummaryCode = string & {
  readonly [insightRuleSummaryCodeBrand]: 'InsightRuleSummaryCode'
}

export type InsightRulePolicyCode = string & {
  readonly [insightRulePolicyCodeBrand]: 'InsightRulePolicyCode'
}

export type InsightRuleCatalogVersion = string & {
  readonly [insightRuleCatalogVersionBrand]: 'InsightRuleCatalogVersion'
}

export type InsightRuleJsonPrimitive = string | number | boolean | null

export type InsightRuleJsonValue =
  | InsightRuleJsonPrimitive
  | InsightRuleJsonObject
  | readonly InsightRuleJsonValue[]

export interface InsightRuleJsonObject {
  readonly [key: string]: InsightRuleJsonValue
}

export interface InsightRuleReference {
  readonly ruleId: InsightRuleId
  readonly ruleVersion: InsightRuleVersion
  readonly protocolVersion: InsightRuleProtocolVersion
}

export type InsightRuleCurrencyRequirement =
  | {
      readonly mode: 'input-currency'
    }
  | {
      readonly mode: 'fixed-currency'
      readonly currency: CurrencyCode
    }

export type InsightRuleTimezoneRequirement =
  | {
      readonly mode: 'snapshot-timezone'
    }
  | {
      readonly mode: 'fixed-timezone'
      readonly timezone: IanaTimeZone
    }
  | {
      readonly mode: 'any-iana'
    }

export interface InsightRuleScopeRequirement {
  readonly scopeKinds: readonly InsightRuleScopeKind[]
  readonly requiresAsOf: true
  readonly currencyRequirement: InsightRuleCurrencyRequirement
  readonly timezoneRequirement: InsightRuleTimezoneRequirement
}

export interface InsightRuleKnowledgeDependency {
  readonly sourceLayer: 'knowledge-layer'
  readonly snapshotTypes: readonly InsightRuleSnapshotType[]
  readonly requiredKnowledgeVersions: readonly KnowledgeVersion[]
  readonly minimumKnowledgeRevision: KnowledgeRevision | null
  readonly snapshotKeyMode: 'any' | 'whitelist'
  readonly snapshotKeys: readonly KnowledgeSnapshotKey[]
  readonly requiredFacts: readonly [KnowledgeFactId, ...KnowledgeFactId[]]
  readonly factMatchPolicy: InsightRuleFactMatchPolicy
  readonly requiredScope: InsightRuleScopeRequirement
  readonly compatibleInsightCategories: readonly InsightRuleCategory[]
}

export interface InsightRuleDependency {
  readonly dependencyId: InsightRuleDependencyId
  readonly knowledge: InsightRuleKnowledgeDependency
}

export type InsightRuleConfidencePolicy =
  | {
      readonly mode: 'fixed-score'
      readonly scoreUnit: 'percent-0-100'
      readonly score: number
    }
  | {
      readonly mode: 'bounded-score'
      readonly scoreUnit: 'percent-0-100'
      readonly minimumScore: number
      readonly maximumScore: number
    }
  | {
      readonly mode: 'evidence-derived'
      readonly scoreUnit: 'percent-0-100'
      readonly policyCode: InsightRulePolicyCode
    }

export interface InsightRuleOutput {
  readonly outputKind: InsightRuleOutputKind
  readonly titleCode: InsightRuleTitleCode
  readonly messageCode: InsightRuleMessageCode
  readonly category: InsightRuleCategory
  readonly severity: InsightRuleSeverity
  readonly confidencePolicy: InsightRuleConfidencePolicy
  readonly evidenceType: InsightRuleEvidenceType
}

export interface InsightRuleEvidence {
  readonly evidenceType: InsightRuleEvidenceType
  readonly summaryCode: InsightRuleSummaryCode
  readonly requiredFacts: readonly [KnowledgeFactId, ...KnowledgeFactId[]]
  readonly traceabilityRequired: true
  readonly source: 'knowledge'
}

export type InsightRuleParameterConstraint =
  | {
      readonly kind: 'none'
    }
  | {
      readonly kind: 'enum'
      readonly allowedValues: readonly [InsightRuleJsonPrimitive, ...InsightRuleJsonPrimitive[]]
    }
  | {
      readonly kind: 'integer-range'
      readonly minimum: number
      readonly maximum: number
    }
  | {
      readonly kind: 'string-pattern'
      readonly patternCode: InsightRulePolicyCode
    }

export interface InsightRuleParameter {
  readonly parameterId: InsightRuleParameterId
  readonly name: string
  readonly kind: InsightRuleParameterKind
  readonly required: boolean
  readonly defaultValue: InsightRuleJsonValue | null
  readonly constraint: InsightRuleParameterConstraint
}

export interface InsightRuleInput {
  readonly dependency: InsightRuleDependency
  readonly parameters: readonly InsightRuleParameter[]
}

export interface InsightRuleCompatibility {
  readonly minimumProtocol: InsightRuleProtocolVersion
  readonly maximumProtocol: InsightRuleProtocolVersion
  readonly deprecated: boolean
  readonly replacementRule: InsightRuleReference | null
  readonly breakingChanges: readonly string[]
  readonly supportedKnowledgeVersion: readonly KnowledgeVersion[]
}

export interface InsightRuleLifecycle {
  readonly status: InsightRuleStatus
  readonly introducedInProtocol: InsightRuleProtocolVersion
  readonly deprecatedInProtocol: InsightRuleProtocolVersion | null
  readonly retiredInProtocol: InsightRuleProtocolVersion | null
}

export interface InsightRuleMetadata {
  readonly domain: 'insight-engine'
  readonly ownerTeam: string
  readonly tags: readonly string[]
  readonly deterministicIdentity: true
  readonly deterministicOutput: true
  readonly localFirst: true
  readonly failClosed: true
}

export interface InsightRuleDescriptor {
  readonly reference: InsightRuleReference
  readonly input: InsightRuleInput
  readonly output: InsightRuleOutput
  readonly evidence: InsightRuleEvidence
  readonly metadata: InsightRuleMetadata
  readonly compatibility: InsightRuleCompatibility
  readonly lifecycle: InsightRuleLifecycle
}

export interface InsightRulesCatalog {
  readonly catalogVersion: InsightRuleCatalogVersion
  readonly protocolVersion: InsightRuleProtocolVersion
  readonly rules: readonly InsightRuleDescriptor[]
  readonly failClosedInvariants: readonly InsightRuleFailClosedInvariant[]
}

export const EMPTY_INSIGHT_RULES_CATALOG: InsightRulesCatalog = {
  catalogVersion: 'insight-rules-catalog/1.0.0' as InsightRuleCatalogVersion,
  protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
  rules: [],
  failClosedInvariants: [...INSIGHT_RULE_FAIL_CLOSED_INVARIANTS],
}
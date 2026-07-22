import {
  INSIGHT_RULE_PROTOCOL_VERSION,
  type InsightRuleConfidencePolicy,
  type InsightRuleDescriptor,
  type InsightRuleFactMatchPolicy,
  type InsightRuleScopeKind,
} from '../types/insightRule'
import type {
  KnowledgeCollection,
  KnowledgeFact,
} from '../types/knowledgeLayer'
import type {
  BuildInsightCollectionInput,
  InsightBuilderDependencies,
} from './interfaces'
import type {
  Insight,
  InsightBuildResult,
  InsightBuilderFailure,
  InsightCollection,
  InsightConfidence,
  InsightEvidence,
  InsightEvidenceFactReference,
  InsightId,
  InsightRuleCompatibilityCheck,
  InsightRuleSkipReasonCode,
} from './types'

function stableSortRules(
  rules: readonly InsightRuleDescriptor[],
): readonly InsightRuleDescriptor[] {
  return [...rules].sort((left, right) => {
    const idDiff = left.reference.ruleId.localeCompare(right.reference.ruleId)
    if (idDiff !== 0) {
      return idDiff
    }

    const versionDiff = left.reference.ruleVersion.localeCompare(
      right.reference.ruleVersion,
    )
    if (versionDiff !== 0) {
      return versionDiff
    }

    return left.reference.protocolVersion - right.reference.protocolVersion
  })
}

function buildEmptyInsightCollection(
  knowledgeCollection: KnowledgeCollection,
): InsightCollection {
  return {
    protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    sourceKnowledgeCollectionId: knowledgeCollection.identity.knowledgeCollectionId,
    sourceSnapshotId: knowledgeCollection.identity.sourceSnapshotId,
    sourceSnapshotKey: knowledgeCollection.identity.sourceSnapshotKey,
    sourceSnapshotRevision: knowledgeCollection.identity.sourceSnapshotRevision,
    deterministicOutput: true,
    failClosed: true,
    insights: [],
    executions: [],
  }
}

function validateKnowledgeCollection(
  knowledgeCollection: KnowledgeCollection,
): string | null {
  if (knowledgeCollection.state !== 'validated') {
    return 'knowledge collection must be validated'
  }

  if (knowledgeCollection.factCount !== knowledgeCollection.facts.length) {
    return 'knowledge collection factCount is inconsistent'
  }

  const seenFactIds = new Set<string>()
  for (const fact of knowledgeCollection.facts) {
    const factId = String(fact.factId)
    if (seenFactIds.has(factId)) {
      return 'knowledge collection contains duplicate fact ids'
    }
    seenFactIds.add(factId)
  }

  return null
}

function buildFactMap(
  facts: readonly KnowledgeFact[],
): ReadonlyMap<string, KnowledgeFact> {
  return new Map(facts.map((fact) => [String(fact.factId), fact]))
}

function matchRequiredFacts(
  requiredFacts: readonly string[],
  policy: InsightRuleFactMatchPolicy,
  factMap: ReadonlyMap<string, KnowledgeFact>,
): boolean {
  if (requiredFacts.length === 0) {
    return false
  }

  const matched = requiredFacts.filter((factId) => factMap.has(factId)).length

  if (policy === 'all-required') {
    return matched === requiredFacts.length
  }

  return matched > 0
}

function inferScopeKind(
  knowledgeCollection: KnowledgeCollection,
): InsightRuleScopeKind | null {
  if (knowledgeCollection.facts.length === 0) {
    return null
  }

  return 'aggregate'
}

function hasRequiredAsOfShape(
  knowledgeCollection: KnowledgeCollection,
): boolean {
  const fact = knowledgeCollection.facts[0]
  if (fact === undefined) {
    return false
  }

  return (
    typeof fact.scope.periodStart === 'string' &&
    fact.scope.periodStart.length > 0 &&
    typeof fact.scope.periodEndExclusive === 'string' &&
    fact.scope.periodEndExclusive.length > 0
  )
}

function hasCompatibleCurrency(
  knowledgeCollection: KnowledgeCollection,
  rule: InsightRuleDescriptor,
): boolean {
  const fact = knowledgeCollection.facts[0]
  if (fact === undefined) {
    return false
  }

  const currencyRequirement =
    rule.input.dependency.knowledge.requiredScope.currencyRequirement

  if (currencyRequirement.mode === 'input-currency') {
    return typeof fact.context.currency === 'string' && fact.context.currency.length > 0
  }

  return fact.context.currency === currencyRequirement.currency
}

function hasCompatibleTimezone(
  knowledgeCollection: KnowledgeCollection,
  rule: InsightRuleDescriptor,
): boolean {
  const fact = knowledgeCollection.facts[0]
  if (fact === undefined) {
    return false
  }

  const timezoneRequirement =
    rule.input.dependency.knowledge.requiredScope.timezoneRequirement

  if (timezoneRequirement.mode === 'snapshot-timezone') {
    return typeof fact.context.timezone === 'string' && fact.context.timezone.length > 0
  }

  if (timezoneRequirement.mode === 'fixed-timezone') {
    return fact.context.timezone === timezoneRequirement.timezone
  }

  return (
    typeof fact.context.timezone === 'string' &&
    fact.context.timezone.length > 0 &&
    fact.context.timezone.includes('/')
  )
}

function buildCompatibilityChecks(
  knowledgeCollection: KnowledgeCollection,
  rule: InsightRuleDescriptor,
  factMap: ReadonlyMap<string, KnowledgeFact>,
): readonly InsightRuleCompatibilityCheck[] {
  const dependency = rule.input.dependency.knowledge
  const collectionKnowledgeVersion = knowledgeCollection.versions.knowledgeVersion
  const collectionSnapshotRevision = knowledgeCollection.identity.sourceSnapshotRevision
  const collectionSnapshotKey = String(knowledgeCollection.identity.sourceSnapshotKey)
  const requiredFactIds = dependency.requiredFacts.map((factId) => String(factId))
  const evidenceRequiredFactIds = rule.evidence.requiredFacts.map((factId) =>
    String(factId),
  )
  const scopeKind = inferScopeKind(knowledgeCollection)
  const minimumRevision =
    dependency.minimumKnowledgeRevision === null
      ? null
      : Number(dependency.minimumKnowledgeRevision)

  const checks: InsightRuleCompatibilityCheck[] = [
    {
      code: 'rule-protocol-compatible',
      passed:
        rule.reference.protocolVersion >= rule.compatibility.minimumProtocol &&
        rule.reference.protocolVersion <= rule.compatibility.maximumProtocol,
    },
    {
      code: 'rule-metadata-deterministic',
      passed:
        rule.metadata.deterministicIdentity &&
        rule.metadata.deterministicOutput &&
        rule.metadata.localFirst &&
        rule.metadata.failClosed,
    },
    {
      code: 'output-evidence-type-aligned',
      passed: rule.output.evidenceType === rule.evidence.evidenceType,
    },
    {
      code: 'knowledge-version-supported',
      passed: rule.compatibility.supportedKnowledgeVersion.some(
        (version) => version === collectionKnowledgeVersion,
      ),
    },
    {
      code: 'knowledge-version-required',
      passed: dependency.requiredKnowledgeVersions.some(
        (version) => version === collectionKnowledgeVersion,
      ),
    },
    {
      code: 'minimum-revision-satisfied',
      passed:
        minimumRevision === null ||
        collectionSnapshotRevision >= minimumRevision,
    },
    {
      code: 'snapshot-key-compatible',
      passed:
        dependency.snapshotKeyMode === 'any' ||
        dependency.snapshotKeys.some(
          (snapshotKey) => String(snapshotKey) === collectionSnapshotKey,
        ),
    },
    {
      code: 'facts-match-policy',
      passed: matchRequiredFacts(
        requiredFactIds,
        dependency.factMatchPolicy,
        factMap,
      ),
    },
    {
      code: 'evidence-required-facts-present',
      passed: evidenceRequiredFactIds.every((factId) => factMap.has(factId)),
    },
    {
      code: 'scope-kind-compatible',
      passed:
        scopeKind !== null &&
        dependency.requiredScope.scopeKinds.includes(scopeKind),
    },
    {
      code: 'scope-asof-compatible',
      passed:
        !dependency.requiredScope.requiresAsOf ||
        hasRequiredAsOfShape(knowledgeCollection),
    },
    {
      code: 'scope-currency-compatible',
      passed: hasCompatibleCurrency(knowledgeCollection, rule),
    },
    {
      code: 'scope-timezone-compatible',
      passed: hasCompatibleTimezone(knowledgeCollection, rule),
    },
    {
      code: 'output-category-compatible',
      passed: dependency.compatibleInsightCategories.includes(rule.output.category),
    },
  ]

  return checks
}

function buildEvidence(
  rule: InsightRuleDescriptor,
  factMap: ReadonlyMap<string, KnowledgeFact>,
): InsightEvidence {
  const requiredFacts = rule.evidence.requiredFacts.map((factId) => String(factId))

  const matchedFacts: InsightEvidenceFactReference[] = requiredFacts
    .filter((factId) => factMap.has(factId))
    .map((factId) => {
      const fact = factMap.get(factId)
      if (fact === undefined) {
        throw new Error('fact not found while building evidence')
      }

      return {
        factId: fact.factId,
        factType: fact.factType,
        category: fact.category,
        severity: fact.severity,
        sourceSnapshotId: fact.origin.sourceSnapshotId,
        sourceSnapshotKey: fact.origin.sourceSnapshotKey,
        sourceSnapshotRevision: fact.origin.sourceSnapshotRevision,
        sourceFingerprintValue: fact.evidence.sourceFingerprintValue,
      }
    })

  const missingFacts = requiredFacts
    .filter((factId) => !factMap.has(factId))
    .map((factId) => factId as InsightEvidence['missingFacts'][number])

  return {
    evidenceType: rule.evidence.evidenceType,
    summaryCode: rule.evidence.summaryCode,
    source: rule.evidence.source,
    traceabilityRequired: rule.evidence.traceabilityRequired,
    requiredFacts: [...rule.evidence.requiredFacts],
    matchedFacts,
    missingFacts,
  }
}

function toScoreOrNull(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return null
  }

  if (score < 0 || score > 100) {
    return null
  }

  return score
}

function resolveConfidence(
  knowledgeCollection: KnowledgeCollection,
  rule: InsightRuleDescriptor,
  matchedFacts: readonly KnowledgeFact[],
  dependencies: InsightBuilderDependencies,
):
  | { readonly confidence: InsightConfidence }
  | { readonly error: InsightRuleSkipReasonCode } {
  const policy: InsightRuleConfidencePolicy = rule.output.confidencePolicy

  if (policy.mode === 'fixed-score') {
    const score = toScoreOrNull(policy.score)
    if (score === null) {
      return { error: 'invalid-confidence-policy' }
    }

    return {
      confidence: {
        mode: policy.mode,
        scoreUnit: policy.scoreUnit,
        score,
      },
    }
  }

  if (policy.mode === 'bounded-score') {
    const minimumScore = toScoreOrNull(policy.minimumScore)
    const maximumScore = toScoreOrNull(policy.maximumScore)

    if (
      minimumScore === null ||
      maximumScore === null ||
      minimumScore > maximumScore
    ) {
      return { error: 'invalid-confidence-policy' }
    }

    return {
      confidence: {
        mode: policy.mode,
        scoreUnit: policy.scoreUnit,
        score: (minimumScore + maximumScore) / 2,
      },
    }
  }

  const resolver = dependencies.confidencePolicyResolver
  if (resolver === undefined) {
    return { error: 'confidence-not-resolved' }
  }

  const score = resolver.evaluateEvidenceDerivedConfidence(policy.policyCode, {
    knowledgeCollection,
    rule,
    matchedFacts,
  })

  const normalizedScore = toScoreOrNull(score)
  if (normalizedScore === null) {
    return { error: 'confidence-not-resolved' }
  }

  return {
    confidence: {
      mode: policy.mode,
      scoreUnit: policy.scoreUnit,
      score: normalizedScore,
    },
  }
}

function buildInsightId(
  knowledgeCollection: KnowledgeCollection,
  rule: InsightRuleDescriptor,
): InsightId {
  return (
    `insight:${rule.reference.ruleId}:${rule.reference.ruleVersion}:${knowledgeCollection.identity.knowledgeCollectionId}`
  ) as InsightId
}

function buildInsight(
  knowledgeCollection: KnowledgeCollection,
  rule: InsightRuleDescriptor,
  evidence: InsightEvidence,
  confidence: InsightConfidence,
): Insight {
  const insightId = buildInsightId(knowledgeCollection, rule)
  const traceFactIds = evidence.matchedFacts.map((item) => item.factId)

  return {
    insightId,
    rule: rule.reference,
    outputKind: rule.output.outputKind,
    category: rule.output.category,
    severity: rule.output.severity,
    titleCode: rule.output.titleCode,
    messageCode: rule.output.messageCode,
    confidence,
    evidence,
    traceability: {
      knowledgeCollectionId: knowledgeCollection.identity.knowledgeCollectionId,
      sourceSnapshotId: knowledgeCollection.identity.sourceSnapshotId,
      sourceSnapshotKey: knowledgeCollection.identity.sourceSnapshotKey,
      sourceSnapshotRevision: knowledgeCollection.identity.sourceSnapshotRevision,
      rule: rule.reference,
      factIds: traceFactIds,
    },
  }
}

function ruleIsEnabled(
  rule: InsightRuleDescriptor,
  dependencies: InsightBuilderDependencies,
): boolean {
  if (rule.lifecycle.status !== 'active') {
    return false
  }

  const resolver = dependencies.ruleEnablement
  if (resolver === undefined) {
    return true
  }

  try {
    return resolver.isRuleEnabled(rule)
  } catch {
    return false
  }
}

export function buildInsightCollection(
  input: BuildInsightCollectionInput,
  dependencies: InsightBuilderDependencies = {},
): InsightBuildResult {
  const { knowledgeCollection } = input
  const ruleCatalog = stableSortRules(input.rules)
  const collection = buildEmptyInsightCollection(knowledgeCollection)

  const collectionValidationError = validateKnowledgeCollection(knowledgeCollection)
  if (collectionValidationError !== null) {
    const failure: InsightBuilderFailure = {
      code: 'INVALID_KNOWLEDGE_COLLECTION',
      message: collectionValidationError,
    }

    return {
      collection,
      assessment: {
        status: 'blocked',
        failures: [failure],
        generatedInsights: 0,
        skippedRules: ruleCatalog.length,
      },
    }
  }

  const factMap = buildFactMap(knowledgeCollection.facts)
  const insights: Insight[] = []
  const executions = [] as InsightCollection['executions'][number][]
  const failures: InsightBuilderFailure[] = []

  for (const rule of ruleCatalog) {
    const enabled = ruleIsEnabled(rule, dependencies)

    if (!enabled) {
      executions.push({
        rule: rule.reference,
        enabled,
        status: 'skipped',
        compatibilityChecks: [],
        skipReason: 'rule-disabled',
      })
      continue
    }

    const compatibilityChecks = buildCompatibilityChecks(
      knowledgeCollection,
      rule,
      factMap,
    )

    if (compatibilityChecks.some((check) => !check.passed)) {
      executions.push({
        rule: rule.reference,
        enabled,
        status: 'skipped',
        compatibilityChecks,
        skipReason: 'incompatible-input',
      })
      continue
    }

    const evidence = buildEvidence(rule, factMap)
    const matchedFacts = evidence.matchedFacts
      .map((item) => factMap.get(String(item.factId)))
      .filter((fact): fact is KnowledgeFact => fact !== undefined)
    const confidenceResult = resolveConfidence(
      knowledgeCollection,
      rule,
      matchedFacts,
      dependencies,
    )

    if ('error' in confidenceResult) {
      failures.push({
        code: 'RULE_EXECUTION_BLOCKED',
        rule: rule.reference,
        message: confidenceResult.error,
      })
      executions.push({
        rule: rule.reference,
        enabled,
        status: 'skipped',
        compatibilityChecks,
        skipReason: confidenceResult.error,
      })
      continue
    }

    const insight = buildInsight(
      knowledgeCollection,
      rule,
      evidence,
      confidenceResult.confidence,
    )

    insights.push(insight)
    executions.push({
      rule: rule.reference,
      enabled,
      status: 'generated',
      compatibilityChecks,
      generatedInsightId: insight.insightId,
    })
  }

  const resultCollection: InsightCollection = {
    ...collection,
    insights,
    executions,
  }

  return {
    collection: resultCollection,
    assessment: {
      status: failures.length === 0 ? 'ok' : 'blocked',
      failures,
      generatedInsights: insights.length,
      skippedRules: executions.filter((execution) => execution.status === 'skipped').length,
    },
  }
}

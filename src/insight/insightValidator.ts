import {
  INSIGHT_RULE_CATEGORIES,
  INSIGHT_RULE_EVIDENCE_TYPES,
  INSIGHT_RULE_PROTOCOL_VERSION,
  INSIGHT_RULE_SEVERITIES,
  INSIGHT_RULE_STATUSES,
  type InsightRuleDescriptor,
} from '../types/insightRule'
import type { InsightCollection } from './types'
import {
  createValidationReport,
  type ValidationReport,
} from './validationReport'
import type {
  ValidationIssue,
  ValidationIssueCode,
} from './validationIssue'

const EXECUTION_STATUSES = ['generated', 'skipped'] as const
const EXECUTION_SKIP_REASONS = [
  'rule-disabled',
  'incompatible-input',
  'invalid-confidence-policy',
  'confidence-not-resolved',
] as const
const CONFIDENCE_MODES = [
  'fixed-score',
  'bounded-score',
  'evidence-derived',
] as const

const ALLOWED_CATEGORIES = new Set<string>(INSIGHT_RULE_CATEGORIES)
const ALLOWED_EVIDENCE_TYPES = new Set<string>(INSIGHT_RULE_EVIDENCE_TYPES)
const ALLOWED_SEVERITIES = new Set<string>(INSIGHT_RULE_SEVERITIES)
const ALLOWED_RULE_STATUSES = new Set<string>(INSIGHT_RULE_STATUSES)
const ALLOWED_EXECUTION_STATUSES = new Set<string>(EXECUTION_STATUSES)
const ALLOWED_EXECUTION_SKIP_REASONS = new Set<string>(EXECUTION_SKIP_REASONS)
const ALLOWED_CONFIDENCE_MODES = new Set<string>(CONFIDENCE_MODES)

interface RuleReferenceValue {
  readonly ruleId: string
  readonly ruleVersion: string
  readonly protocolVersion: number
}

interface RuleMeta {
  readonly descriptor: InsightRuleDescriptor
  readonly lifecycleStatus: string | null
  readonly minimumProtocol: number | null
  readonly maximumProtocol: number | null
}

export interface ValidateInsightCollectionInput {
  readonly collection: InsightCollection
  readonly rules: readonly InsightRuleDescriptor[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
}

function isScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

function isSorted(values: readonly string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (compareStrings(values[index - 1], values[index]) > 0) {
      return false
    }
  }
  return true
}

function sameStringArray(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }

  return true
}

function duplicateValue(values: readonly string[]): string | null {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      return value
    }
    seen.add(value)
  }
  return null
}

function addIssue(
  issues: ValidationIssue[],
  issueKeys: Set<string>,
  code: ValidationIssueCode,
  path: string,
  message: string,
): void {
  const issueKey = `${code}|${path}|${message}`
  if (issueKeys.has(issueKey)) {
    return
  }

  issueKeys.add(issueKey)
  issues.push({ code, path, message })
}

function toRuleKey(reference: RuleReferenceValue): string {
  return `${reference.ruleId}::${reference.ruleVersion}::${reference.protocolVersion}`
}

function parseRuleReference(value: unknown): RuleReferenceValue | null {
  if (!isRecord(value)) {
    return null
  }

  const ruleId = value.ruleId
  const ruleVersion = value.ruleVersion
  const protocolVersion = value.protocolVersion

  if (
    !isNonEmptyString(ruleId) ||
    !isNonEmptyString(ruleVersion) ||
    !isSafeNonNegativeInteger(protocolVersion)
  ) {
    return null
  }

  return {
    ruleId,
    ruleVersion,
    protocolVersion,
  }
}

function readRequiredString(
  value: unknown,
  path: string,
  code: ValidationIssueCode,
  issues: ValidationIssue[],
  issueKeys: Set<string>,
): string | null {
  if (!isNonEmptyString(value)) {
    addIssue(issues, issueKeys, code, path, 'value must be a non-empty string')
    return null
  }

  return value
}

function readRequiredNonNegativeInteger(
  value: unknown,
  path: string,
  code: ValidationIssueCode,
  issues: ValidationIssue[],
  issueKeys: Set<string>,
): number | null {
  if (!isSafeNonNegativeInteger(value)) {
    addIssue(
      issues,
      issueKeys,
      code,
      path,
      'value must be a non-negative safe integer',
    )
    return null
  }

  return value
}

function readStringArray(
  value: unknown,
  path: string,
  code: ValidationIssueCode,
  issues: ValidationIssue[],
  issueKeys: Set<string>,
): string[] {
  if (!Array.isArray(value)) {
    addIssue(issues, issueKeys, code, path, 'value must be an array')
    return []
  }

  const result: string[] = []
  for (const [index, item] of value.entries()) {
    if (!isNonEmptyString(item)) {
      addIssue(
        issues,
        issueKeys,
        code,
        `${path}[${index}]`,
        'array entries must be non-empty strings',
      )
      continue
    }
    result.push(item)
  }

  return result
}

function validateRuleCatalog(
  rules: readonly unknown[],
  issues: ValidationIssue[],
  issueKeys: Set<string>,
): ReadonlyMap<string, RuleMeta> {
  const ruleMetaByKey = new Map<string, RuleMeta>()

  for (const [index, ruleCandidate] of rules.entries()) {
    const rulePath = `rules[${index}]`
    if (!isRecord(ruleCandidate)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        rulePath,
        'rule descriptor must be an object',
      )
      continue
    }

    const reference = parseRuleReference(ruleCandidate.reference)
    if (reference === null) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        `${rulePath}.reference`,
        'rule reference is invalid',
      )
      continue
    }

    const ruleKey = toRuleKey(reference)
    if (ruleMetaByKey.has(ruleKey)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_DUPLICATE_REFERENCE',
        `${rulePath}.reference`,
        `duplicate rule reference: ${ruleKey}`,
      )
    }

    let lifecycleStatus: string | null = null
    if (!isRecord(ruleCandidate.lifecycle)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STATUS',
        `${rulePath}.lifecycle`,
        'lifecycle metadata is required',
      )
    } else {
      lifecycleStatus = readRequiredString(
        ruleCandidate.lifecycle.status,
        `${rulePath}.lifecycle.status`,
        'INSIGHT_VALIDATION_INVALID_STATUS',
        issues,
        issueKeys,
      )

      if (
        lifecycleStatus !== null &&
        !ALLOWED_RULE_STATUSES.has(lifecycleStatus)
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_STATUS',
          `${rulePath}.lifecycle.status`,
          `unsupported rule lifecycle status: ${lifecycleStatus}`,
        )
      }
    }

    let minimumProtocol: number | null = null
    let maximumProtocol: number | null = null
    if (!isRecord(ruleCandidate.compatibility)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
        `${rulePath}.compatibility`,
        'compatibility metadata is required',
      )
    } else {
      minimumProtocol = readRequiredNonNegativeInteger(
        ruleCandidate.compatibility.minimumProtocol,
        `${rulePath}.compatibility.minimumProtocol`,
        'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
        issues,
        issueKeys,
      )
      maximumProtocol = readRequiredNonNegativeInteger(
        ruleCandidate.compatibility.maximumProtocol,
        `${rulePath}.compatibility.maximumProtocol`,
        'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
        issues,
        issueKeys,
      )

      if (
        minimumProtocol !== null &&
        maximumProtocol !== null &&
        minimumProtocol > maximumProtocol
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
          `${rulePath}.compatibility`,
          'minimumProtocol must be less than or equal to maximumProtocol',
        )
      }
    }

    if (!ruleMetaByKey.has(ruleKey)) {
      ruleMetaByKey.set(ruleKey, {
        descriptor: ruleCandidate as unknown as InsightRuleDescriptor,
        lifecycleStatus,
        minimumProtocol,
        maximumProtocol,
      })
    }
  }

  return ruleMetaByKey
}

function validateCollectionHeader(
  collection: Record<string, unknown>,
  issues: ValidationIssue[],
  issueKeys: Set<string>,
): {
  readonly protocolVersion: number | null
  readonly sourceKnowledgeCollectionId: string | null
  readonly sourceSnapshotId: string | null
  readonly sourceSnapshotKey: string | null
  readonly sourceSnapshotRevision: number | null
} {
  const protocolVersion = readRequiredNonNegativeInteger(
    collection.protocolVersion,
    'collection.protocolVersion',
    'INSIGHT_VALIDATION_INVALID_STRUCTURE',
    issues,
    issueKeys,
  )

  if (
    protocolVersion !== null &&
    protocolVersion !== INSIGHT_RULE_PROTOCOL_VERSION
  ) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
      'collection.protocolVersion',
      `unsupported protocol version: ${protocolVersion}`,
    )
  }

  if (collection.deterministicOutput !== true) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
      'collection.deterministicOutput',
      'deterministicOutput must be true',
    )
  }

  if (collection.failClosed !== true) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
      'collection.failClosed',
      'failClosed must be true',
    )
  }

  const sourceKnowledgeCollectionId = readRequiredString(
    collection.sourceKnowledgeCollectionId,
    'collection.sourceKnowledgeCollectionId',
    'INSIGHT_VALIDATION_INVALID_STRUCTURE',
    issues,
    issueKeys,
  )
  const sourceSnapshotId = readRequiredString(
    collection.sourceSnapshotId,
    'collection.sourceSnapshotId',
    'INSIGHT_VALIDATION_INVALID_STRUCTURE',
    issues,
    issueKeys,
  )
  const sourceSnapshotKey = readRequiredString(
    collection.sourceSnapshotKey,
    'collection.sourceSnapshotKey',
    'INSIGHT_VALIDATION_INVALID_STRUCTURE',
    issues,
    issueKeys,
  )
  const sourceSnapshotRevision = readRequiredNonNegativeInteger(
    collection.sourceSnapshotRevision,
    'collection.sourceSnapshotRevision',
    'INSIGHT_VALIDATION_INVALID_STRUCTURE',
    issues,
    issueKeys,
  )

  return {
    protocolVersion,
    sourceKnowledgeCollectionId,
    sourceSnapshotId,
    sourceSnapshotKey,
    sourceSnapshotRevision,
  }
}

export function validateInsightCollection(
  input: ValidateInsightCollectionInput,
): ValidationReport {
  const issues: ValidationIssue[] = []
  const issueKeys = new Set<string>()

  if (!isRecord(input)) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      'input',
      'validator input must be an object',
    )
    return createValidationReport(issues)
  }

  if (!isRecord(input.collection)) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      'collection',
      'collection must be an object',
    )
    return createValidationReport(issues)
  }

  if (!Array.isArray(input.rules)) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      'rules',
      'rules must be an array',
    )
  }

  const rules = Array.isArray(input.rules) ? input.rules : []
  const ruleMetaByKey = validateRuleCatalog(rules, issues, issueKeys)

  const collection = input.collection
  const {
    protocolVersion,
    sourceKnowledgeCollectionId,
    sourceSnapshotId,
    sourceSnapshotKey,
    sourceSnapshotRevision,
  } = validateCollectionHeader(collection, issues, issueKeys)

  const insights = Array.isArray(collection.insights) ? collection.insights : []
  if (!Array.isArray(collection.insights)) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      'collection.insights',
      'insights must be an array',
    )
  }

  const executions = Array.isArray(collection.executions)
    ? collection.executions
    : []
  if (!Array.isArray(collection.executions)) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      'collection.executions',
      'executions must be an array',
    )
  }

  const insightIds = new Set<string>()
  const insightRuleKeysByInsightId = new Map<string, string>()
  const matchedFactIdsByInsightId = new Map<string, readonly string[]>()
  const insightOrderKeys: string[] = []

  for (const [index, insightCandidate] of insights.entries()) {
    const insightPath = `collection.insights[${index}]`
    if (!isRecord(insightCandidate)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        insightPath,
        'insight must be an object',
      )
      continue
    }

    const insightId = readRequiredString(
      insightCandidate.insightId,
      `${insightPath}.insightId`,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      issues,
      issueKeys,
    )
    if (insightId !== null) {
      if (insightIds.has(insightId)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_DUPLICATE_ID',
          `${insightPath}.insightId`,
          `duplicate insight id: ${insightId}`,
        )
      }
      insightIds.add(insightId)
    }

    const outputKind = readRequiredString(
      insightCandidate.outputKind,
      `${insightPath}.outputKind`,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      issues,
      issueKeys,
    )
    const titleCode = readRequiredString(
      insightCandidate.titleCode,
      `${insightPath}.titleCode`,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      issues,
      issueKeys,
    )
    const messageCode = readRequiredString(
      insightCandidate.messageCode,
      `${insightPath}.messageCode`,
      'INSIGHT_VALIDATION_INVALID_STRUCTURE',
      issues,
      issueKeys,
    )

    const insightRuleReference = parseRuleReference(insightCandidate.rule)
    let insightRuleKey: string | null = null
    if (insightRuleReference === null) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        `${insightPath}.rule`,
        'rule reference is invalid',
      )
    } else {
      insightRuleKey = toRuleKey(insightRuleReference)
      if (insightId !== null) {
        insightRuleKeysByInsightId.set(insightId, insightRuleKey)
        insightOrderKeys.push(`${insightRuleKey}::${insightId}`)
      }

      if (
        protocolVersion !== null &&
        insightRuleReference.protocolVersion !== protocolVersion
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
          `${insightPath}.rule.protocolVersion`,
          'rule protocol version must match collection protocol version',
        )
      }

      if (!ruleMetaByKey.has(insightRuleKey)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_RULE_REFERENCE_NOT_FOUND',
          `${insightPath}.rule`,
          `rule reference is not present in catalog: ${insightRuleKey}`,
        )
      }
    }

    const category = readRequiredString(
      insightCandidate.category,
      `${insightPath}.category`,
      'INSIGHT_VALIDATION_INVALID_CATEGORY',
      issues,
      issueKeys,
    )
    if (category !== null && !ALLOWED_CATEGORIES.has(category)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_CATEGORY',
        `${insightPath}.category`,
        `unsupported insight category: ${category}`,
      )
    }

    const severity = readRequiredString(
      insightCandidate.severity,
      `${insightPath}.severity`,
      'INSIGHT_VALIDATION_INVALID_SEVERITY',
      issues,
      issueKeys,
    )
    if (severity !== null && !ALLOWED_SEVERITIES.has(severity)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_SEVERITY',
        `${insightPath}.severity`,
        `unsupported insight severity: ${severity}`,
      )
    }

    let confidenceMode: string | null = null
    if (!isRecord(insightCandidate.confidence)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_CONFIDENCE',
        `${insightPath}.confidence`,
        'confidence payload is required',
      )
    } else {
      confidenceMode = readRequiredString(
        insightCandidate.confidence.mode,
        `${insightPath}.confidence.mode`,
        'INSIGHT_VALIDATION_INVALID_CONFIDENCE',
        issues,
        issueKeys,
      )
      if (
        confidenceMode !== null &&
        !ALLOWED_CONFIDENCE_MODES.has(confidenceMode)
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_CONFIDENCE',
          `${insightPath}.confidence.mode`,
          `unsupported confidence mode: ${confidenceMode}`,
        )
      }

      const scoreUnit = readRequiredString(
        insightCandidate.confidence.scoreUnit,
        `${insightPath}.confidence.scoreUnit`,
        'INSIGHT_VALIDATION_INVALID_CONFIDENCE',
        issues,
        issueKeys,
      )
      if (scoreUnit !== null && scoreUnit !== 'percent-0-100') {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_CONFIDENCE',
          `${insightPath}.confidence.scoreUnit`,
          'confidence scoreUnit must be percent-0-100',
        )
      }

      if (!isScore(insightCandidate.confidence.score)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_CONFIDENCE',
          `${insightPath}.confidence.score`,
          'confidence score must be a finite number between 0 and 100',
        )
      }
    }

    let evidenceType: string | null = null
    let requiredFacts: string[] = []
    const matchedFactIds: string[] = []

    if (!isRecord(insightCandidate.evidence)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_EVIDENCE',
        `${insightPath}.evidence`,
        'evidence payload is required',
      )
    } else {
      evidenceType = readRequiredString(
        insightCandidate.evidence.evidenceType,
        `${insightPath}.evidence.evidenceType`,
        'INSIGHT_VALIDATION_INVALID_EVIDENCE',
        issues,
        issueKeys,
      )
      if (evidenceType !== null && !ALLOWED_EVIDENCE_TYPES.has(evidenceType)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_EVIDENCE',
          `${insightPath}.evidence.evidenceType`,
          `unsupported evidence type: ${evidenceType}`,
        )
      }

      void readRequiredString(
        insightCandidate.evidence.summaryCode,
        `${insightPath}.evidence.summaryCode`,
        'INSIGHT_VALIDATION_INVALID_EVIDENCE',
        issues,
        issueKeys,
      )

      if (insightCandidate.evidence.source !== 'knowledge') {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_EVIDENCE',
          `${insightPath}.evidence.source`,
          'evidence source must be knowledge',
        )
      }
      if (insightCandidate.evidence.traceabilityRequired !== true) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_EVIDENCE',
          `${insightPath}.evidence.traceabilityRequired`,
          'traceabilityRequired must be true',
        )
      }

      requiredFacts = readStringArray(
        insightCandidate.evidence.requiredFacts,
        `${insightPath}.evidence.requiredFacts`,
        'INSIGHT_VALIDATION_INVALID_EVIDENCE',
        issues,
        issueKeys,
      )
      if (requiredFacts.length === 0) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_EVIDENCE',
          `${insightPath}.evidence.requiredFacts`,
          'requiredFacts must contain at least one entry',
        )
      }

      const duplicateRequiredFact = duplicateValue(requiredFacts)
      if (duplicateRequiredFact !== null) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_DUPLICATE_ID',
          `${insightPath}.evidence.requiredFacts`,
          `duplicate required fact id: ${duplicateRequiredFact}`,
        )
      }

      const missingFacts = readStringArray(
        insightCandidate.evidence.missingFacts,
        `${insightPath}.evidence.missingFacts`,
        'INSIGHT_VALIDATION_INVALID_EVIDENCE',
        issues,
        issueKeys,
      )
      const duplicateMissingFact = duplicateValue(missingFacts)
      if (duplicateMissingFact !== null) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_DUPLICATE_ID',
          `${insightPath}.evidence.missingFacts`,
          `duplicate missing fact id: ${duplicateMissingFact}`,
        )
      }
      if (missingFacts.length > 0) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_EVIDENCE',
          `${insightPath}.evidence.missingFacts`,
          'missingFacts must be empty for certified insights',
        )
      }

      const requiredFactSet = new Set(requiredFacts)
      const missingFactSet = new Set(missingFacts)

      const matchedFactsCandidate = insightCandidate.evidence.matchedFacts
      if (!Array.isArray(matchedFactsCandidate)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_EVIDENCE',
          `${insightPath}.evidence.matchedFacts`,
          'matchedFacts must be an array',
        )
      } else {
        const seenMatchedFactIds = new Set<string>()

        for (const [matchedIndex, matchedFactCandidate] of matchedFactsCandidate.entries()) {
          const matchedPath = `${insightPath}.evidence.matchedFacts[${matchedIndex}]`
          if (!isRecord(matchedFactCandidate)) {
            addIssue(
              issues,
              issueKeys,
              'INSIGHT_VALIDATION_INVALID_EVIDENCE',
              matchedPath,
              'matched fact must be an object',
            )
            continue
          }

          const factId = readRequiredString(
            matchedFactCandidate.factId,
            `${matchedPath}.factId`,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            issues,
            issueKeys,
          )
          if (factId !== null) {
            if (seenMatchedFactIds.has(factId)) {
              addIssue(
                issues,
                issueKeys,
                'INSIGHT_VALIDATION_DUPLICATE_ID',
                `${matchedPath}.factId`,
                `duplicate matched fact id: ${factId}`,
              )
            }

            seenMatchedFactIds.add(factId)
            matchedFactIds.push(factId)

            if (!requiredFactSet.has(factId)) {
              addIssue(
                issues,
                issueKeys,
                'INSIGHT_VALIDATION_INVALID_EVIDENCE',
                `${matchedPath}.factId`,
                'matched fact id must be included in requiredFacts',
              )
            }
          }

          void readRequiredString(
            matchedFactCandidate.factType,
            `${matchedPath}.factType`,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            issues,
            issueKeys,
          )
          void readRequiredString(
            matchedFactCandidate.category,
            `${matchedPath}.category`,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            issues,
            issueKeys,
          )
          void readRequiredString(
            matchedFactCandidate.severity,
            `${matchedPath}.severity`,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            issues,
            issueKeys,
          )

          const matchedSourceSnapshotId = readRequiredString(
            matchedFactCandidate.sourceSnapshotId,
            `${matchedPath}.sourceSnapshotId`,
            'INSIGHT_VALIDATION_INVALID_SCOPE',
            issues,
            issueKeys,
          )
          if (
            sourceSnapshotId !== null &&
            matchedSourceSnapshotId !== null &&
            matchedSourceSnapshotId !== sourceSnapshotId
          ) {
            addIssue(
              issues,
              issueKeys,
              'INSIGHT_VALIDATION_INVALID_SCOPE',
              `${matchedPath}.sourceSnapshotId`,
              'matched fact snapshot id must match collection snapshot id',
            )
          }

          const matchedSourceSnapshotKey = readRequiredString(
            matchedFactCandidate.sourceSnapshotKey,
            `${matchedPath}.sourceSnapshotKey`,
            'INSIGHT_VALIDATION_INVALID_SCOPE',
            issues,
            issueKeys,
          )
          if (
            sourceSnapshotKey !== null &&
            matchedSourceSnapshotKey !== null &&
            matchedSourceSnapshotKey !== sourceSnapshotKey
          ) {
            addIssue(
              issues,
              issueKeys,
              'INSIGHT_VALIDATION_INVALID_SCOPE',
              `${matchedPath}.sourceSnapshotKey`,
              'matched fact snapshot key must match collection snapshot key',
            )
          }

          const matchedSourceSnapshotRevision = readRequiredNonNegativeInteger(
            matchedFactCandidate.sourceSnapshotRevision,
            `${matchedPath}.sourceSnapshotRevision`,
            'INSIGHT_VALIDATION_INVALID_SCOPE',
            issues,
            issueKeys,
          )
          if (
            sourceSnapshotRevision !== null &&
            matchedSourceSnapshotRevision !== null &&
            matchedSourceSnapshotRevision !== sourceSnapshotRevision
          ) {
            addIssue(
              issues,
              issueKeys,
              'INSIGHT_VALIDATION_INVALID_SCOPE',
              `${matchedPath}.sourceSnapshotRevision`,
              'matched fact snapshot revision must match collection snapshot revision',
            )
          }

          void readRequiredString(
            matchedFactCandidate.sourceFingerprintValue,
            `${matchedPath}.sourceFingerprintValue`,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            issues,
            issueKeys,
          )
        }
      }

      for (const missingFact of missingFacts) {
        if (!requiredFactSet.has(missingFact)) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            `${insightPath}.evidence.missingFacts`,
            'missing facts must be a subset of requiredFacts',
          )
        }
      }

      const matchedFactSet = new Set(matchedFactIds)
      for (const matchedFactId of matchedFactIds) {
        if (missingFactSet.has(matchedFactId)) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            `${insightPath}.evidence`,
            'a fact cannot be both matched and missing',
          )
          break
        }
      }

      for (const requiredFactId of requiredFacts) {
        if (
          !matchedFactSet.has(requiredFactId) &&
          !missingFactSet.has(requiredFactId)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            `${insightPath}.evidence`,
            'every required fact must be represented as matched or missing',
          )
          break
        }
      }
    }

    if (insightId !== null) {
      matchedFactIdsByInsightId.set(insightId, matchedFactIds)
    }

    if (!isRecord(insightCandidate.traceability)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_SCOPE',
        `${insightPath}.traceability`,
        'traceability payload is required',
      )
    } else {
      const traceabilityKnowledgeCollectionId = readRequiredString(
        insightCandidate.traceability.knowledgeCollectionId,
        `${insightPath}.traceability.knowledgeCollectionId`,
        'INSIGHT_VALIDATION_INVALID_SCOPE',
        issues,
        issueKeys,
      )
      if (
        sourceKnowledgeCollectionId !== null &&
        traceabilityKnowledgeCollectionId !== null &&
        traceabilityKnowledgeCollectionId !== sourceKnowledgeCollectionId
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_SCOPE',
          `${insightPath}.traceability.knowledgeCollectionId`,
          'traceability knowledgeCollectionId must match collection source',
        )
      }

      const traceabilitySnapshotId = readRequiredString(
        insightCandidate.traceability.sourceSnapshotId,
        `${insightPath}.traceability.sourceSnapshotId`,
        'INSIGHT_VALIDATION_INVALID_SCOPE',
        issues,
        issueKeys,
      )
      if (
        sourceSnapshotId !== null &&
        traceabilitySnapshotId !== null &&
        traceabilitySnapshotId !== sourceSnapshotId
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_SCOPE',
          `${insightPath}.traceability.sourceSnapshotId`,
          'traceability snapshot id must match collection source',
        )
      }

      const traceabilitySnapshotKey = readRequiredString(
        insightCandidate.traceability.sourceSnapshotKey,
        `${insightPath}.traceability.sourceSnapshotKey`,
        'INSIGHT_VALIDATION_INVALID_SCOPE',
        issues,
        issueKeys,
      )
      if (
        sourceSnapshotKey !== null &&
        traceabilitySnapshotKey !== null &&
        traceabilitySnapshotKey !== sourceSnapshotKey
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_SCOPE',
          `${insightPath}.traceability.sourceSnapshotKey`,
          'traceability snapshot key must match collection source',
        )
      }

      const traceabilitySnapshotRevision = readRequiredNonNegativeInteger(
        insightCandidate.traceability.sourceSnapshotRevision,
        `${insightPath}.traceability.sourceSnapshotRevision`,
        'INSIGHT_VALIDATION_INVALID_SCOPE',
        issues,
        issueKeys,
      )
      if (
        sourceSnapshotRevision !== null &&
        traceabilitySnapshotRevision !== null &&
        traceabilitySnapshotRevision !== sourceSnapshotRevision
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_SCOPE',
          `${insightPath}.traceability.sourceSnapshotRevision`,
          'traceability snapshot revision must match collection source',
        )
      }

      const traceabilityRuleReference = parseRuleReference(
        insightCandidate.traceability.rule,
      )
      if (traceabilityRuleReference === null) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_SCOPE',
          `${insightPath}.traceability.rule`,
          'traceability rule reference is invalid',
        )
      } else if (
        insightRuleKey !== null &&
        toRuleKey(traceabilityRuleReference) !== insightRuleKey
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
          `${insightPath}.traceability.rule`,
          'traceability rule reference must match insight rule reference',
        )
      }

      const traceabilityFactIds = readStringArray(
        insightCandidate.traceability.factIds,
        `${insightPath}.traceability.factIds`,
        'INSIGHT_VALIDATION_INVALID_SCOPE',
        issues,
        issueKeys,
      )
      const duplicateTraceabilityFactId = duplicateValue(traceabilityFactIds)
      if (duplicateTraceabilityFactId !== null) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_DUPLICATE_ID',
          `${insightPath}.traceability.factIds`,
          `duplicate traceability fact id: ${duplicateTraceabilityFactId}`,
        )
      }

      if (!sameStringArray(traceabilityFactIds, matchedFactIds)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
          `${insightPath}.traceability.factIds`,
          'traceability factIds must match evidence matched fact ids',
        )
      }
    }

    if (insightRuleKey !== null) {
      const ruleMeta = ruleMetaByKey.get(insightRuleKey)
      if (ruleMeta !== undefined) {
        const descriptor = ruleMeta.descriptor

        if (
          ruleMeta.minimumProtocol !== null &&
          ruleMeta.maximumProtocol !== null &&
          protocolVersion !== null &&
          (protocolVersion < ruleMeta.minimumProtocol ||
            protocolVersion > ruleMeta.maximumProtocol)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
            `${insightPath}.rule.protocolVersion`,
            'collection protocol is outside rule compatibility bounds',
          )
        }

        if (ruleMeta.lifecycleStatus !== null && ruleMeta.lifecycleStatus !== 'active') {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_STATUS',
            `${insightPath}.rule`,
            'insights can only reference rules with active lifecycle status',
          )
        }

        if (
          outputKind !== null &&
          outputKind !== String(descriptor.output.outputKind)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
            `${insightPath}.outputKind`,
            'outputKind must match rule output contract',
          )
        }

        if (category !== null && category !== String(descriptor.output.category)) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
            `${insightPath}.category`,
            'insight category must match rule output category',
          )
        }

        if (severity !== null && severity !== String(descriptor.output.severity)) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
            `${insightPath}.severity`,
            'insight severity must match rule output severity',
          )
        }

        if (titleCode !== null && titleCode !== String(descriptor.output.titleCode)) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
            `${insightPath}.titleCode`,
            'titleCode must match rule output titleCode',
          )
        }

        if (
          messageCode !== null &&
          messageCode !== String(descriptor.output.messageCode)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
            `${insightPath}.messageCode`,
            'messageCode must match rule output messageCode',
          )
        }

        const descriptorRequiredFacts = descriptor.evidence.requiredFacts.map((factId) =>
          String(factId),
        )
        if (
          requiredFacts.length > 0 &&
          !sameStringArray(requiredFacts, descriptorRequiredFacts)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            `${insightPath}.evidence.requiredFacts`,
            'evidence required facts must match rule evidence contract',
          )
        }

        if (
          evidenceType !== null &&
          evidenceType !== String(descriptor.evidence.evidenceType)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_EVIDENCE',
            `${insightPath}.evidence.evidenceType`,
            'evidence type must match rule evidence contract',
          )
        }

        if (
          confidenceMode !== null &&
          confidenceMode !== descriptor.output.confidencePolicy.mode
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_CONFIDENCE',
            `${insightPath}.confidence.mode`,
            'confidence mode must match rule confidence policy mode',
          )
        }
      }
    }
  }

  const executionRuleKeys = new Set<string>()
  const executionOrderKeys: string[] = []
  const generatedExecutionByInsightId = new Map<string, string>()

  for (const [index, executionCandidate] of executions.entries()) {
    const executionPath = `collection.executions[${index}]`
    if (!isRecord(executionCandidate)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        executionPath,
        'execution trace must be an object',
      )
      continue
    }

    const executionRuleReference = parseRuleReference(executionCandidate.rule)
    let executionRuleKey: string | null = null
    if (executionRuleReference === null) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        `${executionPath}.rule`,
        'execution rule reference is invalid',
      )
    } else {
      executionRuleKey = toRuleKey(executionRuleReference)
      executionOrderKeys.push(executionRuleKey)

      if (executionRuleKeys.has(executionRuleKey)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_DUPLICATE_REFERENCE',
          `${executionPath}.rule`,
          `duplicate execution rule reference: ${executionRuleKey}`,
        )
      }
      executionRuleKeys.add(executionRuleKey)

      if (
        protocolVersion !== null &&
        executionRuleReference.protocolVersion !== protocolVersion
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
          `${executionPath}.rule.protocolVersion`,
          'execution rule protocol version must match collection protocol version',
        )
      }

      if (!ruleMetaByKey.has(executionRuleKey)) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_RULE_REFERENCE_NOT_FOUND',
          `${executionPath}.rule`,
          `execution rule reference is not present in catalog: ${executionRuleKey}`,
        )
      }
    }

    const enabled = executionCandidate.enabled
    if (typeof enabled !== 'boolean') {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STATUS',
        `${executionPath}.enabled`,
        'enabled flag must be boolean',
      )
    }

    const status = readRequiredString(
      executionCandidate.status,
      `${executionPath}.status`,
      'INSIGHT_VALIDATION_INVALID_STATUS',
      issues,
      issueKeys,
    )
    if (status !== null && !ALLOWED_EXECUTION_STATUSES.has(status)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STATUS',
        `${executionPath}.status`,
        `unsupported execution status: ${status}`,
      )
    }

    if (!Array.isArray(executionCandidate.compatibilityChecks)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        `${executionPath}.compatibilityChecks`,
        'compatibilityChecks must be an array',
      )
    } else {
      for (const [checkIndex, checkCandidate] of executionCandidate.compatibilityChecks.entries()) {
        const checkPath = `${executionPath}.compatibilityChecks[${checkIndex}]`
        if (!isRecord(checkCandidate)) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_STRUCTURE',
            checkPath,
            'compatibility check must be an object',
          )
          continue
        }

        void readRequiredString(
          checkCandidate.code,
          `${checkPath}.code`,
          'INSIGHT_VALIDATION_INVALID_STRUCTURE',
          issues,
          issueKeys,
        )

        if (typeof checkCandidate.passed !== 'boolean') {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_STRUCTURE',
            `${checkPath}.passed`,
            'compatibility check passed flag must be boolean',
          )
        }
      }
    }

    if (status === 'generated') {
      const generatedInsightId = readRequiredString(
        executionCandidate.generatedInsightId,
        `${executionPath}.generatedInsightId`,
        'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
        issues,
        issueKeys,
      )

      if (generatedInsightId !== null && executionRuleKey !== null) {
        if (generatedExecutionByInsightId.has(generatedInsightId)) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_DUPLICATE_ID',
            `${executionPath}.generatedInsightId`,
            `duplicate generated insight id: ${generatedInsightId}`,
          )
        }
        generatedExecutionByInsightId.set(generatedInsightId, executionRuleKey)
      }

      if (executionCandidate.skipReason !== undefined) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_STATUS',
          `${executionPath}.skipReason`,
          'skipReason must be undefined when status is generated',
        )
      }

      if (enabled === false) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_STATUS',
          `${executionPath}.enabled`,
          'enabled cannot be false when status is generated',
        )
      }
    }

    if (status === 'skipped') {
      const skipReason = readRequiredString(
        executionCandidate.skipReason,
        `${executionPath}.skipReason`,
        'INSIGHT_VALIDATION_INVALID_STATUS',
        issues,
        issueKeys,
      )

      if (
        skipReason !== null &&
        !ALLOWED_EXECUTION_SKIP_REASONS.has(skipReason)
      ) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_STATUS',
          `${executionPath}.skipReason`,
          `unsupported skipReason: ${skipReason}`,
        )
      }

      if (executionCandidate.generatedInsightId !== undefined) {
        addIssue(
          issues,
          issueKeys,
          'INSIGHT_VALIDATION_INVALID_STATUS',
          `${executionPath}.generatedInsightId`,
          'generatedInsightId must be undefined when status is skipped',
        )
      }
    }

    if (executionRuleKey !== null) {
      const ruleMeta = ruleMetaByKey.get(executionRuleKey)
      if (ruleMeta !== undefined) {
        if (
          ruleMeta.minimumProtocol !== null &&
          ruleMeta.maximumProtocol !== null &&
          protocolVersion !== null &&
          (protocolVersion < ruleMeta.minimumProtocol ||
            protocolVersion > ruleMeta.maximumProtocol)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION',
            `${executionPath}.rule.protocolVersion`,
            'collection protocol is outside execution rule compatibility bounds',
          )
        }

        if (
          ruleMeta.lifecycleStatus !== null &&
          !ALLOWED_RULE_STATUSES.has(ruleMeta.lifecycleStatus)
        ) {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_STATUS',
            `${executionPath}.rule`,
            'execution references a rule with invalid lifecycle status',
          )
        }

        if (status === 'generated' && ruleMeta.lifecycleStatus !== 'active') {
          addIssue(
            issues,
            issueKeys,
            'INSIGHT_VALIDATION_INVALID_STATUS',
            `${executionPath}.rule`,
            'generated execution must reference an active rule',
          )
        }
      }
    }
  }

  if (generatedExecutionByInsightId.size !== insightIds.size) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
      'collection',
      'generated execution count must match insight count',
    )
  }

  for (const insightId of insightIds) {
    const executionRuleKey = generatedExecutionByInsightId.get(insightId)
    if (executionRuleKey === undefined) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
        'collection.executions',
        `missing generated execution for insight id: ${insightId}`,
      )
      continue
    }

    const insightRuleKey = insightRuleKeysByInsightId.get(insightId)
    if (insightRuleKey !== undefined && executionRuleKey !== insightRuleKey) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
        'collection.executions',
        `generated execution rule mismatch for insight id: ${insightId}`,
      )
    }

    const matchedFactIds = matchedFactIdsByInsightId.get(insightId)
    if (matchedFactIds !== undefined && matchedFactIds.length === 0) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INVALID_EVIDENCE',
        'collection.insights',
        `insight must include matched evidence facts: ${insightId}`,
      )
    }
  }

  for (const generatedInsightId of generatedExecutionByInsightId.keys()) {
    if (!insightIds.has(generatedInsightId)) {
      addIssue(
        issues,
        issueKeys,
        'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
        'collection.executions',
        `generated execution references unknown insight id: ${generatedInsightId}`,
      )
    }
  }

  if (!isSorted(insightOrderKeys)) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
      'collection.insights',
      'insights must be deterministically ordered by rule reference and insight id',
    )
  }

  if (!isSorted(executionOrderKeys)) {
    addIssue(
      issues,
      issueKeys,
      'INSIGHT_VALIDATION_INTERNAL_INCONSISTENCY',
      'collection.executions',
      'executions must be deterministically ordered by rule reference',
    )
  }

  return createValidationReport(issues)
}
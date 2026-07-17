import type {
  DraftKnowledgeCollection,
  KnowledgeFactCategory,
  KnowledgeFactSeverity,
  KnowledgeFactType,
  KnowledgeRelationship,
  KnowledgeValidationAssessment,
  KnowledgeValidationCheck,
  KnowledgeValidationErrorCode,
  ValidatedKnowledgeCollection,
} from '../../types/knowledgeLayer'

const SUPPORTED_KNOWLEDGE_VERSIONS = new Set(['knowledge/1.0.0'])
const SUPPORTED_BUILDER_VERSIONS = new Set(['knowledge-builder/1.0.0'])
const SUPPORTED_RULES_VERSIONS = new Set(['knowledge-rules/1.0.0'])
const SUPPORTED_PROJECTION_VERSIONS = new Set(['knowledge-projection/1.0.0'])
const SUPPORTED_RELATIONSHIP_TYPES = new Set(['derived-from', 'supports', 'correlates-with'])

const FACT_TYPE_CATEGORY: Record<KnowledgeFactType, KnowledgeFactCategory> = {
  'income.present': 'income',
  'income.absent': 'income',
  'income.increased': 'income',
  'income.decreased': 'income',
  'expense.present': 'expense',
  'expense.absent': 'expense',
  'expense.increased': 'expense',
  'expense.decreased': 'expense',
  'adjustment.present': 'adjustment',
  'adjustment.absent': 'adjustment',
  'balance.positive': 'balance',
  'balance.negative': 'balance',
  'balance.neutral': 'balance',
  'cashflow.positive': 'cashflow',
  'cashflow.negative': 'cashflow',
  'cashflow.neutral': 'cashflow',
  'period.empty': 'period',
  'period.non_empty': 'period',
  'season.started': 'season',
  'season.completed': 'season',
  'saving.high': 'saving',
  'saving.low': 'saving',
  'recurring.expense.detected': 'recurrence',
  'income.volatile': 'volatility',
  'expense.volatile': 'volatility',
  'cashflow.stable': 'cashflow',
  'cashflow.unstable': 'cashflow',
}

const INITIAL_ALLOWED_FACT_TYPES = new Set<KnowledgeFactType>([
  'adjustment.absent',
  'adjustment.present',
  'balance.negative',
  'balance.neutral',
  'balance.positive',
  'cashflow.negative',
  'cashflow.neutral',
  'cashflow.positive',
  'expense.absent',
  'expense.present',
  'income.absent',
  'income.present',
  'period.empty',
  'period.non_empty',
])

const EXCLUSIVE_GROUPS: Readonly<Record<string, readonly KnowledgeFactType[]>> = {
  balance: ['balance.positive', 'balance.negative', 'balance.neutral'],
  income: ['income.present', 'income.absent'],
  expense: ['expense.present', 'expense.absent'],
  adjustment: ['adjustment.present', 'adjustment.absent'],
  cashflow: ['cashflow.positive', 'cashflow.negative', 'cashflow.neutral'],
  period: ['period.empty', 'period.non_empty'],
}

const FACT_ORDER: readonly KnowledgeFactType[] = [
  'adjustment.absent',
  'adjustment.present',
  'balance.negative',
  'balance.neutral',
  'balance.positive',
  'cashflow.negative',
  'cashflow.neutral',
  'cashflow.positive',
  'expense.absent',
  'expense.present',
  'income.absent',
  'income.present',
  'period.empty',
  'period.non_empty',
]

const FORBIDDEN_KEYS = new Set([
  'engineResult',
  'canonicalDocument',
  'operationalMetadata',
  'note',
  'notes',
  'freeText',
  'freeNote',
  'comment',
  'email',
  'phone',
  'whatsappNumber',
  'ownerJid',
  'pin',
  'token',
  'secret',
  'password',
])

export class KnowledgeValidationError extends Error {
  readonly code: KnowledgeValidationErrorCode
  readonly assessment: KnowledgeValidationAssessment

  constructor(code: KnowledgeValidationErrorCode, assessment: KnowledgeValidationAssessment) {
    super(code)
    this.name = 'KnowledgeValidationError'
    this.code = code
    this.assessment = assessment
  }
}

function buildAssessment(checks: readonly KnowledgeValidationCheck[]): KnowledgeValidationAssessment {
  const failedChecks = checks.filter((check) => !check.passed).length
  return {
    status: failedChecks === 0 ? 'valid' : 'invalid',
    checks,
    failedChecks,
  }
}

function fail(
  checks: readonly KnowledgeValidationCheck[],
  code: KnowledgeValidationErrorCode,
): never {
  throw new KnowledgeValidationError(code, buildAssessment(checks))
}

function runCheck(
  checks: KnowledgeValidationCheck[],
  code: string,
  errorCode: KnowledgeValidationErrorCode,
  predicate: () => boolean,
): void {
  const passed = predicate()
  checks.push({ code, passed, ...(passed ? {} : { errorCode }) })
  if (!passed) {
    fail(checks, errorCode)
  }
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T
  }
  const cloned: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    cloned[key] = deepClone(child)
  }
  return cloned as T
}

function assertSafeStructure(value: unknown): boolean {
  const activeStack = new Set<object>()
  const seen = new WeakSet<object>()

  const walk = (current: unknown): boolean => {
    if (current === null) return false
    if (current === undefined) return false

    const currentType = typeof current
    if (currentType === 'bigint' || currentType === 'function' || currentType === 'symbol') {
      return false
    }
    if (currentType === 'number' && !Number.isFinite(current)) {
      return false
    }
    if (currentType !== 'object') {
      return true
    }

    if (current instanceof Date) {
      return false
    }

    const objectCurrent = current as Record<string, unknown>
    if (activeStack.has(objectCurrent)) {
      return false
    }

    const proto = Object.getPrototypeOf(objectCurrent)
    if (!Array.isArray(objectCurrent) && proto !== Object.prototype && proto !== null) {
      return false
    }

    if (seen.has(objectCurrent)) {
      return true
    }

    seen.add(objectCurrent)
    activeStack.add(objectCurrent)

    if (Array.isArray(objectCurrent)) {
      for (const item of objectCurrent) {
        if (!walk(item)) {
          activeStack.delete(objectCurrent)
          return false
        }
      }
      activeStack.delete(objectCurrent)
      return true
    }

    for (const [key, child] of Object.entries(objectCurrent)) {
      if (FORBIDDEN_KEYS.has(key)) {
        activeStack.delete(objectCurrent)
        return false
      }
      if (!walk(child)) {
        activeStack.delete(objectCurrent)
        return false
      }
    }

    activeStack.delete(objectCurrent)
    return true
  }

  return walk(value)
}

function severityForType(factType: KnowledgeFactType): KnowledgeFactSeverity {
  if (factType === 'balance.negative' || factType === 'cashflow.negative') {
    return 'warning'
  }
  return 'info'
}

function stableSortFactTypes(factTypes: readonly KnowledgeFactType[]): readonly KnowledgeFactType[] {
  const orderByType = new Map<KnowledgeFactType, number>()
  FACT_ORDER.forEach((factType, index) => {
    orderByType.set(factType, index)
  })

  return [...factTypes].sort((a, b) => {
    const categoryDiff = FACT_TYPE_CATEGORY[a].localeCompare(FACT_TYPE_CATEGORY[b])
    if (categoryDiff !== 0) {
      return categoryDiff
    }

    const orderA = orderByType.get(a) ?? Number.MAX_SAFE_INTEGER
    const orderB = orderByType.get(b) ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) {
      return orderA - orderB
    }

    return a.localeCompare(b)
  })
}

function relationsAcyclic(relationships: readonly KnowledgeRelationship[]): boolean {
  const edges = new Map<string, string[]>()

  for (const relation of relationships) {
    const existing = edges.get(relation.fromFactId) ?? []
    existing.push(relation.toFactId)
    edges.set(relation.fromFactId, existing)
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()

  const dfs = (node: string): boolean => {
    if (visiting.has(node)) {
      return false
    }
    if (visited.has(node)) {
      return true
    }

    visiting.add(node)
    const neighbours = edges.get(node) ?? []
    for (const neighbour of neighbours) {
      if (!dfs(neighbour)) {
        return false
      }
    }
    visiting.delete(node)
    visited.add(node)
    return true
  }

  for (const node of edges.keys()) {
    if (!dfs(node)) {
      return false
    }
  }

  return true
}

function extractOrdinal(factId: string): number {
  const splitIndex = factId.lastIndexOf(':')
  if (splitIndex < 0) {
    return Number.NaN
  }
  return Number.parseInt(factId.slice(splitIndex + 1), 10)
}

function isJsonSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value)
    return true
  } catch {
    return false
  }
}

export function validateKnowledgeCollection(
  collection: DraftKnowledgeCollection,
): ValidatedKnowledgeCollection {
  const checks: KnowledgeValidationCheck[] = []

  runCheck(
    checks,
    'input.state.is_draft',
    'KNOWLEDGE_VALIDATION_INVALID_STATE',
    () => collection?.state === 'draft',
  )

  runCheck(
    checks,
    'versions.knowledge.supported',
    'KNOWLEDGE_VALIDATION_UNSUPPORTED_VERSION',
    () => SUPPORTED_KNOWLEDGE_VERSIONS.has(collection.versions.knowledgeVersion),
  )
  runCheck(
    checks,
    'versions.builder.supported',
    'KNOWLEDGE_VALIDATION_UNSUPPORTED_VERSION',
    () => SUPPORTED_BUILDER_VERSIONS.has(collection.versions.builderVersion),
  )
  runCheck(
    checks,
    'versions.rules.supported',
    'KNOWLEDGE_VALIDATION_UNSUPPORTED_VERSION',
    () => SUPPORTED_RULES_VERSIONS.has(collection.versions.rulesVersion),
  )
  runCheck(
    checks,
    'versions.projection.supported',
    'KNOWLEDGE_VALIDATION_UNSUPPORTED_VERSION',
    () => SUPPORTED_PROJECTION_VERSIONS.has(collection.versions.projectionVersion),
  )

  runCheck(
    checks,
    'identity.present',
    'KNOWLEDGE_VALIDATION_INVALID_IDENTITY',
    () => typeof collection.identity.knowledgeCollectionId === 'string' &&
      collection.identity.knowledgeCollectionId.trim().length > 0,
  )

  runCheck(
    checks,
    'identity.snapshot_id.present',
    'KNOWLEDGE_VALIDATION_INVALID_IDENTITY',
    () => typeof collection.identity.sourceSnapshotId === 'string' &&
      collection.identity.sourceSnapshotId.trim().length > 0,
  )
  runCheck(
    checks,
    'identity.snapshot_key.present',
    'KNOWLEDGE_VALIDATION_INVALID_IDENTITY',
    () => typeof collection.identity.sourceSnapshotKey === 'string' &&
      collection.identity.sourceSnapshotKey.trim().length > 0,
  )
  runCheck(
    checks,
    'identity.snapshot_revision.valid',
    'KNOWLEDGE_VALIDATION_INVALID_IDENTITY',
    () => Number.isSafeInteger(collection.identity.sourceSnapshotRevision) &&
      collection.identity.sourceSnapshotRevision >= 0,
  )
  runCheck(
    checks,
    'identity.fingerprint.present',
    'KNOWLEDGE_VALIDATION_INVALID_IDENTITY',
    () => typeof collection.identity.sourceFingerprintValue === 'string' &&
      collection.identity.sourceFingerprintValue.trim().length > 0,
  )

  runCheck(
    checks,
    'facts.array.present',
    'KNOWLEDGE_VALIDATION_INVALID_VALUE',
    () => Array.isArray(collection.facts),
  )

  runCheck(
    checks,
    'facts.array.non_empty',
    'KNOWLEDGE_VALIDATION_INVALID_VALUE',
    () => collection.facts.length > 0,
  )

  runCheck(
    checks,
    'collection.safe_values',
    'KNOWLEDGE_VALIDATION_INVALID_VALUE',
    () => assertSafeStructure(collection),
  )

  runCheck(
    checks,
    'collection.serializable',
    'KNOWLEDGE_VALIDATION_INVALID_VALUE',
    () => isJsonSerializable(collection),
  )

  const factIds = collection.facts.map((fact) => fact.factId)
  runCheck(
    checks,
    'facts.ids.unique',
    'KNOWLEDGE_VALIDATION_DUPLICATE_FACT_ID',
    () => new Set(factIds).size === factIds.length,
  )

  runCheck(
    checks,
    'fact.type.catalog.allowed',
    'KNOWLEDGE_VALIDATION_UNKNOWN_FACT_TYPE',
    () => collection.facts.every((fact) => INITIAL_ALLOWED_FACT_TYPES.has(fact.factType)),
  )

  runCheck(
    checks,
    'fact.category.compatible',
    'KNOWLEDGE_VALIDATION_INVALID_VALUE',
    () => collection.facts.every((fact) => FACT_TYPE_CATEGORY[fact.factType] === fact.category),
  )

  runCheck(
    checks,
    'fact.severity.compatible',
    'KNOWLEDGE_VALIDATION_INVALID_VALUE',
    () => collection.facts.every((fact) => severityForType(fact.factType) === fact.severity),
  )

  runCheck(
    checks,
    'fact.confidence.compatible',
    'KNOWLEDGE_VALIDATION_INVALID_VALUE',
    () => collection.facts.every((fact) => fact.confidence === 'certain'),
  )

  runCheck(
    checks,
    'fact.id.format.valid',
    'KNOWLEDGE_VALIDATION_INVALID_IDENTITY',
    () => collection.facts.every((fact) => {
      const prefix =
        `knowledge-fact:${collection.versions.knowledgeVersion}:` +
        `${collection.identity.sourceSnapshotId}:`
      if (!fact.factId.startsWith(prefix)) {
        return false
      }

      const suffix = fact.factId.slice(prefix.length)
      const delimiter = suffix.lastIndexOf(':')
      if (delimiter <= 0) {
        return false
      }
      const typeInId = suffix.slice(0, delimiter)
      const ordinalText = suffix.slice(delimiter + 1)
      if (typeInId !== fact.factType) {
        return false
      }
      return /^\d{4}$/.test(ordinalText)
    }),
  )

  const expectedOrderedFactTypes = stableSortFactTypes(
    collection.facts.map((fact) => fact.factType),
  )
  runCheck(
    checks,
    'facts.order.canonical',
    'KNOWLEDGE_VALIDATION_INVALID_ORDER',
    () => collection.facts.every((fact, index) => fact.factType === expectedOrderedFactTypes[index]),
  )

  runCheck(
    checks,
    'facts.ordinal.contiguous',
    'KNOWLEDGE_VALIDATION_INVALID_ORDER',
    () => collection.facts.every((fact, index) => extractOrdinal(fact.factId) === index),
  )

  runCheck(
    checks,
    'facts.count.matches',
    'KNOWLEDGE_VALIDATION_INVALID_ORDER',
    () => collection.factCount === collection.facts.length,
  )

  runCheck(
    checks,
    'facts.evidence.valid',
    'KNOWLEDGE_VALIDATION_INVALID_EVIDENCE',
    () => collection.facts.every((fact) =>
      fact.evidence.sourceSnapshotId === collection.identity.sourceSnapshotId &&
      fact.evidence.sourceSnapshotKey === collection.identity.sourceSnapshotKey &&
      fact.evidence.sourceSnapshotRevision === collection.identity.sourceSnapshotRevision &&
      fact.evidence.sourceFingerprintValue === collection.identity.sourceFingerprintValue,
    ),
  )

  const allRelationships = [
    ...collection.relationships,
    ...collection.facts.flatMap((fact) => fact.relationships),
  ]

  runCheck(
    checks,
    'relationships.targets.exist',
    'KNOWLEDGE_VALIDATION_INVALID_RELATIONSHIP',
    () => allRelationships.every((relation) =>
      factIds.includes(relation.fromFactId) && factIds.includes(relation.toFactId),
    ),
  )

  runCheck(
    checks,
    'relationships.type.allowed',
    'KNOWLEDGE_VALIDATION_INVALID_RELATIONSHIP',
    () => allRelationships.every((relation) => SUPPORTED_RELATIONSHIP_TYPES.has(relation.relation)),
  )

  runCheck(
    checks,
    'relationships.self_ref.prohibited',
    'KNOWLEDGE_VALIDATION_INVALID_RELATIONSHIP',
    () => allRelationships.every((relation) => relation.fromFactId !== relation.toFactId),
  )

  runCheck(
    checks,
    'relationships.cycles.prohibited',
    'KNOWLEDGE_VALIDATION_INVALID_RELATIONSHIP',
    () => relationsAcyclic(allRelationships),
  )

  const byType = new Set(collection.facts.map((fact) => fact.factType))

  for (const [groupName, groupTypes] of Object.entries(EXCLUSIVE_GROUPS)) {
    runCheck(
      checks,
      `facts.group.${groupName}.exactly_one`,
      'KNOWLEDGE_VALIDATION_CONTRADICTORY_FACTS',
      () => groupTypes.filter((type) => byType.has(type)).length === 1,
    )
  }

  runCheck(
    checks,
    'period.empty.coherent',
    'KNOWLEDGE_VALIDATION_CONTRADICTORY_FACTS',
    () => !byType.has('period.empty') || (
      byType.has('income.absent') &&
      byType.has('expense.absent') &&
      byType.has('adjustment.absent')
    ),
  )

  runCheck(
    checks,
    'period.non_empty.coherent',
    'KNOWLEDGE_VALIDATION_CONTRADICTORY_FACTS',
    () => !byType.has('period.non_empty') || (
      byType.has('income.present') ||
      byType.has('expense.present') ||
      byType.has('adjustment.present')
    ),
  )

  const output = deepClone(collection)
  const validation = buildAssessment(checks)

  return {
    ...output,
    state: 'validated',
    validation,
  }
}

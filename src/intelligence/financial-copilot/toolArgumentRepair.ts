import type { AIToolJsonValue, AIToolSchemaNode } from '../ai-tools'

export interface ToolArgumentRepairChange {
  readonly rule: string
  readonly fromPath: string
  readonly toPath?: string
}

export interface ToolArgumentRepairResult {
  readonly repaired: Readonly<Record<string, AIToolJsonValue>>
  readonly changes: readonly ToolArgumentRepairChange[]
}

type MutableRecord = Record<string, AIToolJsonValue>

function isRecord(value: unknown): value is MutableRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getByPath(source: unknown, path: string): AIToolJsonValue | undefined {
  const segments = path.split('.')
  let current: unknown = source

  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined
    }
    current = current[segment]
  }

  return current as AIToolJsonValue | undefined
}

function deleteByPath(target: MutableRecord, path: string): void {
  const segments = path.split('.')
  const lastKey = segments[segments.length - 1]
  let current: MutableRecord = target

  for (const segment of segments.slice(0, -1)) {
    const next = current[segment]
    if (!isRecord(next)) {
      return
    }
    current = next
  }

  if (lastKey !== undefined) {
    delete current[lastKey]
  }
}

function setByPath(target: MutableRecord, path: string, value: AIToolJsonValue): void {
  const segments = path.split('.')
  const lastKey = segments[segments.length - 1]
  let current: MutableRecord = target

  for (const segment of segments.slice(0, -1)) {
    const next = current[segment]
    if (!isRecord(next)) {
      current[segment] = {}
    }
    current = current[segment] as MutableRecord
  }

  if (lastKey !== undefined) {
    current[lastKey] = value
  }
}

function wrapInArrayOfStrings(value: AIToolJsonValue): AIToolJsonValue {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === 'string') {
    return [value]
  }
  return value
}

const SORT_DIRECTION_SYNONYMS: Readonly<Record<string, 'asc' | 'desc'>> = {
  oldest: 'asc',
  ascending: 'asc',
  asc: 'asc',
  first: 'asc',
  latest: 'desc',
  most_recent: 'desc',
  newest: 'desc',
  recent: 'desc',
  descending: 'desc',
  desc: 'desc',
  last: 'desc',
}

function mapSortDirectionSynonym(value: AIToolJsonValue): AIToolJsonValue {
  if (typeof value !== 'string') {
    return value
  }
  return SORT_DIRECTION_SYNONYMS[value.toLowerCase()] ?? value
}

interface FieldRemapRule {
  readonly rule: string
  readonly fromPath: string
  readonly toPath: string
  readonly transform: (value: AIToolJsonValue) => AIToolJsonValue
}

/**
 * Known field-name hallucinations OpenAI has produced in practice (verified
 * during PB-IS-015.7) for `financial_transactions`-shaped requests. Each
 * rule is a deterministic, auditable rename + value transform — never a
 * guess at financial data.
 */
const FIELD_REMAP_RULES: readonly FieldRemapRule[] = [
  {
    rule: 'transaction_type -> filters.kinds',
    fromPath: 'transaction_type',
    toPath: 'filters.kinds',
    transform: wrapInArrayOfStrings,
  },
  {
    rule: 'sort_order -> sort.direction',
    fromPath: 'sort_order',
    toPath: 'sort.direction',
    transform: mapSortDirectionSynonym,
  },
  {
    rule: 'order -> sort.direction',
    fromPath: 'order',
    toPath: 'sort.direction',
    transform: mapSortDirectionSynonym,
  },
  {
    rule: 'kind -> filters.kinds',
    fromPath: 'kind',
    toPath: 'filters.kinds',
    transform: wrapInArrayOfStrings,
  },
  {
    rule: 'currency -> filters.currencyCode',
    fromPath: 'currency',
    toPath: 'filters.currencyCode',
    transform: (value) => value,
  },
]

function pruneUnknownProperties(
  node: AIToolSchemaNode,
  value: unknown,
  path: string,
  changes: ToolArgumentRepairChange[],
): void {
  if (node.type !== 'object' || !isRecord(value)) {
    return
  }

  const properties = node.properties ?? {}

  if (node.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (properties[key] === undefined) {
        delete value[key]
        changes.push({
          rule: 'drop-unknown-property',
          fromPath: path === '' ? key : `${path}.${key}`,
        })
      }
    }
  }

  for (const [key, schema] of Object.entries(properties)) {
    if (key in value) {
      pruneUnknownProperties(schema, value[key], path === '' ? key : `${path}.${key}`, changes)
    }
  }
}

/**
 * Deterministically repairs common, previously-observed argument shape
 * mismatches between what a model invents and what a tool's real schema
 * expects. Never invents financial values — it only renames/reshapes
 * structural keys (e.g. `transaction_type` -> `filters.kinds`) and removes
 * fields the schema does not recognize.
 */
export function repairToolArguments(
  schema: AIToolSchemaNode,
  value: Readonly<Record<string, AIToolJsonValue>>,
): ToolArgumentRepairResult {
  const repaired = structuredClone(value) as MutableRecord
  const changes: ToolArgumentRepairChange[] = []

  for (const rule of FIELD_REMAP_RULES) {
    const sourceValue = getByPath(repaired, rule.fromPath)
    // `null` means the model explicitly signaled "no value" (e.g.
    // `currency: null`) rather than real data to migrate; leave it for the
    // generic unknown-property pruning below instead of mapping a null.
    if (sourceValue === undefined || sourceValue === null) {
      continue
    }

    const alreadyValid = getByPath(repaired, rule.toPath) !== undefined
    if (!alreadyValid) {
      setByPath(repaired, rule.toPath, rule.transform(sourceValue))
    }
    deleteByPath(repaired, rule.fromPath)
    changes.push({ rule: rule.rule, fromPath: rule.fromPath, toPath: rule.toPath })
  }

  pruneUnknownProperties(schema, repaired, '', changes)

  return {
    repaired,
    changes,
  }
}

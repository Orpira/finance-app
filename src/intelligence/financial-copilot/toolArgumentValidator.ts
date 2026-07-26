import {
  validateValueAgainstSchema,
  type AIToolJsonValue,
  type AIToolSchemaNode,
} from '../ai-tools'

export type ToolArgumentIssueKind =
  | 'missing_required'
  | 'wrong_type'
  | 'invalid_enum'
  | 'unknown_property'

export interface ToolArgumentIssue {
  readonly path: string
  readonly kind: ToolArgumentIssueKind
  readonly expectedType?: AIToolSchemaNode['type']
}

export interface ToolArgumentValidationResult {
  readonly valid: boolean
  readonly issues: readonly ToolArgumentIssue[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function matchesPrimitiveType(node: AIToolSchemaNode, value: unknown): boolean {
  if (node.type === 'string') return typeof value === 'string'
  if (node.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (node.type === 'boolean') return typeof value === 'boolean'
  if (node.type === 'null') return value === null
  return false
}

function collectIssues(
  node: AIToolSchemaNode,
  value: unknown,
  path: string,
  issues: ToolArgumentIssue[],
): void {
  if (node.type === 'object') {
    if (!isRecord(value)) {
      issues.push({ path, kind: 'wrong_type', expectedType: 'object' })
      return
    }

    for (const requiredKey of node.required ?? []) {
      if (!(requiredKey in value)) {
        issues.push({ path: path === '' ? requiredKey : `${path}.${requiredKey}`, kind: 'missing_required' })
      }
    }

    const properties = node.properties ?? {}
    for (const [key, propertyValue] of Object.entries(value)) {
      const schema = properties[key]
      const nextPath = path === '' ? key : `${path}.${key}`

      if (schema === undefined) {
        if (node.additionalProperties === false) {
          issues.push({ path: nextPath, kind: 'unknown_property' })
        }
        continue
      }

      collectIssues(schema, propertyValue, nextPath, issues)
    }

    return
  }

  if (node.type === 'array') {
    if (!Array.isArray(value)) {
      issues.push({ path, kind: 'wrong_type', expectedType: 'array' })
      return
    }

    if (node.items === undefined) {
      return
    }

    value.forEach((item, index) => {
      collectIssues(node.items as AIToolSchemaNode, item, `${path}[${index}]`, issues)
    })

    return
  }

  if (!matchesPrimitiveType(node, value)) {
    issues.push({ path, kind: 'wrong_type', expectedType: node.type })
    return
  }

  if (node.enum !== undefined && !node.enum.some((entry) => entry === value)) {
    issues.push({ path, kind: 'invalid_enum' })
  }
}

/**
 * Validates tool call arguments against the tool's real, certified schema
 * (never a hand-written/duplicated one), returning a diagnostic list of
 * issues so `toolArgumentRepair.ts` can target concrete fixes instead of a
 * single opaque pass/fail flag.
 */
export function validateToolArguments(
  schema: AIToolSchemaNode,
  value: Readonly<Record<string, AIToolJsonValue>>,
): ToolArgumentValidationResult {
  const issues: ToolArgumentIssue[] = []
  collectIssues(schema, value, '', issues)

  return {
    // `validateValueAgainstSchema` is the certified, already-tested schema
    // check used by `AIToolExecutor`; it is the final authority for
    // pass/fail. `issues` only exists to guide repair.
    valid: issues.length === 0 && validateValueAgainstSchema(schema, value),
    issues,
  }
}

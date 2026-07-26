import type { AIToolJsonValue, AIToolSchemaNode } from '../ai-tools'

export interface FinancialContextHints {
  readonly defaultCurrency?: string
  readonly activePeriod?: {
    readonly from?: string
    readonly to?: string
    readonly timezone?: string
  }
}

type MutableRecord = Record<string, AIToolJsonValue>

function isRecord(value: unknown): value is MutableRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function schemaHasProperty(schema: AIToolSchemaNode, ...path: readonly string[]): boolean {
  let current: AIToolSchemaNode | undefined = schema

  for (const key of path) {
    if (current?.type !== 'object' || current.properties?.[key] === undefined) {
      return false
    }
    current = current.properties[key]
  }

  return true
}

/**
 * Completes structurally-missing (but schema-supported) fields using
 * already-known financial context — never invented financial values, only
 * contextual defaults the app already knows (active period, default
 * currency). If the schema does not declare a slot for a hint, nothing is
 * added.
 */
export function buildToolArguments(input: {
  readonly schema: AIToolSchemaNode
  readonly baseArguments: Readonly<Record<string, AIToolJsonValue>>
  readonly context: FinancialContextHints
}): Readonly<Record<string, AIToolJsonValue>> {
  const result = structuredClone(input.baseArguments) as MutableRecord

  if (
    input.context.defaultCurrency !== undefined
    && schemaHasProperty(input.schema, 'filters', 'currencyCode')
  ) {
    const filters = isRecord(result.filters) ? result.filters : {}
    if (filters.currencyCode === undefined) {
      result.filters = { ...filters, currencyCode: input.context.defaultCurrency }
    }
  }

  if (
    input.context.activePeriod !== undefined
    && schemaHasProperty(input.schema, 'filters', 'period')
  ) {
    const filters = isRecord(result.filters) ? result.filters : {}
    if (filters.period === undefined) {
      const { from, to, timezone } = input.context.activePeriod
      result.filters = {
        ...filters,
        period: {
          ...(from === undefined ? {} : { from }),
          ...(to === undefined ? {} : { to }),
          ...(timezone === undefined ? {} : { timezone }),
        },
      }
    }
  }

  return result
}

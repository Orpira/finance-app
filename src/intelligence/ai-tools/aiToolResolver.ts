import type {
  AITool,
  AIToolDefinition,
  AIToolFailure,
  AIToolRegistry,
} from './aiToolContracts'
import {
  createToolFailure,
  validateToolDefinition,
} from './aiToolValidator'

export interface AIToolResolver {
  resolve(toolId: string): { readonly kind: 'success'; readonly tool: AITool } | AIToolFailure
  exists(toolId: string): boolean
  listDefinitions(): readonly AIToolDefinition[]
}

export type AIToolResolverCatalogValidationResult =
  | {
      readonly kind: 'success'
      readonly toolNames: readonly string[]
    }
  | AIToolFailure

function normalizeToolName(name: string): string {
  return name.trim().toLowerCase()
}

function hasValidToolId(toolId: string): boolean {
  return toolId.trim().length > 0
}

function validateCatalogTools(catalog: readonly AITool[]): AIToolFailure | null {
  const uniqueNames = new Set<string>()

  for (const tool of catalog) {
    const definitionValidation = validateToolDefinition(tool)
    if (definitionValidation) {
      return definitionValidation
    }

    const normalized = normalizeToolName(tool.definition.name)
    if (uniqueNames.has(normalized)) {
      return createToolFailure(
        'TOOL_ALREADY_REGISTERED',
        `The tool catalog contains a duplicated tool id '${tool.definition.name}'.`,
      )
    }

    uniqueNames.add(normalized)
  }

  return null
}

export function validateAIToolResolverCatalog(input: {
  readonly registry: AIToolRegistry
  readonly catalog: readonly AITool[]
}): AIToolResolverCatalogValidationResult {
  const validationFailure = validateCatalogTools(input.catalog)
  if (validationFailure !== null) {
    return validationFailure
  }

  const toolNames: string[] = []

  for (const tool of input.catalog) {
    const resolved = input.registry.resolve(tool.definition.name)
    if (resolved.kind === 'failure') {
      return resolved
    }
    toolNames.push(resolved.tool.definition.name)
  }

  return {
    kind: 'success',
    toolNames,
  }
}

export function createAIToolResolver(input: {
  readonly registry: AIToolRegistry
  readonly catalog: readonly AITool[]
}): AIToolResolver {
  const catalogValidation = validateAIToolResolverCatalog(input)
  if (catalogValidation.kind === 'failure') {
    throw new Error(catalogValidation.safeMessage)
  }

  const catalogToolIds = new Set(
    catalogValidation.toolNames.map((name) => normalizeToolName(name)),
  )

  function resolve(toolId: string) {
    if (!hasValidToolId(toolId)) {
      return createToolFailure('INVALID_TOOL', 'The tool id must be a non-empty string.')
    }

    const normalized = normalizeToolName(toolId)
    if (!catalogToolIds.has(normalized)) {
      return createToolFailure('TOOL_NOT_FOUND', `The tool '${toolId}' is not part of the certified catalog.`)
    }

    return input.registry.resolve(toolId)
  }

  function exists(toolId: string): boolean {
    if (!hasValidToolId(toolId)) {
      return false
    }

    const normalized = normalizeToolName(toolId)
    if (!catalogToolIds.has(normalized)) {
      return false
    }

    return input.registry.resolve(toolId).kind === 'success'
  }

  function listDefinitions(): readonly AIToolDefinition[] {
    const definitions = input.registry.listDefinitions()
    return definitions.filter((definition) => catalogToolIds.has(normalizeToolName(definition.name)))
  }

  return {
    resolve,
    exists,
    listDefinitions,
  }
}

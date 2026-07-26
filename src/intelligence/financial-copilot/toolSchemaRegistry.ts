import type {
  AIToolPermission,
  AIToolRegistry,
  AIToolSchemaNode,
} from '../ai-tools'

export interface ToolSchemaEntry {
  readonly toolId: string
  readonly description: string
  readonly permission: AIToolPermission
  readonly inputSchema: AIToolSchemaNode
  readonly outputSchema: AIToolSchemaNode
  readonly tags: readonly string[]
}

export interface ToolSchemaRegistry {
  listSchemas(): readonly ToolSchemaEntry[]
  getSchema(toolId: string): ToolSchemaEntry | null
}

/**
 * Exposes the real, certified JSON Schema already declared by each
 * registered AITool (`AIToolDefinition.inputSchema`/`outputSchema`).
 * This registry never invents or duplicates a schema: it only reads
 * `AIToolRegistry.listDefinitions()`, the single source of truth the
 * Financial Tools already publish.
 */
export function createToolSchemaRegistry(registry: AIToolRegistry): ToolSchemaRegistry {
  function listSchemas(): readonly ToolSchemaEntry[] {
    return registry.listDefinitions().map((definition) => ({
      toolId: definition.name,
      description: definition.description,
      permission: definition.permission,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      tags: definition.tags ?? [],
    }))
  }

  function getSchema(toolId: string): ToolSchemaEntry | null {
    return listSchemas().find((entry) => entry.toolId === toolId) ?? null
  }

  return {
    listSchemas,
    getSchema,
  }
}

import type { AIToolRegistry } from '../ai-tools'
import {
  createToolSchemaRegistry,
  type ToolSchemaEntry,
} from './toolSchemaRegistry'

export interface ToolCapabilityMetadata {
  readonly categories: readonly string[]
  readonly examples: readonly string[]
  readonly useCases: readonly string[]
  readonly limits: readonly string[]
}

export interface ToolCapability extends ToolSchemaEntry, ToolCapabilityMetadata {}

export interface FinancialToolRegistry {
  listTools(): readonly ToolCapability[]
  getTool(toolId: string): ToolCapability | null
}

const EMPTY_METADATA: ToolCapabilityMetadata = {
  categories: [],
  examples: [],
  useCases: [],
  limits: [],
}

/**
 * Descriptive metadata (categories/examples/use cases/limits) for the
 * certified financial tools. This never redefines a schema — it only adds
 * human/model-facing context on top of the real schema exposed by
 * `ToolSchemaRegistry`, so the Intent Resolver can reason about tool
 * capabilities without hand-written prompt descriptions.
 */
const TOOL_CAPABILITY_METADATA: Readonly<Record<string, ToolCapabilityMetadata>> = {
  financial_balance: {
    categories: ['balance', 'summary'],
    examples: ['¿Cuál es mi balance actual?', '¿Cuánto dinero tengo disponible?'],
    useCases: ['Consultar el balance general disponible en el período activo.'],
    limits: ['Solo lectura. No incluye proyecciones futuras.'],
  },
  financial_transactions: {
    categories: ['transactions', 'income', 'expense'],
    examples: [
      '¿Cuáles son mis dos últimos ingresos?',
      'Compara mis dos últimos ingresos.',
      'Dame mis transacciones de este mes.',
    ],
    useCases: [
      'Listar, filtrar, ordenar y comparar ingresos, egresos y ajustes individuales.',
    ],
    limits: ['Máximo 200 resultados por consulta (`limit`).'],
  },
  financial_budget: {
    categories: ['budget'],
    examples: ['¿Cómo va mi presupuesto?', 'Necesito mi presupuesto.'],
    useCases: ['Consultar el estado del presupuesto según los cortes registrados.'],
    limits: ['Depende de que existan cortes (`cutoff reports`) registrados.'],
  },
  financial_goals: {
    categories: ['goals'],
    examples: ['¿Cómo van mis metas de ahorro?'],
    useCases: ['Consultar el progreso de metas financieras del período activo.'],
    limits: ['Requiere una temporada/período activo en modo profesional.'],
  },
  financial_reports: {
    categories: ['reports', 'statistics'],
    examples: ['Dame un resumen del período.', 'Necesito mi reporte financiero.'],
    useCases: ['Obtener estadísticas y reportes de cierre de un período.'],
    limits: ['Requiere estadísticas de temporada calculadas (`getSeasonStatistics`).'],
  },
  financial_insights: {
    categories: ['insights'],
    examples: ['¿Tienes alguna recomendación financiera para mí?'],
    useCases: ['Obtener una lectura resumida de salud financiera basada en reportes existentes.'],
    limits: ['No sustituye al Financial Insight Engine certificado del Dashboard.'],
  },
}

/**
 * Enriches the real `AIToolRegistry` with descriptive capability metadata
 * (categories/examples/use cases/limits) the Intent Resolver can use instead
 * of hand-written, hallucination-prone prompt descriptions. Never
 * duplicates or invents a schema: the schema always comes from
 * `ToolSchemaRegistry`, itself sourced from the certified tool definitions.
 */
export function createFinancialToolRegistry(registry: AIToolRegistry): FinancialToolRegistry {
  const schemaRegistry = createToolSchemaRegistry(registry)

  function listTools(): readonly ToolCapability[] {
    return schemaRegistry.listSchemas().map((schema) => ({
      ...schema,
      ...(TOOL_CAPABILITY_METADATA[schema.toolId] ?? EMPTY_METADATA),
    }))
  }

  function getTool(toolId: string): ToolCapability | null {
    return listTools().find((tool) => tool.toolId === toolId) ?? null
  }

  return {
    listTools,
    getTool,
  }
}

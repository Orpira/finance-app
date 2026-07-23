import {
  createToolFailure,
  type AITool,
} from '../../intelligence/ai-tools'
import type {
  KnowledgeRepository,
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
  KnowledgeSearchTool,
} from './knowledgeContracts'

function normalizeLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 5
  }

  return Math.max(1, Math.min(20, Math.floor(value)))
}

function normalizeQuery(input: {
  readonly arguments: Readonly<Record<string, unknown>>
}): KnowledgeSearchQuery | null {
  const rawQuery = input.arguments.query
  if (typeof rawQuery !== 'string' || rawQuery.trim().length === 0) {
    return null
  }

  return {
    text: rawQuery.trim(),
    limit: normalizeLimit(input.arguments.limit),
  }
}

export function createKnowledgeSearchToolUseCase(input: {
  readonly repository: KnowledgeRepository
}): KnowledgeSearchTool {
  return {
    name: 'knowledge_search',
    async search({ query }) {
      return input.repository.search({ query })
    },
  }
}

export function createKnowledgeSearchAITool(input: {
  readonly tool: KnowledgeSearchTool
}): AITool {
  return {
    definition: {
      name: input.tool.name,
      description: 'Searches local knowledge documents and returns relevant chunks only.',
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          status: {
            type: 'string',
            enum: ['ok', 'no-results'],
          },
          chunks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                chunkId: { type: 'string' },
                documentId: { type: 'string' },
                documentTitle: { type: 'string' },
                sourceType: { type: 'string' },
                score: { type: 'number' },
                content: { type: 'string' },
              },
              required: ['chunkId', 'documentId', 'documentTitle', 'sourceType', 'score', 'content'],
              additionalProperties: false,
            },
          },
        },
        required: ['query', 'status', 'chunks'],
        additionalProperties: false,
      },
      tags: ['knowledge', 'rag', 'local-first', 'tool-calling'],
    },
    async execute(inputValue) {
      const query = normalizeQuery({ arguments: inputValue.arguments as Readonly<Record<string, unknown>> })
      if (query === null) {
        return createToolFailure('INVALID_ARGUMENTS', 'Knowledge search requires a non-empty query string.')
      }

      const result = await input.tool.search({ query })
      if (result.kind === 'failure') {
        if (result.code === 'NO_RESULTS') {
          return {
            kind: 'success',
            value: {
              toolName: 'knowledge_search',
              output: {
                query: query.text,
                status: 'no-results',
                chunks: [],
              },
              permission: 'read-only',
              durationMs: 0,
            },
          }
        }

        return createToolFailure('TOOL_EXECUTION_FAILED', result.safeMessage, result.retryable)
      }

      const payload = mapToolResult(result.value)
      return {
        kind: 'success',
        value: {
          toolName: 'knowledge_search',
          output: payload,
          permission: 'read-only',
          durationMs: 0,
        },
      }
    },
  }
}

function mapToolResult(result: KnowledgeSearchResult): {
  readonly query: string
  readonly status: 'ok'
  readonly chunks: readonly {
    readonly chunkId: string
    readonly documentId: string
    readonly documentTitle: string
    readonly sourceType: string
    readonly score: number
    readonly content: string
  }[]
} {
  return {
    query: result.query.text,
    status: 'ok',
    chunks: result.matches.map((match) => ({
      chunkId: match.chunk.chunkId,
      documentId: match.document.documentId,
      documentTitle: match.document.title,
      sourceType: match.document.sourceType,
      score: match.score,
      content: match.chunk.content,
    })),
  }
}

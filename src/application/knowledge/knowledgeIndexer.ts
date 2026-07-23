import type {
  KnowledgeChunk,
  KnowledgeChunkingStrategy,
  KnowledgeDocument,
  KnowledgeIndexer,
  KnowledgeResult,
  KnowledgeSearchFailure,
} from './knowledgeContracts'

function success<TValue>(value: TValue): KnowledgeResult<TValue> {
  return {
    kind: 'success',
    value,
  }
}

function failure(
  code: KnowledgeSearchFailure['code'],
  safeMessage: string,
): KnowledgeSearchFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function isIsoUtcInstant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
}

function computeTermFrequency(tokens: readonly string[]): Readonly<Record<string, number>> {
  const table = new Map<string, number>()
  for (const token of tokens) {
    table.set(token, (table.get(token) ?? 0) + 1)
  }

  const sorted = [...table.entries()].sort(([left], [right]) => left.localeCompare(right))
  const result: Record<string, number> = {}
  for (const [token, count] of sorted) {
    result[token] = count
  }
  return result
}

function validateDocument(document: KnowledgeDocument): KnowledgeSearchFailure | null {
  if (document.documentId.trim().length === 0) {
    return failure('INVALID_DOCUMENT', 'The knowledge document id is required.')
  }

  if (document.title.trim().length === 0 || document.content.trim().length === 0) {
    return failure('INVALID_DOCUMENT', 'The knowledge document title and content are required.')
  }

  if (!isIsoUtcInstant(document.createdAt) || !isIsoUtcInstant(document.updatedAt)) {
    return failure('INVALID_DOCUMENT', 'The knowledge document timestamps are invalid.')
  }

  return null
}

function toChunkId(documentId: string, chunkOrder: number): string {
  return `${documentId}:chunk:${String(chunkOrder + 1).padStart(4, '0')}`
}

export function createKnowledgeIndexer(input: {
  readonly chunkingStrategy: KnowledgeChunkingStrategy
}): KnowledgeIndexer {
  return {
    indexDocument({ document }) {
      const invalid = validateDocument(document)
      if (invalid) {
        return invalid
      }

      const chunked = input.chunkingStrategy.chunk({ text: document.content })
      if (chunked.kind === 'failure') {
        return chunked
      }

      const chunks: KnowledgeChunk[] = chunked.value.map((draft, index) => ({
        chunkId: toChunkId(document.documentId, index),
        documentId: document.documentId,
        chunkOrder: index,
        content: draft.content,
        startOffset: draft.startOffset,
        endOffset: draft.endOffset,
        normalizedTokens: [...draft.normalizedTokens],
        tokenCount: draft.normalizedTokens.length,
        termFrequency: computeTermFrequency(draft.normalizedTokens),
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      }))

      if (chunks.some((chunk) => chunk.tokenCount < 1)) {
        return failure('CHUNK_INVALID', 'A knowledge chunk cannot be empty.')
      }

      return success(chunks)
    },
  }
}

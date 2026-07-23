import type {
  KnowledgeChunkingDraft,
  KnowledgeChunkingStrategy,
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

function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeKnowledgeText(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenizeKnowledgeText(value: string): readonly string[] {
  const normalized = normalizeKnowledgeText(value)
  if (normalized.length === 0) {
    return []
  }

  return normalized.split(' ').filter((token) => token.length > 0)
}

export function createFixedWindowChunkingStrategy(input?: {
  readonly targetChunkTokens?: number
  readonly overlapTokens?: number
  readonly minChunkTokens?: number
}): KnowledgeChunkingStrategy {
  const targetChunkTokens = input?.targetChunkTokens ?? 120
  const overlapTokens = input?.overlapTokens ?? 24
  const minChunkTokens = input?.minChunkTokens ?? 8

  return {
    chunk({ text }) {
      if (typeof text !== 'string' || text.trim().length === 0) {
        return failure('INVALID_DOCUMENT', 'The knowledge document content cannot be empty.')
      }

      if (
        targetChunkTokens < 16
        || overlapTokens < 0
        || overlapTokens >= targetChunkTokens
        || minChunkTokens < 1
        || minChunkTokens > targetChunkTokens
      ) {
        return failure('CHUNK_INVALID', 'The configured chunking strategy is invalid.')
      }

      const terms = tokenizeKnowledgeText(text)
      if (terms.length === 0) {
        return failure('CHUNK_INVALID', 'The document does not contain searchable tokens.')
      }

      const chunks: KnowledgeChunkingDraft[] = []
      let cursor = 0
      while (cursor < terms.length) {
        const windowEnd = Math.min(terms.length, cursor + targetChunkTokens)
        const normalizedTokens = terms.slice(cursor, windowEnd)

        if (normalizedTokens.length < minChunkTokens && chunks.length > 0) {
          const previous = chunks[chunks.length - 1]
          if (previous === undefined) {
            return failure('CHUNK_INVALID', 'The generated chunk sequence is invalid.')
          }

          const mergedTokens = [...previous.normalizedTokens, ...normalizedTokens]
          chunks[chunks.length - 1] = {
            ...previous,
            content: `${previous.content} ${normalizedTokens.join(' ')}`.trim(),
            normalizedTokens: mergedTokens,
            endOffset: text.length,
          }
          break
        }

        chunks.push({
          content: normalizedTokens.join(' '),
          startOffset: cursor,
          endOffset: windowEnd,
          normalizedTokens,
        })

        if (windowEnd >= terms.length) {
          break
        }

        cursor = Math.max(0, windowEnd - overlapTokens)
      }

      if (chunks.length === 0) {
        return failure('CHUNK_INVALID', 'At least one valid chunk is required.')
      }

      return success(chunks)
    },
  }
}

import type {
  KnowledgeDocument,
  KnowledgeResult,
  KnowledgeSearchEngine,
  KnowledgeSearchFailure,
  KnowledgeSearchMatch,
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
} from './knowledgeContracts'
import { tokenizeKnowledgeText } from './chunkingStrategies'

const MAX_LIMIT = 20
const DEFAULT_LIMIT = 5

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

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) {
    return DEFAULT_LIMIT
  }

  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(limit)))
}

function resolveScopedDocumentIds(query: KnowledgeSearchQuery): ReadonlySet<string> | null {
  const allowed = query.allowedDocumentIds === undefined
    ? null
    : new Set(query.allowedDocumentIds.filter((item) => item.trim().length > 0))
  const requested = query.documentIds === undefined
    ? null
    : new Set(query.documentIds.filter((item) => item.trim().length > 0))

  if (allowed === null && requested === null) {
    return null
  }

  if (allowed !== null && requested !== null) {
    const intersection = new Set<string>()
    for (const item of requested) {
      if (allowed.has(item)) {
        intersection.add(item)
      }
    }
    return intersection
  }

  return requested ?? allowed
}

function buildDocumentMap(value: Readonly<Record<string, KnowledgeDocument>>): Map<string, KnowledgeDocument> {
  return new Map<string, KnowledgeDocument>(Object.entries(value))
}

function computeInverseDocumentFrequency(input: {
  readonly term: string
  readonly totalChunks: number
  readonly chunks: readonly { readonly termFrequency: Readonly<Record<string, number>> }[]
}): number {
  let documentsWithTerm = 0
  for (const chunk of input.chunks) {
    if ((chunk.termFrequency[input.term] ?? 0) > 0) {
      documentsWithTerm += 1
    }
  }

  if (documentsWithTerm === 0) {
    return 0
  }

  return Math.log(1 + ((input.totalChunks - documentsWithTerm + 0.5) / (documentsWithTerm + 0.5)))
}

function bm25Score(input: {
  readonly termFrequency: number
  readonly documentLength: number
  readonly averageDocumentLength: number
  readonly idf: number
}): number {
  const k1 = 1.2
  const b = 0.75

  const denominator = input.termFrequency
    + k1 * (1 - b + b * (input.documentLength / Math.max(1, input.averageDocumentLength)))

  if (denominator <= 0) {
    return 0
  }

  return input.idf * ((input.termFrequency * (k1 + 1)) / denominator)
}

function stableSortMatches(matches: readonly KnowledgeSearchMatch[]): readonly KnowledgeSearchMatch[] {
  return [...matches].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score
    }

    if (left.document.documentId !== right.document.documentId) {
      return left.document.documentId.localeCompare(right.document.documentId)
    }

    if (left.chunk.chunkOrder !== right.chunk.chunkOrder) {
      return left.chunk.chunkOrder - right.chunk.chunkOrder
    }

    return left.chunk.chunkId.localeCompare(right.chunk.chunkId)
  })
}

export function createDeterministicKnowledgeSearchEngine(): KnowledgeSearchEngine {
  return {
    search({ query, chunks, documentsById }) {
      if (query.text.trim().length === 0) {
        return failure('SEARCH_FAILED', 'The search query cannot be empty.')
      }

      const queryTokens = tokenizeKnowledgeText(query.text)
      if (queryTokens.length === 0) {
        return failure('SEARCH_FAILED', 'The search query does not contain searchable tokens.')
      }

      const scopedDocumentIds = resolveScopedDocumentIds(query)
      if (scopedDocumentIds !== null && scopedDocumentIds.size === 0) {
        return failure('UNAUTHORIZED_SCOPE', 'No authorized documents are available for this search query.')
      }

      const documentMap = buildDocumentMap(documentsById)
      const candidateChunks = chunks.filter((chunk) => {
        if (!documentMap.has(chunk.documentId)) {
          return false
        }

        if (scopedDocumentIds === null) {
          return true
        }

        return scopedDocumentIds.has(chunk.documentId)
      })

      if (candidateChunks.length === 0) {
        return failure('NO_RESULTS', 'No indexed chunks are available for the requested scope.')
      }

      const averageDocumentLength = candidateChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0) / candidateChunks.length
      const uniqueQueryTokens = [...new Set(queryTokens)]
      const idfByToken = new Map<string, number>()
      for (const token of uniqueQueryTokens) {
        idfByToken.set(token, computeInverseDocumentFrequency({
          term: token,
          totalChunks: candidateChunks.length,
          chunks: candidateChunks,
        }))
      }

      const scoredMatches: KnowledgeSearchMatch[] = []
      for (const chunk of candidateChunks) {
        let score = 0
        for (const token of uniqueQueryTokens) {
          const tf = chunk.termFrequency[token] ?? 0
          if (tf <= 0) {
            continue
          }

          const idf = idfByToken.get(token) ?? 0
          score += bm25Score({
            termFrequency: tf,
            documentLength: chunk.tokenCount,
            averageDocumentLength,
            idf,
          })
        }

        if (score <= 0) {
          continue
        }

        const document = documentMap.get(chunk.documentId)
        if (document === undefined) {
          continue
        }

        scoredMatches.push({
          chunk,
          document: {
            documentId: document.documentId,
            title: document.title,
            sourceType: document.sourceType,
            tags: [...document.tags],
          },
          score: Number(score.toFixed(8)),
        })
      }

      if (scoredMatches.length === 0) {
        return failure('NO_RESULTS', 'No relevant knowledge chunks were found.')
      }

      const sorted = stableSortMatches(scoredMatches)
      const limitedMatches = sorted.slice(0, clampLimit(query.limit))
      return success({
        query: {
          ...query,
          limit: clampLimit(query.limit),
          ...(query.documentIds === undefined ? {} : { documentIds: [...query.documentIds] }),
          ...(query.allowedDocumentIds === undefined
            ? {}
            : { allowedDocumentIds: [...query.allowedDocumentIds] }),
        },
        matches: limitedMatches,
      } satisfies KnowledgeSearchResult)
    },
  }
}

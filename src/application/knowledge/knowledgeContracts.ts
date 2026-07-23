export const KNOWLEDGE_SEARCH_FAILURE_CODES = [
  'DOCUMENT_NOT_FOUND',
  'INVALID_DOCUMENT',
  'INDEX_FAILED',
  'SEARCH_FAILED',
  'CHUNK_INVALID',
  'NO_RESULTS',
  'STORAGE_UNAVAILABLE',
  'UNAUTHORIZED_SCOPE',
] as const

export type KnowledgeSearchFailureCode = (typeof KNOWLEDGE_SEARCH_FAILURE_CODES)[number]

export interface KnowledgeSearchFailure {
  readonly kind: 'failure'
  readonly code: KnowledgeSearchFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
}

export interface KnowledgeSuccess<TValue> {
  readonly kind: 'success'
  readonly value: TValue
}

export type KnowledgeResult<TValue> = KnowledgeSuccess<TValue> | KnowledgeSearchFailure

export interface KnowledgeDocument {
  readonly documentId: string
  readonly title: string
  readonly content: string
  readonly sourceType: 'manual' | 'import'
  readonly sourceUri?: string
  readonly tags: readonly string[]
  readonly createdAt: string
  readonly updatedAt: string
}

export interface KnowledgeChunk {
  readonly chunkId: string
  readonly documentId: string
  readonly chunkOrder: number
  readonly content: string
  readonly startOffset: number
  readonly endOffset: number
  readonly normalizedTokens: readonly string[]
  readonly tokenCount: number
  readonly termFrequency: Readonly<Record<string, number>>
  readonly createdAt: string
  readonly updatedAt: string
}

export interface KnowledgeSearchQuery {
  readonly text: string
  readonly limit: number
  readonly documentIds?: readonly string[]
  readonly allowedDocumentIds?: readonly string[]
}

export interface KnowledgeSearchMatch {
  readonly chunk: KnowledgeChunk
  readonly document: {
    readonly documentId: string
    readonly title: string
    readonly sourceType: KnowledgeDocument['sourceType']
    readonly tags: readonly string[]
  }
  readonly score: number
}

export interface KnowledgeSearchResult {
  readonly query: KnowledgeSearchQuery
  readonly matches: readonly KnowledgeSearchMatch[]
}

export interface KnowledgeChunkingDraft {
  readonly content: string
  readonly startOffset: number
  readonly endOffset: number
  readonly normalizedTokens: readonly string[]
}

export interface KnowledgeChunkingStrategy {
  chunk(input: {
    readonly text: string
  }): KnowledgeResult<readonly KnowledgeChunkingDraft[]>
}

export interface KnowledgeIndexer {
  indexDocument(input: {
    readonly document: KnowledgeDocument
  }): KnowledgeResult<readonly KnowledgeChunk[]>
}

export interface KnowledgeSearchEngine {
  search(input: {
    readonly query: KnowledgeSearchQuery
    readonly chunks: readonly KnowledgeChunk[]
    readonly documentsById: Readonly<Record<string, KnowledgeDocument>>
  }): KnowledgeResult<KnowledgeSearchResult>
}

export interface KnowledgeRepository {
  saveDocument(input: {
    readonly document: KnowledgeDocument
  }): Promise<KnowledgeResult<{ readonly document: KnowledgeDocument; readonly chunksIndexed: number }>>
  updateDocument(input: {
    readonly document: KnowledgeDocument
  }): Promise<KnowledgeResult<{ readonly document: KnowledgeDocument; readonly chunksIndexed: number }>>
  deleteDocument(input: {
    readonly documentId: string
  }): Promise<KnowledgeResult<{ readonly deleted: boolean }>>
  listDocuments(): Promise<KnowledgeResult<readonly KnowledgeDocument[]>>
  search(input: {
    readonly query: KnowledgeSearchQuery
  }): Promise<KnowledgeResult<KnowledgeSearchResult>>
}

export interface KnowledgeSearchTool {
  readonly name: 'knowledge_search'
  search(input: {
    readonly query: KnowledgeSearchQuery
  }): Promise<KnowledgeResult<KnowledgeSearchResult>>
}

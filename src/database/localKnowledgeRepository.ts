import Dexie, { type Table } from 'dexie'

import type {
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeIndexer,
  KnowledgeRepository,
  KnowledgeResult,
  KnowledgeSearchEngine,
  KnowledgeSearchFailure,
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
} from '../application/knowledge'
import {
  createDeterministicKnowledgeSearchEngine,
  createFixedWindowChunkingStrategy,
  createKnowledgeIndexer,
} from '../application/knowledge'
import { db } from './db'
import {
  KNOWLEDGE_CHUNK_LOCAL_SCHEMA_VERSION,
  type PersistedKnowledgeChunk,
} from '../types/persistedKnowledgeChunk'
import {
  KNOWLEDGE_DOCUMENT_LOCAL_SCHEMA_VERSION,
  type PersistedKnowledgeDocument,
} from '../types/persistedKnowledgeDocument'

interface LocalKnowledgeDatabase {
  readonly knowledgeDocuments: Table<PersistedKnowledgeDocument, PersistedKnowledgeDocument['documentId']>
  readonly knowledgeChunks: Table<PersistedKnowledgeChunk, PersistedKnowledgeChunk['chunkId']>
  transaction?<T>(
    mode: 'r' | 'rw',
    tables: readonly Table<unknown, unknown>[],
    scope: () => Promise<T>,
  ): Promise<T>
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function success<TValue>(value: TValue): KnowledgeResult<TValue> {
  return {
    kind: 'success',
    value,
  }
}

function failure(
  code: KnowledgeSearchFailure['code'],
  safeMessage: string,
  retryable = false,
): KnowledgeSearchFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
  }
}

function isIsoUtcInstant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
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

function toPersistedDocument(document: KnowledgeDocument): PersistedKnowledgeDocument {
  return {
    documentId: document.documentId,
    title: document.title,
    content: document.content,
    sourceType: document.sourceType,
    ...(document.sourceUri === undefined ? {} : { sourceUri: document.sourceUri }),
    tags: [...document.tags],
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    localSchemaVersion: KNOWLEDGE_DOCUMENT_LOCAL_SCHEMA_VERSION,
  }
}

function toPersistedChunk(chunk: KnowledgeChunk): PersistedKnowledgeChunk {
  return {
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    chunkOrder: chunk.chunkOrder,
    content: chunk.content,
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
    normalizedTokens: [...chunk.normalizedTokens],
    tokenCount: chunk.tokenCount,
    termFrequency: clone(chunk.termFrequency),
    createdAt: chunk.createdAt,
    updatedAt: chunk.updatedAt,
    localSchemaVersion: KNOWLEDGE_CHUNK_LOCAL_SCHEMA_VERSION,
  }
}

function toKnowledgeDocument(record: PersistedKnowledgeDocument): KnowledgeDocument {
  return {
    documentId: record.documentId,
    title: record.title,
    content: record.content,
    sourceType: record.sourceType,
    ...(record.sourceUri === undefined ? {} : { sourceUri: record.sourceUri }),
    tags: [...record.tags],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function toKnowledgeChunk(record: PersistedKnowledgeChunk) {
  return {
    chunkId: record.chunkId,
    documentId: record.documentId,
    chunkOrder: record.chunkOrder,
    content: record.content,
    startOffset: record.startOffset,
    endOffset: record.endOffset,
    normalizedTokens: [...record.normalizedTokens],
    tokenCount: record.tokenCount,
    termFrequency: clone(record.termFrequency),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

async function runTransaction<TValue>(
  database: LocalKnowledgeDatabase,
  mode: 'r' | 'rw',
  tables: readonly Table<unknown, unknown>[],
  scope: () => Promise<TValue>,
): Promise<TValue> {
  if (database.transaction === undefined) {
    return scope()
  }

  return database.transaction(mode, tables, scope)
}

export class LocalKnowledgeRepository implements KnowledgeRepository {
  private readonly database: LocalKnowledgeDatabase

  private readonly indexer: KnowledgeIndexer

  private readonly searchEngine: KnowledgeSearchEngine

  constructor(input?: {
    readonly database?: LocalKnowledgeDatabase
    readonly indexer?: KnowledgeIndexer
    readonly searchEngine?: KnowledgeSearchEngine
  }) {
    this.database = input?.database ?? (db as unknown as LocalKnowledgeDatabase)
    this.indexer = input?.indexer ?? createKnowledgeIndexer({
      chunkingStrategy: createFixedWindowChunkingStrategy(),
    })
    this.searchEngine = input?.searchEngine ?? createDeterministicKnowledgeSearchEngine()
  }

  async saveDocument(input: {
    readonly document: KnowledgeDocument
  }): Promise<KnowledgeResult<{ readonly document: KnowledgeDocument; readonly chunksIndexed: number }>> {
    const validation = validateDocument(input.document)
    if (validation) {
      return validation
    }

    const indexed = this.indexer.indexDocument({ document: input.document })
    if (indexed.kind === 'failure') {
      return indexed
    }

    try {
      await runTransaction(
        this.database,
        'rw',
        [this.database.knowledgeDocuments as unknown as Table<unknown, unknown>, this.database.knowledgeChunks as unknown as Table<unknown, unknown>],
        async () => {
          await this.database.knowledgeDocuments.put(toPersistedDocument(input.document))

          const existingChunks = await this.database.knowledgeChunks.toArray()
          const removableChunkIds = existingChunks
            .filter((chunk) => chunk.documentId === input.document.documentId)
            .map((chunk) => chunk.chunkId)

          if (removableChunkIds.length > 0) {
            await this.database.knowledgeChunks.bulkDelete(removableChunkIds)
          }

          const persistedChunks = indexed.value.map((chunk) => toPersistedChunk(chunk))
          if (persistedChunks.length > 0) {
            await this.database.knowledgeChunks.bulkPut(persistedChunks)
          }
        },
      )

      return success({
        document: clone(input.document),
        chunksIndexed: indexed.value.length,
      })
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('STORAGE_UNAVAILABLE', 'The local knowledge storage is not available.', true)
      }

      return failure('INDEX_FAILED', 'The knowledge document could not be indexed locally.', true)
    }
  }

  async updateDocument(input: {
    readonly document: KnowledgeDocument
  }): Promise<KnowledgeResult<{ readonly document: KnowledgeDocument; readonly chunksIndexed: number }>> {
    try {
      const existing = await this.database.knowledgeDocuments.get(input.document.documentId)
      if (existing === undefined) {
        return failure('DOCUMENT_NOT_FOUND', 'The knowledge document was not found.')
      }
    } catch {
      return failure('STORAGE_UNAVAILABLE', 'The local knowledge storage is not available.', true)
    }

    return this.saveDocument(input)
  }

  async deleteDocument(input: {
    readonly documentId: string
  }): Promise<KnowledgeResult<{ readonly deleted: boolean }>> {
    if (input.documentId.trim().length === 0) {
      return failure('INVALID_DOCUMENT', 'The knowledge document id is required.')
    }

    try {
      const existing = await this.database.knowledgeDocuments.get(input.documentId)
      if (existing === undefined) {
        return success({ deleted: false })
      }

      await runTransaction(
        this.database,
        'rw',
        [this.database.knowledgeDocuments as unknown as Table<unknown, unknown>, this.database.knowledgeChunks as unknown as Table<unknown, unknown>],
        async () => {
          const allChunks = await this.database.knowledgeChunks.toArray()
          const removableChunkIds = allChunks
            .filter((chunk) => chunk.documentId === input.documentId)
            .map((chunk) => chunk.chunkId)

          if (removableChunkIds.length > 0) {
            await this.database.knowledgeChunks.bulkDelete(removableChunkIds)
          }

          await this.database.knowledgeDocuments.delete(input.documentId)
        },
      )

      return success({ deleted: true })
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('STORAGE_UNAVAILABLE', 'The local knowledge storage is not available.', true)
      }

      return failure('INDEX_FAILED', 'The knowledge document could not be deleted.', true)
    }
  }

  async listDocuments(): Promise<KnowledgeResult<readonly KnowledgeDocument[]>> {
    try {
      const records = await this.database.knowledgeDocuments.toArray()
      const documents = records
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((record) => toKnowledgeDocument(record))

      return success(documents)
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('STORAGE_UNAVAILABLE', 'The local knowledge storage is not available.', true)
      }

      return failure('SEARCH_FAILED', 'The local knowledge documents could not be listed.', true)
    }
  }

  async search(input: {
    readonly query: KnowledgeSearchQuery
  }): Promise<KnowledgeResult<KnowledgeSearchResult>> {
    if (input.query.text.trim().length === 0) {
      return failure('SEARCH_FAILED', 'The knowledge search query cannot be empty.')
    }

    try {
      const [documentRecords, chunkRecords] = await Promise.all([
        this.database.knowledgeDocuments.toArray(),
        this.database.knowledgeChunks.toArray(),
      ])

      const documentsById: Record<string, KnowledgeDocument> = {}
      for (const documentRecord of documentRecords) {
        documentsById[documentRecord.documentId] = toKnowledgeDocument(documentRecord)
      }

      const chunks = chunkRecords.map((record) => toKnowledgeChunk(record))
      return this.searchEngine.search({
        query: input.query,
        chunks,
        documentsById,
      })
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('STORAGE_UNAVAILABLE', 'The local knowledge storage is not available.', true)
      }

      return failure('SEARCH_FAILED', 'The knowledge query failed unexpectedly.', true)
    }
  }
}

import type { KnowledgeChunk } from '../application/knowledge'

export const KNOWLEDGE_CHUNK_LOCAL_SCHEMA_VERSION = 1 as const

export interface PersistedKnowledgeChunk {
  readonly chunkId: KnowledgeChunk['chunkId']
  readonly documentId: KnowledgeChunk['documentId']
  readonly chunkOrder: KnowledgeChunk['chunkOrder']
  readonly content: KnowledgeChunk['content']
  readonly startOffset: KnowledgeChunk['startOffset']
  readonly endOffset: KnowledgeChunk['endOffset']
  readonly normalizedTokens: KnowledgeChunk['normalizedTokens']
  readonly tokenCount: KnowledgeChunk['tokenCount']
  readonly termFrequency: KnowledgeChunk['termFrequency']
  readonly createdAt: KnowledgeChunk['createdAt']
  readonly updatedAt: KnowledgeChunk['updatedAt']
  readonly localSchemaVersion: typeof KNOWLEDGE_CHUNK_LOCAL_SCHEMA_VERSION
}

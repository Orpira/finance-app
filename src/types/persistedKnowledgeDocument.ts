import type { KnowledgeDocument } from '../application/knowledge'

export const KNOWLEDGE_DOCUMENT_LOCAL_SCHEMA_VERSION = 1 as const

export interface PersistedKnowledgeDocument {
  readonly documentId: KnowledgeDocument['documentId']
  readonly title: KnowledgeDocument['title']
  readonly content: KnowledgeDocument['content']
  readonly sourceType: KnowledgeDocument['sourceType']
  readonly sourceUri?: KnowledgeDocument['sourceUri']
  readonly tags: KnowledgeDocument['tags']
  readonly createdAt: KnowledgeDocument['createdAt']
  readonly updatedAt: KnowledgeDocument['updatedAt']
  readonly localSchemaVersion: typeof KNOWLEDGE_DOCUMENT_LOCAL_SCHEMA_VERSION
}

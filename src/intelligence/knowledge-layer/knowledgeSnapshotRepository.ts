import Dexie, { type Table } from 'dexie'

import type { UtcInstant } from '../../types/financialSnapshot'
import type {
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
  SealedKnowledgeSnapshot,
} from '../../types/knowledgeLayer'
import {
  KNOWLEDGE_SNAPSHOT_LOCAL_SCHEMA_VERSION,
  type PersistedKnowledgeSnapshot,
} from '../../types/persistedKnowledgeSnapshot'
import { db } from '../../database/db'
import { sealCanonicalKnowledgeDocument } from './knowledgeSealer'

export type KnowledgePersistenceErrorCode =
  | 'KNOWLEDGE_PERSISTENCE_REVISION_CONFLICT'
  | 'KNOWLEDGE_PERSISTENCE_INVALID_SUPERSEDES'
  | 'KNOWLEDGE_PERSISTENCE_INTEGRITY_FAILURE'
  | 'KNOWLEDGE_PERSISTENCE_NOT_FOUND'
  | 'KNOWLEDGE_PERSISTENCE_SCHEMA_ERROR'
  | 'KNOWLEDGE_PERSISTENCE_INVALID_VALUE'

export class KnowledgePersistenceError extends Error {
  readonly code: KnowledgePersistenceErrorCode

  constructor(code: KnowledgePersistenceErrorCode) {
    super(code)
    this.name = 'KnowledgePersistenceError'
    this.code = code
  }
}

export interface KnowledgePersistenceResult {
  readonly record: PersistedKnowledgeSnapshot
  readonly idempotent: boolean
  readonly revision: number
}

export interface KnowledgeSnapshotDatabase {
  readonly knowledgeSnapshots: Table<
    PersistedKnowledgeSnapshot,
    PersistedKnowledgeSnapshot['knowledgeSnapshotId']
  >
  transaction<T>(
    mode: 'rw',
    table: Table<
      PersistedKnowledgeSnapshot,
      PersistedKnowledgeSnapshot['knowledgeSnapshotId']
    >,
    scope: () => Promise<T>,
  ): Promise<T>
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function fail(code: KnowledgePersistenceErrorCode): never {
  throw new KnowledgePersistenceError(code)
}

function assertUtcInstant(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    fail('KNOWLEDGE_PERSISTENCE_INVALID_VALUE')
  }
}

function assertSealedSnapshot(snapshot: SealedKnowledgeSnapshot): void {
  if (snapshot.status !== 'sealed') {
    fail('KNOWLEDGE_PERSISTENCE_INVALID_VALUE')
  }
}

function assertIdempotentIdentity(
  existing: PersistedKnowledgeSnapshot,
  incoming: SealedKnowledgeSnapshot,
): void {
  if (
    existing.knowledgeSnapshotKey !== incoming.knowledgeSnapshotKey ||
    existing.fingerprintValue !== incoming.fingerprint.value
  ) {
    fail('KNOWLEDGE_PERSISTENCE_INTEGRITY_FAILURE')
  }
}

async function verifyOfficialIntegrity(
  snapshot: SealedKnowledgeSnapshot,
  revision: number,
  supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId,
): Promise<void> {
  try {
    const verified = await sealCanonicalKnowledgeDocument({
      canonicalDocument: snapshot.canonicalDocument,
      fingerprint: snapshot.fingerprint,
      knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
      revision,
      revisionReasonCode: snapshot.revisionReasonCode,
      sealedAt: snapshot.sealedAt,
      ...(supersedesKnowledgeSnapshotId === undefined
        ? {}
        : { supersedesKnowledgeSnapshotId }),
    })

    if (
      verified.knowledgeSnapshotId !== snapshot.knowledgeSnapshotId ||
      verified.knowledgeSnapshotKey !== snapshot.knowledgeSnapshotKey ||
      verified.fingerprint.value !== snapshot.fingerprint.value
    ) {
      fail('KNOWLEDGE_PERSISTENCE_INTEGRITY_FAILURE')
    }
  } catch (error) {
    if (error instanceof KnowledgePersistenceError) {
      throw error
    }
    fail('KNOWLEDGE_PERSISTENCE_INTEGRITY_FAILURE')
  }
}

export class KnowledgeSnapshotRepository {
  private readonly database: KnowledgeSnapshotDatabase

  constructor(database: KnowledgeSnapshotDatabase = db) {
    this.database = database
  }

  async persist(
    snapshot: SealedKnowledgeSnapshot,
    persistedAt: UtcInstant,
  ): Promise<KnowledgePersistenceResult> {
    assertUtcInstant(persistedAt)
    assertSealedSnapshot(snapshot)

    try {
      return await this.database.transaction(
        'rw',
        this.database.knowledgeSnapshots,
        async () => {
          const existing = await this.database.knowledgeSnapshots.get(
            snapshot.knowledgeSnapshotId,
          )

          if (existing !== undefined) {
            assertIdempotentIdentity(existing, snapshot)
            return {
              record: clone(existing),
              idempotent: true,
              revision: existing.revision,
            }
          }

          const latest = await this.database.knowledgeSnapshots
            .where('[knowledgeSnapshotKey+revision]')
            .between(
              [snapshot.knowledgeSnapshotKey, Dexie.minKey],
              [snapshot.knowledgeSnapshotKey, Dexie.maxKey],
            )
            .last()

          const revision = (latest?.revision ?? 0) + 1

          if (revision === 1) {
            if (snapshot.supersedesKnowledgeSnapshotId !== undefined) {
              fail('KNOWLEDGE_PERSISTENCE_INVALID_SUPERSEDES')
            }
          } else if (
            snapshot.supersedesKnowledgeSnapshotId === undefined ||
            latest === undefined ||
            snapshot.supersedesKnowledgeSnapshotId !==
              latest.knowledgeSnapshotId ||
            latest.knowledgeSnapshotKey !== snapshot.knowledgeSnapshotKey
          ) {
            fail('KNOWLEDGE_PERSISTENCE_INVALID_SUPERSEDES')
          }

          await verifyOfficialIntegrity(
            snapshot,
            revision,
            latest?.knowledgeSnapshotId,
          )

          const record: PersistedKnowledgeSnapshot = {
            knowledgeSnapshotId: snapshot.knowledgeSnapshotId,
            knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
            revision,
            status: snapshot.status,
            canonicalDocument: clone(snapshot.canonicalDocument),
            fingerprint: clone(snapshot.fingerprint),
            sealedAt: snapshot.sealedAt,
            ...(latest === undefined
              ? {}
              : {
                  supersedesKnowledgeSnapshotId:
                    latest.knowledgeSnapshotId,
                }),
            persistedAt,
            localSchemaVersion: KNOWLEDGE_SNAPSHOT_LOCAL_SCHEMA_VERSION,
            knowledgeVersion: snapshot.knowledgeVersion,
            builderVersion: snapshot.knowledgeBuilderVersion,
            rulesVersion: snapshot.knowledgeRulesVersion,
            projectionVersion: snapshot.knowledgeProjectionVersion,
            canonicalizationVersion:
              snapshot.knowledgeCanonicalizationVersion,
            sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
            sourceSnapshotKey: snapshot.sourceSnapshotReferences.snapshotKey,
            fingerprintValue: snapshot.fingerprint.value,
          }

          await this.database.knowledgeSnapshots.add(record)

          return {
            record: clone(record),
            idempotent: false,
            revision,
          }
        },
      )
    } catch (error) {
      if (error instanceof KnowledgePersistenceError) {
        throw error
      }
      if (Dexie.errnames.Constraint === (error as Error)?.name) {
        fail('KNOWLEDGE_PERSISTENCE_REVISION_CONFLICT')
      }
      fail('KNOWLEDGE_PERSISTENCE_SCHEMA_ERROR')
    }
  }

  async getByKnowledgeSnapshotId(
    knowledgeSnapshotId: KnowledgeSnapshotId,
  ): Promise<PersistedKnowledgeSnapshot> {
    const record = await this.database.knowledgeSnapshots.get(knowledgeSnapshotId)
    if (record === undefined) {
      fail('KNOWLEDGE_PERSISTENCE_NOT_FOUND')
    }
    return clone(record)
  }

  async listByKnowledgeSnapshotKey(
    knowledgeSnapshotKey: KnowledgeSnapshotKey,
  ): Promise<PersistedKnowledgeSnapshot[]> {
    const records = await this.database.knowledgeSnapshots
      .where('[knowledgeSnapshotKey+revision]')
      .between(
        [knowledgeSnapshotKey, Dexie.minKey],
        [knowledgeSnapshotKey, Dexie.maxKey],
      )
      .toArray()
    return clone(records)
  }

  async getLatestByKnowledgeSnapshotKey(
    knowledgeSnapshotKey: KnowledgeSnapshotKey,
  ): Promise<PersistedKnowledgeSnapshot> {
    const record = await this.database.knowledgeSnapshots
      .where('[knowledgeSnapshotKey+revision]')
      .between(
        [knowledgeSnapshotKey, Dexie.minKey],
        [knowledgeSnapshotKey, Dexie.maxKey],
      )
      .last()
    if (record === undefined) {
      fail('KNOWLEDGE_PERSISTENCE_NOT_FOUND')
    }
    return clone(record)
  }

  async exists(knowledgeSnapshotId: KnowledgeSnapshotId): Promise<boolean> {
    return (
      (await this.database.knowledgeSnapshots.get(knowledgeSnapshotId)) !==
      undefined
    )
  }
}

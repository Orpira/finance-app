import Dexie, { type Table } from 'dexie'

import type {
  SealedFinancialSnapshot,
  SealedSnapshotId,
  SnapshotKey,
  UtcInstant,
} from '../../types/financialSnapshot'
import {
  FINANCIAL_SNAPSHOT_LOCAL_SCHEMA_VERSION,
  type PersistedFinancialSnapshot,
} from '../../types/persistedFinancialSnapshot'
import { db } from '../../database/db'
import { sealCanonicalSnapshot } from './snapshotSealer'

export type FinancialSnapshotPersistenceErrorCode =
  | 'SNAPSHOT_PERSISTENCE_REVISION_CONFLICT'
  | 'SNAPSHOT_PERSISTENCE_INVALID_SUPERSEDES'
  | 'SNAPSHOT_PERSISTENCE_INTEGRITY_FAILURE'
  | 'SNAPSHOT_PERSISTENCE_NOT_FOUND'
  | 'SNAPSHOT_PERSISTENCE_SCHEMA_ERROR'

export class FinancialSnapshotPersistenceError extends Error {
  readonly code: FinancialSnapshotPersistenceErrorCode

  constructor(code: FinancialSnapshotPersistenceErrorCode) {
    super(code)
    this.name = 'FinancialSnapshotPersistenceError'
    this.code = code
  }
}

export interface FinancialSnapshotDatabase {
  readonly financialSnapshots: Table<PersistedFinancialSnapshot, SealedSnapshotId>
  transaction<T>(
    mode: 'rw',
    table: Table<PersistedFinancialSnapshot, SealedSnapshotId>,
    scope: () => Promise<T>,
  ): Promise<T>
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function assertUtcInstant(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw new FinancialSnapshotPersistenceError('SNAPSHOT_PERSISTENCE_SCHEMA_ERROR')
  }
}

async function verifyIntegrity<TEngineResult>(
  snapshot: SealedFinancialSnapshot<TEngineResult>,
): Promise<void> {
  try {
    const verified = await sealCanonicalSnapshot({
      canonicalDocument: snapshot.canonicalDocument,
      fingerprint: snapshot.fingerprint,
      snapshotKey: snapshot.identity.snapshotKey,
      revision: snapshot.revision.revision,
      revisionReasonCode: snapshot.revision.reasonCode,
      sealedAt: snapshot.sealedAt,
      ...(snapshot.revision.supersedesSnapshotId === undefined
        ? {}
        : { supersedesSnapshotId: snapshot.revision.supersedesSnapshotId }),
    })
    if (verified.identity.snapshotId !== snapshot.identity.snapshotId) {
      throw new Error('identity mismatch')
    }
  } catch {
    throw new FinancialSnapshotPersistenceError('SNAPSHOT_PERSISTENCE_INTEGRITY_FAILURE')
  }
}

export class FinancialSnapshotRepository {
  private readonly database: FinancialSnapshotDatabase

  constructor(database: FinancialSnapshotDatabase = db) {
    this.database = database
  }

  async persist<TEngineResult>(
    snapshot: SealedFinancialSnapshot<TEngineResult>,
    persistedAt: UtcInstant,
  ): Promise<PersistedFinancialSnapshot<TEngineResult>> {
    assertUtcInstant(persistedAt)
    await verifyIntegrity(snapshot)

    try {
      return await this.database.transaction(
        'rw',
        this.database.financialSnapshots,
        async () => {
          const existing = await this.database.financialSnapshots.get(
            snapshot.identity.snapshotId,
          )
          if (existing !== undefined) {
            return clone(existing) as PersistedFinancialSnapshot<TEngineResult>
          }

          const latest = await this.database.financialSnapshots
            .where('[snapshotKey+revision]')
            .between(
              [snapshot.identity.snapshotKey, Dexie.minKey],
              [snapshot.identity.snapshotKey, Dexie.maxKey],
            )
            .last()
          const revision = (latest?.revision ?? 0) + 1

          if (revision === 1) {
            if (snapshot.revision.supersedesSnapshotId !== undefined) {
              throw new FinancialSnapshotPersistenceError(
                'SNAPSHOT_PERSISTENCE_INVALID_SUPERSEDES',
              )
            }
          } else if (
            snapshot.revision.supersedesSnapshotId !== latest?.snapshotId ||
            snapshot.revision.revision !== revision
          ) {
            throw new FinancialSnapshotPersistenceError(
              'SNAPSHOT_PERSISTENCE_INVALID_SUPERSEDES',
            )
          }

          const record: PersistedFinancialSnapshot<TEngineResult> = {
            snapshotId: snapshot.identity.snapshotId,
            snapshotKey: snapshot.identity.snapshotKey,
            revision,
            revisionReasonCode: snapshot.revision.reasonCode,
            status: 'persisted',
            canonicalDocument: clone(snapshot.canonicalDocument),
            fingerprint: { ...snapshot.fingerprint },
            sealedAt: snapshot.sealedAt,
            ...(latest === undefined ? {} : { supersedesSnapshotId: latest.snapshotId }),
            persistedAt,
            localSchemaVersion: FINANCIAL_SNAPSHOT_LOCAL_SCHEMA_VERSION,
            snapshotVersion: snapshot.snapshotVersion,
            canonicalizationVersion: snapshot.canonicalizationVersion,
            engineVersion: snapshot.engineVersion,
            rulesetVersion: snapshot.rulesetVersion,
            scopeKind: snapshot.scope.kind,
            scopePeriodStart: snapshot.scope.periodStart,
            fingerprintValue: snapshot.fingerprint.value,
          }

          await this.database.financialSnapshots.add(record as PersistedFinancialSnapshot)
          return clone(record)
        },
      )
    } catch (error) {
      if (error instanceof FinancialSnapshotPersistenceError) throw error
      if (Dexie.errnames.Constraint === (error as Error)?.name) {
        throw new FinancialSnapshotPersistenceError(
          'SNAPSHOT_PERSISTENCE_REVISION_CONFLICT',
        )
      }
      throw new FinancialSnapshotPersistenceError('SNAPSHOT_PERSISTENCE_SCHEMA_ERROR')
    }
  }

  async getBySnapshotId(
    snapshotId: SealedSnapshotId,
  ): Promise<PersistedFinancialSnapshot> {
    const record = await this.database.financialSnapshots.get(snapshotId)
    if (record === undefined) {
      throw new FinancialSnapshotPersistenceError('SNAPSHOT_PERSISTENCE_NOT_FOUND')
    }
    return clone(record)
  }

  async listBySnapshotKey(snapshotKey: SnapshotKey): Promise<PersistedFinancialSnapshot[]> {
    const records = await this.database.financialSnapshots
      .where('[snapshotKey+revision]')
      .between([snapshotKey, Dexie.minKey], [snapshotKey, Dexie.maxKey])
      .toArray()
    return clone(records)
  }

  async getLatestBySnapshotKey(
    snapshotKey: SnapshotKey,
  ): Promise<PersistedFinancialSnapshot> {
    const record = await this.database.financialSnapshots
      .where('[snapshotKey+revision]')
      .between([snapshotKey, Dexie.minKey], [snapshotKey, Dexie.maxKey])
      .last()
    if (record === undefined) {
      throw new FinancialSnapshotPersistenceError('SNAPSHOT_PERSISTENCE_NOT_FOUND')
    }
    return clone(record)
  }

  async exists(snapshotId: SealedSnapshotId): Promise<boolean> {
    return (await this.database.financialSnapshots.get(snapshotId)) !== undefined
  }
}

import { db } from '../database/db'
import type {
  SeasonEconomicGoalRevision,
  SeasonPlannedEndRevision,
  SeasonRevision,
} from '../types/seasonRevision'
import { isLocalDate, SeasonGeoDomainError } from '../utils/seasonGeoValidation'

export interface ReviseSeasonPlannedEndInput {
  earningPeriodId: number
  plannedEndDate: string
  mode: 'extension' | 'correction'
  reason?: string
}

export interface ReviseSeasonGoalInput {
  earningPeriodId: number
  economicGoal: number
  reason?: string
}

async function nextSequence(earningPeriodId: number) {
  const revisions = await db.seasonRevisions
    .where('earningPeriodId')
    .equals(earningPeriodId)
    .toArray()
  return revisions.reduce((maximum, revision) => Math.max(maximum, revision.sequence), 0) + 1
}

export async function reviseSeasonPlannedEnd(
  input: ReviseSeasonPlannedEndInput,
  now = new Date(),
) {
  return db.transaction('rw', [db.earningPeriods, db.seasonRevisions], async () => {
    const season = await db.earningPeriods.get(input.earningPeriodId)
    if (!season) throw new SeasonGeoDomainError('SEASON_NOT_FOUND', 'La temporada no existe.')
    if (season.status !== 'active') throw new SeasonGeoDomainError('SEASON_CLOSED', 'La temporada está cerrada.')
    if (!isLocalDate(input.plannedEndDate) || input.plannedEndDate < season.startDate.slice(0, 10)) {
      throw new SeasonGeoDomainError('REVISION_INVALID', 'La fecha prevista no es válida.')
    }
    const previous = season.plannedEndDate?.slice(0, 10) ?? null
    if (input.mode === 'extension' && previous !== null && input.plannedEndDate <= previous) {
      throw new SeasonGeoDomainError('REVISION_INVALID', 'Una ampliación debe extender la fecha vigente.')
    }
    if (input.mode === 'correction' && !input.reason?.trim()) {
      throw new SeasonGeoDomainError('CORRECTION_REASON_REQUIRED', 'La corrección requiere un motivo.')
    }
    const recordedAt = now.toISOString()
    const revision: SeasonPlannedEndRevision = {
      earningPeriodId: input.earningPeriodId,
      sequence: await nextSequence(input.earningPeriodId),
      kind: 'planned_end_date_revised',
      source: input.mode === 'extension' ? 'user_extension' : 'user_correction',
      previousValue: previous,
      nextValue: input.plannedEndDate,
      reason: input.reason?.trim() || undefined,
      recordedAt,
    }
    const id = await db.seasonRevisions.add(revision)
    await db.earningPeriods.update(input.earningPeriodId, {
      plannedEndDate: `${input.plannedEndDate}T23:59:59.999Z`,
      updatedAt: recordedAt,
    })
    return { ...revision, id }
  })
}

export async function reviseSeasonEconomicGoal(
  input: ReviseSeasonGoalInput,
  now = new Date(),
) {
  return db.transaction('rw', [db.earningPeriods, db.seasonRevisions], async () => {
    const season = await db.earningPeriods.get(input.earningPeriodId)
    if (!season) throw new SeasonGeoDomainError('SEASON_NOT_FOUND', 'La temporada no existe.')
    if (season.status !== 'active') throw new SeasonGeoDomainError('SEASON_CLOSED', 'La temporada está cerrada.')
    if (!Number.isFinite(input.economicGoal) || input.economicGoal <= 0) {
      throw new SeasonGeoDomainError('REVISION_INVALID', 'La meta económica debe ser mayor a cero.')
    }
    const recordedAt = now.toISOString()
    const revision: SeasonEconomicGoalRevision = {
      earningPeriodId: input.earningPeriodId,
      sequence: await nextSequence(input.earningPeriodId),
      kind: 'economic_goal_revised',
      source: 'user_revision',
      previousValue: season.economicGoal ?? null,
      nextValue: input.economicGoal,
      reason: input.reason?.trim() || undefined,
      recordedAt,
    }
    const id = await db.seasonRevisions.add(revision)
    await db.earningPeriods.update(input.earningPeriodId, {
      economicGoal: input.economicGoal,
      updatedAt: recordedAt,
    })
    return { ...revision, id }
  })
}

export async function listSeasonRevisions(earningPeriodId: number): Promise<SeasonRevision[]> {
  const revisions = await db.seasonRevisions.where('earningPeriodId').equals(earningPeriodId).toArray()
  return revisions.sort((left, right) => left.sequence - right.sequence)
}

export async function getSeasonGoalHistory(earningPeriodId: number) {
  const all = await listSeasonRevisions(earningPeriodId)
  const revisions = all
    .filter((revision): revision is SeasonEconomicGoalRevision => revision.kind === 'economic_goal_revised')
  const baseline = all
    .find((revision) => revision.kind === 'migration_baseline')
  const baselineGoal = baseline?.kind === 'migration_baseline' ? baseline.nextValue.economicGoal : undefined
  return {
    original: baselineGoal ?? revisions[0]?.nextValue,
    current: revisions.at(-1)?.nextValue ?? baselineGoal,
    revisions,
    baselineSource: baselineGoal === undefined ? 'season_creation' as const : 'migration_baseline' as const,
  }
}

export async function getSeasonPlannedEndHistory(earningPeriodId: number) {
  const all = await listSeasonRevisions(earningPeriodId)
  const revisions = all.filter(
    (revision): revision is SeasonPlannedEndRevision => revision.kind === 'planned_end_date_revised',
  )
  const baseline = all.find((revision) => revision.kind === 'migration_baseline')
  const baselineDate = baseline?.kind === 'migration_baseline' ? baseline.nextValue.plannedEndDate : undefined
  return {
    original: baselineDate ?? revisions[0]?.nextValue,
    current: revisions.at(-1)?.nextValue ?? baselineDate,
    revisions,
    baselineSource: baselineDate === undefined ? 'season_creation' as const : 'migration_baseline' as const,
  }
}

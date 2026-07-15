import type { CanonicalSnapshotDocument } from '../../types/financialSnapshot'
import { isCanonicalizationVersionV2 } from './snapshotProtocol'

export type SnapshotChangedPathType =
  | 'added'
  | 'removed'
  | 'changed'
  | 'array-order'
  | 'array-length'

export type SnapshotChangedPathClassification =
  | 'financial'
  | 'scope'
  | 'evidence'
  | 'rule'
  | 'version'
  | 'quality'
  | 'operational-leak'
  | 'unknown'

export type SnapshotDiffCode =
  | 'diff.none'
  | 'version.incompatible'
  | 'material.financial'
  | 'material.scope'
  | 'material.evidence'
  | 'material.rule'
  | 'material.version'
  | 'material.quality'
  | 'material.operational-leak'
  | 'material.unknown'

export interface SnapshotChangedPath {
  readonly path: string
  readonly changeType: SnapshotChangedPathType
  readonly classification: SnapshotChangedPathClassification
}

export interface SnapshotMaterialDiffAudit {
  readonly equivalent: boolean
  readonly previousCanonicalizationVersion: string
  readonly currentCanonicalizationVersion: string
  readonly changedPaths: readonly SnapshotChangedPath[]
  readonly summaryCodes: readonly SnapshotDiffCode[]
}

const OPERATIONAL_LEAK_KEYS = new Set([
  'generatedAt',
  'sourceScopeAsOf',
  'sealedAt',
  'persistedAt',
  'candidateId',
  'executionId',
  'asOf',
  'renderAsOf',
  'renderedAt',
  'timestamp',
])

function isObject(value: unknown): value is { readonly [key: string]: unknown } {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stableToken(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `s:${value}`
  if (typeof value === 'number') return Number.isFinite(value) ? `n:${value}` : 'n:non-finite'
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0'
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableToken(item)).join(',')}]`
  }
  if (isObject(value)) {
    const parts = Object.keys(value)
      .sort()
      .map((key) => `${key}:${stableToken(value[key])}`)
    return `{${parts.join(',')}}`
  }
  return `u:${String(value)}`
}

function arraysMatchAsMultiset(previous: readonly unknown[], current: readonly unknown[]): boolean {
  if (previous.length !== current.length) return false
  const counts = new Map<string, number>()
  for (const item of previous) {
    const key = stableToken(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const item of current) {
    const key = stableToken(item)
    const count = counts.get(key)
    if (count === undefined) return false
    if (count === 1) {
      counts.delete(key)
    } else {
      counts.set(key, count - 1)
    }
  }
  return counts.size === 0
}

function classifyPath(path: string): SnapshotChangedPathClassification {
  const normalizedPath = path.replace(/\[\d+\]/g, '')
  const segments = normalizedPath.split('.').filter((segment) => segment.length > 0)
  const last = segments.at(-1) ?? ''
  const inPayload = segments[0] === 'payload'

  if (inPayload && OPERATIONAL_LEAK_KEYS.has(last)) {
    return 'operational-leak'
  }
  if (normalizedPath === 'canonicalizationVersion' || normalizedPath === 'payload.snapshotVersion') {
    return 'version'
  }
  if (normalizedPath.startsWith('payload.scope')) {
    return 'scope'
  }
  if (normalizedPath.startsWith('payload.evidence')) {
    return 'evidence'
  }
  if (
    normalizedPath.startsWith('payload.appliedRules') ||
    normalizedPath === 'payload.engineVersion' ||
    normalizedPath === 'payload.rulesetVersion'
  ) {
    return 'rule'
  }
  if (
    normalizedPath.startsWith('payload.metadata.warningCodes') ||
    normalizedPath.startsWith('payload.metadata.qualityCodes') ||
    normalizedPath.startsWith('payload.metadata.limitationCodes') ||
    normalizedPath.startsWith('payload.evidence.warningCodes') ||
    normalizedPath.startsWith('payload.evidence.coverageCodes')
  ) {
    return 'quality'
  }
  if (normalizedPath.startsWith('payload.engineResult')) {
    return 'financial'
  }
  return 'unknown'
}

function pushChange(
  changed: SnapshotChangedPath[],
  path: string,
  changeType: SnapshotChangedPathType,
): void {
  changed.push({
    path,
    changeType,
    classification: classifyPath(path),
  })
}

function diffValues(
  previous: unknown,
  current: unknown,
  path: string,
  changed: SnapshotChangedPath[],
): void {
  if (Object.is(previous, current)) {
    return
  }

  if (Array.isArray(previous) && Array.isArray(current)) {
    if (previous.length !== current.length) {
      pushChange(changed, path, 'array-length')
    }
    const sameOrderedValues =
      previous.length === current.length &&
      previous.every((item, index) => stableToken(item) === stableToken(current[index]))
    if (sameOrderedValues) {
      return
    }
    if (previous.length === current.length && arraysMatchAsMultiset(previous, current)) {
      pushChange(changed, path, 'array-order')
      return
    }

    const common = Math.min(previous.length, current.length)
    for (let index = 0; index < common; index += 1) {
      diffValues(previous[index], current[index], `${path}[${index}]`, changed)
    }
    for (let index = common; index < previous.length; index += 1) {
      pushChange(changed, `${path}[${index}]`, 'removed')
    }
    for (let index = common; index < current.length; index += 1) {
      pushChange(changed, `${path}[${index}]`, 'added')
    }
    return
  }

  if (isObject(previous) && isObject(current)) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(current)])
    for (const key of [...keys].sort()) {
      const nextPath = path.length === 0 ? key : `${path}.${key}`
      const inPrevious = Object.prototype.hasOwnProperty.call(previous, key)
      const inCurrent = Object.prototype.hasOwnProperty.call(current, key)
      if (!inPrevious && inCurrent) {
        pushChange(changed, nextPath, 'added')
        continue
      }
      if (inPrevious && !inCurrent) {
        pushChange(changed, nextPath, 'removed')
        continue
      }
      diffValues(previous[key], current[key], nextPath, changed)
    }
    return
  }

  pushChange(changed, path, 'changed')
}

function dedupeAndSortChanges(changed: readonly SnapshotChangedPath[]): readonly SnapshotChangedPath[] {
  const map = new Map<string, SnapshotChangedPath>()
  for (const item of changed) {
    const key = `${item.path}|${item.changeType}|${item.classification}`
    map.set(key, item)
  }
  return [...map.values()].sort((first, second) => {
    if (first.path < second.path) return -1
    if (first.path > second.path) return 1
    if (first.changeType < second.changeType) return -1
    if (first.changeType > second.changeType) return 1
    if (first.classification < second.classification) return -1
    if (first.classification > second.classification) return 1
    return 0
  })
}

function summarize(changed: readonly SnapshotChangedPath[], versionIncompatible: boolean): readonly SnapshotDiffCode[] {
  if (versionIncompatible) {
    return ['version.incompatible']
  }
  if (changed.length === 0) {
    return ['diff.none']
  }

  const result = new Set<SnapshotDiffCode>()
  for (const item of changed) {
    if (item.classification === 'financial') result.add('material.financial')
    else if (item.classification === 'scope') result.add('material.scope')
    else if (item.classification === 'evidence') result.add('material.evidence')
    else if (item.classification === 'rule') result.add('material.rule')
    else if (item.classification === 'version') result.add('material.version')
    else if (item.classification === 'quality') result.add('material.quality')
    else if (item.classification === 'operational-leak') result.add('material.operational-leak')
    else result.add('material.unknown')
  }
  return [...result].sort()
}

function isMaterialPath(path: string): boolean {
  return path === 'canonicalizationVersion' || path.startsWith('payload')
}

export function auditCanonicalSnapshotMaterialDiff(
  previousDocument: CanonicalSnapshotDocument<unknown>,
  currentDocument: CanonicalSnapshotDocument<unknown>,
): SnapshotMaterialDiffAudit {
  const previousVersion = previousDocument.canonicalizationVersion
  const currentVersion = currentDocument.canonicalizationVersion
  const versionIncompatible = !isCanonicalizationVersionV2(previousVersion) ||
    !isCanonicalizationVersionV2(currentVersion)

  if (versionIncompatible) {
    return {
      equivalent: false,
      previousCanonicalizationVersion: previousVersion,
      currentCanonicalizationVersion: currentVersion,
      changedPaths: [{
        path: 'canonicalizationVersion',
        changeType: 'changed',
        classification: 'version',
      }],
      summaryCodes: ['version.incompatible'],
    }
  }

  const changed: SnapshotChangedPath[] = []
  diffValues(previousDocument, currentDocument, '', changed)
  const changedPaths = dedupeAndSortChanges(changed)
  const materialChangedPaths = changedPaths.filter((item) => isMaterialPath(item.path))

  return {
    equivalent: materialChangedPaths.length === 0,
    previousCanonicalizationVersion: previousVersion,
    currentCanonicalizationVersion: currentVersion,
    changedPaths,
    summaryCodes: summarize(materialChangedPaths, false),
  }
}
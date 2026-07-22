import type {
  ValidationIssue,
  ValidationIssueCode,
} from './validationIssue'

export type ValidationReportStatus = 'valid' | 'invalid'

export interface ValidationReport {
  readonly status: ValidationReportStatus
  readonly failClosed: true
  readonly deterministic: true
  readonly issueCount: number
  readonly issues: readonly ValidationIssue[]
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1
  }
  if (left > right) {
    return 1
  }
  return 0
}

function compareIssues(left: ValidationIssue, right: ValidationIssue): number {
  const byCode = compareStrings(left.code, right.code)
  if (byCode !== 0) {
    return byCode
  }

  const byPath = compareStrings(left.path, right.path)
  if (byPath !== 0) {
    return byPath
  }

  return compareStrings(left.message, right.message)
}

function deduplicateIssues(issues: readonly ValidationIssue[]): ValidationIssue[] {
  const seen = new Set<string>()
  const unique: ValidationIssue[] = []

  for (const issue of issues) {
    const key = `${issue.code}|${issue.path}|${issue.message}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    unique.push(issue)
  }

  return unique
}

function buildFailClosedIssue(): ValidationIssue {
  return {
    code: 'INSIGHT_VALIDATION_FAIL_CLOSED',
    path: 'collection',
    message: 'validation blocked by fail-closed policy',
  }
}

function hasIssueCode(
  issues: readonly ValidationIssue[],
  code: ValidationIssueCode,
): boolean {
  return issues.some((issue) => issue.code === code)
}

export function createValidationReport(
  issues: readonly ValidationIssue[],
): ValidationReport {
  const deduplicated = deduplicateIssues(issues)
  const normalizedIssues = [...deduplicated]

  if (
    normalizedIssues.length > 0 &&
    !hasIssueCode(normalizedIssues, 'INSIGHT_VALIDATION_FAIL_CLOSED')
  ) {
    normalizedIssues.push(buildFailClosedIssue())
  }

  normalizedIssues.sort(compareIssues)

  const status: ValidationReportStatus =
    normalizedIssues.length === 0 ? 'valid' : 'invalid'

  return {
    status,
    failClosed: true,
    deterministic: true,
    issueCount: normalizedIssues.length,
    issues: normalizedIssues,
  }
}
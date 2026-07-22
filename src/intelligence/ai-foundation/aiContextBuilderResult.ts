import type {
  AIContextBuildFailure,
  AIContextBuildResult,
  AIContextBuildSuccess,
} from './aiContextBuilderContracts'

export function isAIContextBuildSuccess(
  result: AIContextBuildResult,
): result is AIContextBuildSuccess {
  return result.ok === true
}

export function isAIContextBuildFailure(
  result: AIContextBuildResult,
): result is AIContextBuildFailure {
  return result.ok === false
}

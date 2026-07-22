import type {
  AIContextBuildRequest,
  AIContextBuildResult,
  ContextSourceResolverPort,
} from './aiContextBuilderContracts'

export interface AIContextBuilderDependencies {
  readonly resolver?: ContextSourceResolverPort
}

export interface AIContextBuilderPort {
  buildContext(
    request: AIContextBuildRequest | null | undefined,
  ): AIContextBuildResult
}

import type { InsightRuleDescriptor } from '../types/insightRule'
import type { KnowledgeCollection } from '../types/knowledgeLayer'
import type { BuildInsightCollectionInput } from './interfaces'
import type { InsightRepository } from './repositoryInterfaces'
import type { InsightBuildResult } from './types'
import type { InsightEngineResult } from './engineResult'
import type { ValidateInsightCollectionInput } from './insightValidator'
import type { ValidationReport } from './validationReport'

export interface InsightEngineBuilderPort {
  build(input: BuildInsightCollectionInput): InsightBuildResult
}

export interface InsightEngineValidatorPort {
  validate(input: ValidateInsightCollectionInput): ValidationReport
}

export interface InsightEngineDependencies {
  readonly builder: InsightEngineBuilderPort
  readonly validator: InsightEngineValidatorPort
}

export interface RunInsightEngineInput {
  readonly knowledgeCollection: KnowledgeCollection
  readonly rules: readonly InsightRuleDescriptor[]
  readonly repository: InsightRepository
}

export interface InsightEngine {
  run(input: RunInsightEngineInput): InsightEngineResult
}
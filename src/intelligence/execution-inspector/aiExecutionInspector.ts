import {
  AI_EXECUTION_STAGE_NAMES,
  type AIExecutionInspector,
  type AIExecutionSnapshot,
  type AIExecutionStage,
  type AIExecutionTrace,
} from './aiExecutionInspectorContracts'
import {
  createSnapshot,
  createStage,
  createTrace,
} from './aiExecutionInspectorFactory'

function cloneTrace(trace: AIExecutionTrace | null): AIExecutionTrace | null {
  return trace === null ? null : structuredClone(trace)
}

function createPendingSnapshot(createdAt: string): AIExecutionSnapshot {
  const snapshotResult = createSnapshot({ createdAt })
  if (snapshotResult.kind === 'failure') {
    throw new Error(snapshotResult.safeMessage)
  }

  return snapshotResult.snapshot
}

function createPendingStages(startedAt: string): readonly AIExecutionStage[] {
  return AI_EXECUTION_STAGE_NAMES.map((name) => {
    const stageResult = createStage({
      name,
      status: 'PENDING',
      startedAt: null,
      finishedAt: null,
      duration: 0,
      snapshot: createPendingSnapshot(startedAt),
    })

    if (stageResult.kind === 'failure') {
      throw new Error(stageResult.safeMessage)
    }

    return stageResult.stage
  })
}

export function createAIExecutionInspector(): AIExecutionInspector {
  let currentTrace: AIExecutionTrace | null = null

  return {
    beginTrace(input) {
      try {
        const traceResult = createTrace({
          id: input.id,
          startedAt: input.startedAt,
          stages: createPendingStages(input.startedAt),
          metadata: {
            status: 'RUNNING',
            conversationId: input.metadata.conversationId,
            sessionId: input.metadata.sessionId,
            providerId: input.metadata.providerId,
            model: input.metadata.model,
            ...(input.metadata.tags === undefined ? {} : { tags: [...input.metadata.tags] }),
            ...(input.metadata.attributes === undefined
              ? {}
              : { attributes: structuredClone(input.metadata.attributes) }),
          },
        })

        currentTrace = traceResult.kind === 'success' ? traceResult.trace : null
      } catch {
        currentTrace = null
      }
    },

    captureStage(input) {
      if (currentTrace === null) {
        return
      }

      try {
        const snapshotResult = createSnapshot(input.snapshot)
        if (snapshotResult.kind === 'failure') {
          return
        }

        const stageResult = createStage({
          name: input.name,
          status: input.status,
          startedAt: input.startedAt,
          finishedAt: input.finishedAt,
          duration: input.duration,
          snapshot: snapshotResult.snapshot,
        })
        if (stageResult.kind === 'failure') {
          return
        }

        const stages = currentTrace.stages.map((stage) =>
          stage.name === input.name ? stageResult.stage : stage,
        )
        const traceResult = createTrace({
          id: currentTrace.id,
          startedAt: currentTrace.startedAt,
          finishedAt: currentTrace.finishedAt,
          stages,
          metadata: {
            status: currentTrace.metadata.status,
            conversationId: currentTrace.metadata.conversationId,
            sessionId: currentTrace.metadata.sessionId,
            providerId: currentTrace.metadata.providerId,
            model: currentTrace.metadata.model,
            ...(currentTrace.metadata.tags === undefined ? {} : { tags: [...currentTrace.metadata.tags] }),
            ...(currentTrace.metadata.attributes === undefined
              ? {}
              : { attributes: structuredClone(currentTrace.metadata.attributes) }),
          },
        })

        if (traceResult.kind === 'success') {
          currentTrace = traceResult.trace
        }
      } catch {
        return
      }
    },

    finishTrace(input) {
      if (currentTrace === null) {
        return
      }

      try {
        const completedStages = currentTrace.stages.map((stage) => {
          if (stage.status !== 'PENDING') {
            return stage
          }

          const skippedStage = createStage({
            name: stage.name,
            status: 'SKIPPED',
            startedAt: input.finishedAt,
            finishedAt: input.finishedAt,
            duration: 0,
            snapshot: stage.snapshot,
          })

          return skippedStage.kind === 'success' ? skippedStage.stage : stage
        })

        const traceResult = createTrace({
          id: currentTrace.id,
          startedAt: currentTrace.startedAt,
          finishedAt: input.finishedAt,
          stages: completedStages,
          metadata: {
            status: input.status,
            conversationId: currentTrace.metadata.conversationId,
            sessionId: currentTrace.metadata.sessionId,
            providerId: currentTrace.metadata.providerId,
            model: currentTrace.metadata.model,
            ...(currentTrace.metadata.tags === undefined ? {} : { tags: [...currentTrace.metadata.tags] }),
            ...(currentTrace.metadata.attributes === undefined
              ? {}
              : { attributes: structuredClone(currentTrace.metadata.attributes) }),
          },
        })

        if (traceResult.kind === 'success') {
          currentTrace = traceResult.trace
        }
      } catch {
        return
      }
    },

    exportTrace() {
      return cloneTrace(currentTrace)
    },
  }
}

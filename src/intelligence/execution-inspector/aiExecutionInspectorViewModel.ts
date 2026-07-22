import type {
  AIExecutionInspectorViewModel,
  AIExecutionSnapshot,
  AIExecutionStageName,
  AIExecutionTrace,
} from './aiExecutionInspectorContracts'

function stageLabel(name: AIExecutionStageName): string {
  switch (name) {
    case 'CONTEXT_BUILD':
      return 'Context Builder'
    case 'CONTEXT_RESOLUTION':
      return 'Context Resolution'
    case 'PROMPT_BUILD':
      return 'Prompt Builder'
    case 'PROVIDER_REQUEST':
      return 'Provider Request'
    case 'PROVIDER_RESPONSE':
      return 'Provider Response'
    case 'ASSISTANT_MESSAGE':
      return 'Assistant Message'
    case 'CONVERSATION_UPDATE':
      return 'Conversation Update'
  }
}

function formatDuration(duration: number): string {
  return `${duration} ms`
}

function snapshotSections(snapshot: AIExecutionSnapshot) {
  const sections: Array<{ label: string; json: string }> = []

  if (snapshot.executionRequest) {
    sections.push({ label: 'Execution Request', json: JSON.stringify(snapshot.executionRequest, null, 2) })
  }
  if (snapshot.context) {
    sections.push({ label: 'AIContext', json: JSON.stringify(snapshot.context, null, 2) })
  }
  if (snapshot.resolvedContext) {
    sections.push({ label: 'AIResolvedContext', json: JSON.stringify(snapshot.resolvedContext, null, 2) })
  }
  if (snapshot.prompt) {
    sections.push({ label: 'AIPrompt', json: JSON.stringify(snapshot.prompt, null, 2) })
  }
  if (snapshot.providerRequest) {
    sections.push({ label: 'AIProviderRequest', json: JSON.stringify(snapshot.providerRequest, null, 2) })
  }
  if (snapshot.providerResponse) {
    sections.push({ label: 'AIProviderResponse', json: JSON.stringify(snapshot.providerResponse, null, 2) })
  }
  if (snapshot.assistantMessage) {
    sections.push({ label: 'Assistant Message', json: JSON.stringify(snapshot.assistantMessage, null, 2) })
  }
  if (snapshot.session) {
    sections.push({ label: 'Updated Session', json: JSON.stringify(snapshot.session, null, 2) })
  }
  if (snapshot.failure) {
    sections.push({ label: 'Failure', json: JSON.stringify(snapshot.failure, null, 2) })
  }

  if (sections.length === 0) {
    sections.push({ label: 'Snapshot', json: JSON.stringify({ empty: true }, null, 2) })
  }

  return sections
}

export function createAIExecutionInspectorViewModel(
  trace: AIExecutionTrace | null,
): AIExecutionInspectorViewModel | null {
  if (trace === null) {
    return null
  }

  return {
    traceId: trace.id,
    status: trace.metadata.status,
    startedAt: trace.startedAt,
    finishedAt: trace.finishedAt,
    totalDurationLabel: trace.finishedAt === null
      ? 'En curso'
      : formatDuration(
        Math.max(0, new Date(trace.finishedAt).getTime() - new Date(trace.startedAt).getTime()),
      ),
    stages: trace.stages.map((stage) => ({
      key: stage.name,
      label: stageLabel(stage.name),
      status: stage.status,
      durationLabel: formatDuration(stage.duration),
      startedAt: stage.startedAt,
      finishedAt: stage.finishedAt,
      sections: snapshotSections(stage.snapshot),
    })),
  }
}

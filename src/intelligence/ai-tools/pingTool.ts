import type {
  AITool,
} from './aiToolContracts'

export function createPingTool(): AITool {
  return {
    definition: {
      name: 'ping',
      description: 'Connectivity demo tool that returns PONG.',
      permission: 'read-only',
      deterministic: true,
      failClosed: true,
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
      outputSchema: {
        type: 'string',
        enum: ['PONG'],
      },
      tags: ['demo', 'tool-calling', 'ping'],
    },
    async execute() {
      return {
        kind: 'success',
        value: {
        toolName: 'ping',
        output: 'PONG',
        permission: 'read-only',
        durationMs: 0,
        },
      }
    },
  }
}

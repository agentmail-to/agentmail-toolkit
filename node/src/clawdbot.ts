import type { AgentTool } from '@mariozechner/pi-agent-core'
import type { TSchema } from '@sinclair/typebox'
import { toJSONSchema } from 'zod'

import { ListToolkit } from './toolkit.js'
import type { Tool } from './tools.js'
import { errorMessage } from './util.js'

/** Convert Zod schema to JSON Schema, handling Date types as ISO datetime strings */
function zodToJSONSchema(tool: Tool) {
    return toJSONSchema(tool.paramsSchema, {
        unrepresentable: 'any',
        override: (ctx) => {
            const def = ctx.zodSchema._zod.def
            if (def.type === 'date') {
                ctx.jsonSchema.type = 'string'
                ctx.jsonSchema.format = 'date-time'
            }
        },
    }) as unknown as TSchema
}

export class AgentMailToolkit extends ListToolkit<AgentTool> {
    protected buildTool(tool: Tool): AgentTool {
        return {
            name: tool.name,
            label: tool.name,
            description: tool.description,
            parameters: zodToJSONSchema(tool),
            execute: async (_toolCallId, args) => {
                try {
                    const result = await tool.func(this.client, tool.paramsSchema.parse(args))
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result) }],
                        details: result,
                    }
                } catch (err) {
                    // pi-agent-core's agent loop catches a thrown exception from
                    // `execute()` and derives `isError: true` from it, using the
                    // exception's message as the tool result text (agent-loop.js
                    // executeToolCalls) - previously this threw the raw SDK error
                    // uncaught with no formatting at all. Rethrow a concise message
                    // instead of the SDK's verbose dump.
                    throw new Error(errorMessage(err))
                }
            },
        }
    }
}

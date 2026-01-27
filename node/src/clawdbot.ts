import type { AgentTool } from '@mariozechner/pi-agent-core'
import type { TSchema } from '@sinclair/typebox'
import { toJSONSchema } from 'zod'

import { ListToolkit } from './toolkit.js'
import type { Tool } from './tools.js'

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
                const response = await tool.func(this.client, tool.paramsSchema.parse(args))
                return {
                    content: [{ type: 'text', text: JSON.stringify(response) }],
                    details: response,
                }
            },
        }
    }
}

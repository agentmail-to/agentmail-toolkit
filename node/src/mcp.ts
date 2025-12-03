import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

import { ListToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { safeFunc } from './util.js'

interface McpTool {
    name: string
    title: string
    description: string
    inputSchema: z.ZodRawShape
    cb: (args: Record<string, unknown>) => Promise<CallToolResult>
}

export class AgentMailToolkit extends ListToolkit<McpTool> {
    protected buildTool(tool: Tool): McpTool {
        return {
            name: tool.name,
            title: tool.name
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            description: tool.description,
            inputSchema: tool.params_schema.shape,
            cb: async (args) => {
                const { isError, result } = await safeFunc(tool.func, this.client, args)
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError }
            },
        }
    }
}

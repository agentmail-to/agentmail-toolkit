import { type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ZodRawShape } from 'zod'

import { ListToolkit } from './toolkit'
import { type Tool } from './tools'

interface McpTool {
    name: string
    description: string
    paramsSchema: ZodRawShape
    callback: ToolCallback<ZodRawShape>
}

export class AgentMailToolkit extends ListToolkit<McpTool> {
    protected buildTool(tool: Tool): McpTool {
        return {
            name: tool.name,
            description: tool.description,
            paramsSchema: tool.schema.shape,
            callback: async (args) => {
                const { isError, result } = await this.safeCall(tool.method, args)
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError }
            },
        }
    }
}

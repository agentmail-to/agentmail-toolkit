import { type Tool as McpTool } from '@modelcontextprotocol/sdk/types.js'
import { type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'

import { ListToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { safeFunc } from './util.js'

export class AgentMailToolkit extends ListToolkit<McpTool> {
    protected buildTool(tool: Tool): McpTool & { callback: ToolCallback } {
        return {
            name: tool.name,
            title: tool.name
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' '),
            description: tool.description,
            inputSchema: tool.paramsSchema.shape,
            callback: async (args) => {
                const { isError, result } = await safeFunc(tool.func, this.client, args)
                return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], isError }
            },
        }
    }
}

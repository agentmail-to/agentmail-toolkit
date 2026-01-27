import { z } from 'zod'
import { type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

import { ListToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { safeFunc } from './util.js'

interface McpTool {
    name: string
    title: string
    description: string
    inputSchema: z.ZodRawShape
    callback: ToolCallback<z.ZodRawShape>
    annotations?: ToolAnnotations
}

export class AgentMailToolkit extends ListToolkit<McpTool> {
    protected buildTool(tool: Tool): McpTool {
        const title = tool.name
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')

        return {
            name: tool.name,
            title,
            description: tool.description,
            inputSchema: tool.paramsSchema.shape,
            callback: async (args) => {
                const { isError, result } = await safeFunc(tool.func, this.client, args)
                return {
                    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
                    structuredContent: result,
                    isError,
                }
            },
            annotations: { title, ...tool.annotations },
        }
    }
}

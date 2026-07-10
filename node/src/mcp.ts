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
        return {
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.paramsSchema.shape,
            callback: async (args) => {
                const { isError, result, statusCode, body } = await safeFunc(tool.func, this.client, args)
                if (isError) {
                    // Errors are returned as isError tool results (HTTP 200), so they never
                    // reach the host's error logs on their own. Log here, at the real catch
                    // site, so failures are actually observable.
                    console.error('[agentmail-toolkit] tool error', {
                        tool: tool.name,
                        statusCode,
                        body: typeof body === 'string' ? body.slice(0, 500) : body,
                    })
                }
                const text = result === undefined ? 'OK' : JSON.stringify(result)
                return {
                    content: [{ type: 'text' as const, text }],
                    isError,
                }
            },
            annotations: tool.annotations,
        }
    }
}

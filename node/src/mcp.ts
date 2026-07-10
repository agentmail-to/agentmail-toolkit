import { z } from 'zod'
import { type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

import { ListToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { safeFunc, normalize, truncateForLog } from './util.js'

interface McpTool {
    name: string
    title: string
    description: string
    inputSchema: z.ZodRawShape
    outputSchema: z.ZodRawShape
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
            outputSchema: tool.outputSchema.shape,
            callback: async (args) => {
                const { isError, result, statusCode, body } = await safeFunc(tool.func, this.client, args)
                if (isError) {
                    // Errors are returned as isError tool results (HTTP 200), so they never
                    // reach the host's error logs on their own. Log here, at the real catch
                    // site, so failures are actually observable. Error results are never
                    // validated against outputSchema - the MCP SDK itself skips output
                    // validation when isError is true, so we don't either.
                    console.error('[agentmail-toolkit] tool error', {
                        tool: tool.name,
                        statusCode,
                        body: truncateForLog(body),
                    })
                    return {
                        content: [{ type: 'text' as const, text: String(result) }],
                        isError: true,
                    }
                }

                // JSON-safe the result (Date -> ISO string) and validate it against the
                // tool's own output schema before returning structuredContent. Schema
                // drift (a func/schema mismatch) must fail visibly rather than silently
                // handing the client malformed structured content.
                const structuredContent = normalize(result) as Record<string, unknown>
                const parsed = tool.outputSchema.safeParse(structuredContent)
                if (!parsed.success) {
                    console.error('[agentmail-toolkit] output schema mismatch', {
                        tool: tool.name,
                        issues: parsed.error.issues,
                    })
                    return {
                        content: [{ type: 'text' as const, text: `Internal error: ${tool.name} result did not match its declared output schema` }],
                        isError: true,
                    }
                }

                // Backwards compatibility: also serialize the same structuredContent as text.
                const text = JSON.stringify(structuredContent)
                return {
                    structuredContent,
                    content: [{ type: 'text' as const, text }],
                    isError: false,
                }
            },
            annotations: tool.annotations,
        }
    }
}

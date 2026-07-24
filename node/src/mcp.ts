import { z } from 'zod'
import { type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ToolAnnotations, type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type AgentMailClient } from 'agentmail'

import { ListToolkit } from './toolkit.js'
import { type Tool, tools } from './tools.js'
import { safeFunc, normalize, truncateForLog } from './util.js'

interface McpTool {
    name: string
    title: string
    description: string
    inputSchema: z.ZodObject
    outputSchema: z.ZodRawShape
    callback: ToolCallback<z.ZodObject>
    annotations?: ToolAnnotations
}

// Name -> Tool, built once at module load. Lets `invoke` dispatch by name without
// reconstructing the whole tool set per call.
const toolsByName: ReadonlyMap<string, Tool> = new Map(tools.map((tool) => [tool.name, tool]))

// Execute one tool's func with an explicit client and shape the outcome as an MCP
// CallToolResult. Shared by the per-instance `callback` (client bound at
// construction) and `invoke` (client supplied per call) so both paths behave
// identically - the client is the only thing that differs between them.
async function runTool(
    tool: Tool,
    client: AgentMailClient,
    args: Record<string, unknown>
): Promise<CallToolResult> {
    const { isError, result, statusCode, body } = await safeFunc(tool.func, client, args)
    if (isError) {
        // Errors are returned as isError tool results (HTTP 200), so they never
        // reach the host's error logs on their own. Log here, at the real catch
        // site, so failures are actually observable. Error results are never
        // validated against outputSchema - the MCP SDK itself skips output
        // validation when isError is true, so we don't either.
        console.error('[agentmail-toolkit] tool error', {
            tool: tool.name,
            error: truncateForLog(result),
            statusCode,
            body: truncateForLog(body),
        })
        const publicMessage = statusCode ? `AgentMail request failed (HTTP ${statusCode})` : 'AgentMail request failed'
        return {
            content: [{ type: 'text' as const, text: publicMessage }],
            isError: true,
        }
    }

    // JSON-safe the result (Date -> ISO string) and validate it against the
    // tool's own output schema before returning structuredContent. Schema
    // drift (a func/schema mismatch) must fail visibly rather than silently
    // handing the client malformed structured content.
    //
    // Parse in strip mode: the MCP SDK reconstructs a plain z.object from the
    // raw shape we register and advertises it to clients with a strict
    // (additionalProperties: false) root, so stripping keeps structuredContent
    // conformant with that ADVERTISED schema. The output schemas are plain
    // z.object at every nesting level (see output-schemas.ts), so this parse
    // also drops undeclared NESTED fields — the SDK passes through unrecognized
    // API keys (organization_id, pod_id, debug data), and they must never reach
    // the model (OpenAI app review data-minimization requirement).
    const parsed = z.object(tool.outputSchema.shape).safeParse(normalize(result))
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
    const structuredContent = parsed.data as Record<string, unknown>
    const text = JSON.stringify(structuredContent)
    return {
        structuredContent,
        content: [{ type: 'text' as const, text }],
        isError: false,
    }
}

export class AgentMailToolkit extends ListToolkit<McpTool> {
    protected buildTool(tool: Tool): McpTool {
        return {
            name: tool.name,
            title: tool.title,
            description: tool.description,
            // Pass the complete object so the MCP SDK preserves root behavior such
            // as ReplyToMessageParams.strict(), instead of rebuilding a strip-mode
            // object from `.shape`.
            inputSchema: tool.paramsSchema,
            outputSchema: tool.outputSchema.shape,
            callback: async (args) => runTool(tool, this.client, args as Record<string, unknown>),
            annotations: tool.annotations,
        }
    }

    /**
     * Invoke a tool by name with a per-call client, bypassing the client bound
     * at construction, and return the same MCP CallToolResult a tools/call
     * would.
     *
     * This lets a host that serves many users (e.g. a hosted MCP server) build
     * the toolkit ONCE and hand each request its own client, instead of
     * constructing a fresh toolkit per request and again per tool call - which,
     * under long-lived/streaming connections, retains a per-call object graph
     * and drives heap growth.
     *
     * An unknown tool name or invalid arguments return an isError result rather
     * than throwing, so bad input can never crash the caller. Unlike a registered
     * tools/call callback, this path bypasses the MCP SDK's input validation, so
     * it parses once here before dispatch.
     */
    async invoke(
        name: string,
        client: AgentMailClient,
        args: Record<string, unknown>
    ): Promise<CallToolResult> {
        const tool = toolsByName.get(name)
        if (!tool) {
            return {
                content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
                isError: true,
            }
        }
        const parsed = tool.paramsSchema.safeParse(args)
        if (!parsed.success) {
            return {
                content: [{ type: 'text' as const, text: `Invalid arguments for tool: ${name}` }],
                isError: true,
            }
        }
        return runTool(tool, client, parsed.data)
    }
}

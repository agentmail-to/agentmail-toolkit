import { z } from 'zod'
import { type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type ToolAnnotations, type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type AgentMailClient } from 'agentmail'

import { ListToolkit } from './toolkit.js'
import { type Tool, tools } from './tools.js'
import { safeFunc, normalize, consoleLogger, type ToolCallOptions, type ToolkitLogger } from './util.js'

export { type ToolCallOptions, type ToolkitLogEvent, type ToolkitLogger } from './util.js'

interface McpTool {
    name: string
    title: string
    description: string
    inputSchema: z.ZodRawShape
    outputSchema: z.ZodRawShape
    callback: ToolCallback<z.ZodRawShape>
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
    args: Record<string, unknown>,
    options: ToolCallOptions = {}
): Promise<CallToolResult> {
    const logger = options.logger ?? consoleLogger
    // The MCP SDK validates tools/call args against a plain z.object it rebuilds
    // from the raw shape we register, which drops root-level refinements (e.g.
    // ReplyToMessageParams' replyAll/to exclusivity). Re-parse with the tool's own
    // schema so those cross-field rules are enforced before the func runs.
    //
    // normalize() first: the SDK's parse has already run the shape's coerce pipes,
    // so date filters (before/after/sendAt: z.string().pipe(z.coerce.date())) arrive
    // as Date objects, which z.string() would reject on a second parse. normalize
    // converts Date back to ISO string, making the re-parse a true round-trip. On
    // the invoke() path args are raw JSON and normalize is a no-op.
    const preflight = tool.paramsSchema.safeParse(normalize(args))
    if (!preflight.success) {
        const message = preflight.error.issues.map((issue) => issue.message).join('; ')
        return {
            content: [{ type: 'text' as const, text: `Invalid arguments: ${message}` }],
            isError: true,
        }
    }

    const { isError, result, statusCode, body } = await safeFunc(tool.func, client, preflight.data as Record<string, unknown>, {
        ...options,
        logger,
    })
    if (isError) {
        // Errors are returned as isError tool results (HTTP 200), so they never
        // reach the host's error logs on their own. Report them here, at the real
        // catch site, so failures are actually observable. An API 4xx is the
        // caller's to fix (a missing inbox, a plan limit, a refused argument), so
        // it is a warning; a 5xx, a network failure or a toolkit bug is an error.
        // Error results are never validated against outputSchema - the MCP SDK
        // itself skips output validation when isError is true, so we don't either.
        const event = { type: 'tool_error' as const, tool: tool.name, message: String(result), statusCode, body }
        if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) logger.warn(event)
        else logger.error(event)
        return {
            content: [{ type: 'text' as const, text: String(result) }],
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
        logger.error({
            type: 'output_schema_mismatch',
            tool: tool.name,
            message: `${tool.name} result did not match its declared output schema`,
            issues: parsed.error.issues.map(({ code, path }) => ({ code, path })),
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

export type AgentMailToolkitOptions = {
    /**
     * Where tool failures and degraded results are reported (see ToolkitLogger). Without one,
     * each is a single console line: 4xx API errors on console.warn, everything else on
     * console.error.
     */
    logger?: ToolkitLogger
}

export class AgentMailToolkit extends ListToolkit<McpTool> {
    // Read when a tool runs: the base constructor builds every callback before this is set.
    private readonly logger?: ToolkitLogger

    constructor(client?: AgentMailClient, options: AgentMailToolkitOptions = {}) {
        super(client)
        this.logger = options.logger
    }

    protected buildTool(tool: Tool): McpTool {
        return {
            name: tool.name,
            title: tool.title,
            description: tool.description,
            inputSchema: tool.paramsSchema.shape,
            outputSchema: tool.outputSchema.shape,
            callback: async (args) => runTool(tool, this.client, args as Record<string, unknown>, { logger: this.logger }),
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
     * An unknown tool name returns an isError result rather than throwing, so a
     * bad name can never crash the caller. `args` is assumed already validated
     * against the tool's paramsSchema (the MCP SDK validates tools/call
     * arguments before dispatch).
     *
     * `options.signal` is the request's cancellation: pass it so the fetches a
     * tool makes itself (upload_file's PUT, get_attachment's download) stop when
     * the request does. A signal bound into the client only reaches SDK calls.
     * `options.logger` replaces the toolkit's logger for this call.
     */
    async invoke(
        name: string,
        client: AgentMailClient,
        args: Record<string, unknown>,
        options?: ToolCallOptions
    ): Promise<CallToolResult> {
        const tool = toolsByName.get(name)
        if (!tool) {
            return {
                content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
                isError: true,
            }
        }
        return runTool(tool, client, args, { ...options, logger: options?.logger ?? this.logger })
    }
}

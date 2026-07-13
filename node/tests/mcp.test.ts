import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { AgentMailError, type AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { tools } from '../src/tools.js'
import { mockClient, argsByTool } from './fixtures.js'

// Real MCP SDK client <-> server over an in-memory transport: the same protocol
// surface (tools/list, tools/call, client-side structuredContent validation
// against the listed outputSchema) an MCP host or app-review scanner exercises.
async function connect(client: AgentMailClient) {
    const server = new McpServer({ name: 'agentmail-test', version: '0.0.0' })
    for (const tool of new AgentMailToolkit(client).getTools()) {
        server.registerTool(tool.name, tool, tool.callback)
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const mcpClient = new Client({ name: 'test-client', version: '0.0.0' })
    await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)])
    return mcpClient
}

// get_attachment fetches its (https) download URL; return tiny non-PDF/DOCX bytes
// so the tool takes the metadata-only path without touching the network.
beforeAll(() => {
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(new Uint8Array([0x61, 0x62, 0x63, 0x64]), { status: 200, headers: { 'content-length': '4' } }))
    )
})

afterEach(() => {
    vi.spyOn(console, 'error').mockRestore()
})

describe('tools/list', () => {
    it('lists every tool with outputSchema, title, and all five annotations', async () => {
        const client = await connect(mockClient())
        const { tools: listed } = await client.listTools()

        expect(listed.map((t) => t.name)).toEqual(tools.map((t) => t.name))
        for (const tool of listed) {
            expect(tool.title, `${tool.name} title`).toBeTruthy()
            expect(tool.inputSchema?.type, `${tool.name} inputSchema root`).toBe('object')
            expect(tool.outputSchema?.type, `${tool.name} outputSchema root`).toBe('object')
            for (const key of ['title', 'readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']) {
                expect(tool.annotations, `${tool.name} annotation ${key}`).toHaveProperty(key)
            }
        }
    })
})

describe('tools/call', () => {
    it('every tool returns structuredContent matching its text block and declared schema', async () => {
        const client = await connect(mockClient())
        // listTools first so the MCP client caches output schemas and validates
        // structuredContent against them on every call below.
        await client.listTools()

        for (const tool of tools) {
            const result = await client.callTool({ name: tool.name, arguments: argsByTool[tool.name] })
            expect(result.isError ?? false, `${tool.name} should succeed`).toBe(false)
            expect(result.structuredContent, `${tool.name} structuredContent`).toBeDefined()
            const content = result.content as Array<{ type: string; text: string }>
            expect(content[0].type).toBe('text')
            expect(result.structuredContent, `${tool.name} text/structured parity`).toEqual(JSON.parse(content[0].text))
        }
    })

    it('serializes Date fields as ISO 8601 strings', async () => {
        const client = await connect(mockClient())
        const result = await client.callTool({ name: 'get_inbox', arguments: { inboxId: 'inbox_1' } })
        const structured = result.structuredContent as { createdAt: string }
        expect(structured.createdAt).toBe('2026-07-10T12:00:00.000Z')
    })

    it('void operations return the stable success object', async () => {
        const client = await connect(mockClient())
        const result = await client.callTool({ name: 'delete_inbox', arguments: { inboxId: 'inbox_1' } })
        expect(result.structuredContent).toEqual({ success: true })
    })

    it('returns isError with a concise API message on AgentMail errors', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const failing = mockClient()
        ;(failing.inboxes as { get: unknown }).get = async () => {
            throw new AgentMailError({
                message: 'Status code: 404\nBody: ...',
                statusCode: 404,
                body: { name: 'NotFoundError', message: 'inbox not found' },
            })
        }
        const client = await connect(failing)
        await client.listTools()

        const result = await client.callTool({ name: 'get_inbox', arguments: { inboxId: 'nope' } })
        expect(result.isError).toBe(true)
        const content = result.content as Array<{ text: string }>
        expect(content[0].text).toContain('inbox not found')
        expect(content[0].text).toContain('404')
        expect(result.structuredContent).toBeUndefined()
    })

    it('strips unknown top-level SDK fields so structuredContent matches the advertised strict-root schema', async () => {
        // The MCP SDK reconstructs a strip-mode z.object from the registered shape and
        // advertises additionalProperties:false at the root - a future SDK field must be
        // dropped from structuredContent, not leaked into a payload strict clients reject.
        const future = mockClient()
        ;(future.inboxes as { list: unknown }).list = async () => ({ count: 1, inboxes: [], futureSdkField: 'surprise' })
        const client = await connect(future)
        await client.listTools()

        const result = await client.callTool({ name: 'list_inboxes', arguments: {} })
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toEqual({ count: 1, inboxes: [] })
        const content = result.content as Array<{ text: string }>
        expect(JSON.parse(content[0].text)).toEqual({ count: 1, inboxes: [] })
    })

    it('advertises a strict root but loose nested objects (regression: SDK shape reconstruction)', async () => {
        const client = await connect(mockClient())
        const { tools: listed } = await client.listTools()
        const listInboxes = listed.find((t) => t.name === 'list_inboxes')!
        const schema = listInboxes.outputSchema as {
            additionalProperties?: unknown
            properties?: { inboxes?: { items?: { additionalProperties?: unknown } } }
        }
        // Documented SDK behavior our strip-parse in mcp.ts is aligned with:
        expect(schema.additionalProperties).toBe(false)
        // Nested objects keep their looseness, so nested SDK additions still pass.
        expect(schema.properties?.inboxes?.items?.additionalProperties).not.toBe(false)
    })

    it('fails visibly when a result drifts from its declared output schema', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const drifted = mockClient()
        ;(drifted.inboxes as { list: unknown }).list = async () => ({ foo: 'not the declared shape' })
        const client = await connect(drifted)

        const result = await client.callTool({ name: 'list_inboxes', arguments: {} })
        expect(result.isError).toBe(true)
        const content = result.content as Array<{ text: string }>
        expect(content[0].text).toMatch(/output schema/)
    })
})

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { AgentMailError, type AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { tools } from '../src/tools.js'
import { mockClient, argsByTool, inbox, fixtureByTool, connectAccepted } from './fixtures.js'
import { ConnectProviderParams } from '../src/schemas.js'

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
                body: { name: 'NotFoundError', message: 'inbox not found', requestId: 'req_internal_123' },
            })
        }
        const client = await connect(failing)
        await client.listTools()

        const result = await client.callTool({ name: 'get_inbox', arguments: { inboxId: 'nope' } })
        expect(result.isError).toBe(true)
        const content = result.content as Array<{ text: string }>
        expect(content[0].text).toContain('inbox not found')
        expect(content[0].text).toContain('404')
        // The raw error body (internal/debug fields) must never reach the model -
        // only the concise message extracted by errorMessage() in util.ts.
        expect(content[0].text).not.toContain('req_internal_123')
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

    it('advertises strict objects at every nesting level', async () => {
        const client = await connect(mockClient())
        const { tools: listed } = await client.listTools()
        const listInboxes = listed.find((t) => t.name === 'list_inboxes')!
        const schema = listInboxes.outputSchema as {
            additionalProperties?: unknown
            properties?: { inboxes?: { items?: { additionalProperties?: unknown } } }
        }
        expect(schema.additionalProperties).toBe(false)
        // Nested objects are strict too - the advertised contract matches the
        // strip-parse in mcp.ts, which drops undeclared nested fields.
        expect(schema.properties?.inboxes?.items?.additionalProperties).toBe(false)
    })

    it('strips undeclared NESTED fields (SDK passthrough internals, raw headers, debug data)', async () => {
        // The Fern SDK parses API responses with unrecognizedObjectKeys:"passthrough",
        // so internal API fields ride along inside list items. They must be dropped
        // before structuredContent - returning them is the data-minimization failure
        // OpenAI app review rejected (personal identifiers / undisclosed nested data).
        const leaky = mockClient()
        ;(leaky.inboxes as { list: unknown }).list = async () => ({
            count: 1,
            inboxes: [{ ...inbox(), organization_id: 'org_internal', debug: { trace: 'x' } }],
        })
        const client = await connect(leaky)
        await client.listTools()

        const result = await client.callTool({ name: 'list_inboxes', arguments: {} })
        expect(result.isError ?? false).toBe(false)
        const item = (result.structuredContent as { inboxes: Record<string, unknown>[] }).inboxes[0]
        expect(item).not.toHaveProperty('organization_id')
        expect(item).not.toHaveProperty('debug')
        expect(item).not.toHaveProperty('podId')
        expect(item.inboxId).toBe('inbox_1')

        // Same guarantee on messages: raw RFC-822 headers and snake_case internals
        // (present in the messageItem fixture) never reach structuredContent.
        const messages = await client.callTool({ name: 'list_messages', arguments: { inboxId: 'inbox_1' } })
        const msg = (messages.structuredContent as { messages: Record<string, unknown>[] }).messages[0]
        expect(msg).not.toHaveProperty('headers')
        expect(msg).not.toHaveProperty('organization_id')
        expect(msg).not.toHaveProperty('pod_id')
        expect(msg.messageId).toBe('msg_1')

        // Doubly-nested: messages INSIDE a thread (fixture messages carry the same
        // leak fields), and thread-item internals.
        const threadResult = await client.callTool({ name: 'get_thread', arguments: { inboxId: 'inbox_1', threadId: 'thread_1' } })
        const threadStructured = threadResult.structuredContent as Record<string, unknown> & { messages: Record<string, unknown>[] }
        expect(threadStructured).not.toHaveProperty('organization_id')
        expect(threadStructured.messages[0]).not.toHaveProperty('headers')
        expect(threadStructured.messages[0]).not.toHaveProperty('organization_id')

        // Nested attachments inside drafts (fixture attachment carries debug_trace).
        const drafts = await client.callTool({ name: 'list_drafts', arguments: { inboxId: 'inbox_1' } })
        const draftItem0 = (drafts.structuredContent as { drafts: Record<string, unknown>[] }).drafts[0]
        expect(draftItem0).not.toHaveProperty('organization_id')
        expect((draftItem0.attachments as Record<string, unknown>[])[0]).not.toHaveProperty('debug_trace')
        expect((draftItem0.attachments as Record<string, unknown>[])[0].attachmentId).toBe('att_d1')
    })

    it('search results keep highlights but strip internals (regression: highlights were silently dropped)', async () => {
        const client = await connect(mockClient())
        await client.listTools()

        const messages = await client.callTool({ name: 'search_messages', arguments: { inboxId: 'inbox_1', q: 'hello' } })
        const msg = (messages.structuredContent as { messages: Record<string, unknown>[] }).messages[0]
        expect(msg.highlights).toEqual({ text: ['<em>Hello</em> there'] })
        expect(msg).not.toHaveProperty('headers')
        expect(msg).not.toHaveProperty('organization_id')

        const threads = await client.callTool({ name: 'search_threads', arguments: { inboxId: 'inbox_1', q: 'hello' } })
        const thread0 = (threads.structuredContent as { threads: Record<string, unknown>[] }).threads[0]
        expect(thread0.highlights).toEqual({ subject: ['<em>Hello</em>'] })
        expect(thread0).not.toHaveProperty('organization_id')
    })

    it('accepts date-filter args through the real MCP path (regression: preflight double-parse)', async () => {
        // The SDK's own arg parse coerces before/after (z.string().pipe(z.coerce.date()))
        // into Date objects BEFORE the callback runs. runTool's preflight re-parse must
        // round-trip those (normalize: Date -> ISO string), not reject them as non-strings.
        const client = await connect(mockClient())
        await client.listTools()

        const result = await client.callTool({
            name: 'list_threads',
            arguments: { inboxId: 'inbox_1', after: '2026-01-01T00:00:00Z', before: '2026-07-01T00:00:00Z' },
        })
        expect(result.isError ?? false, (result.content as Array<{ text: string }>)?.[0]?.text).toBe(false)
    })

    it('enforces root-level schema refinements the SDK-rebuilt input schema drops', async () => {
        // The SDK validates tools/call args against z.object(rawShape), which loses
        // ReplyToMessageParams' replyAll/to refine - runTool's preflight re-parse is
        // the only place the rule can fire on the MCP path. Prove it does.
        const client = await connect(mockClient())
        await client.listTools()

        const result = await client.callTool({
            name: 'reply_to_message',
            arguments: { inboxId: 'inbox_1', messageId: 'msg_1', text: 'Hi', replyAll: true, to: ['a@example.com'] },
        })
        expect(result.isError).toBe(true)
        const content = result.content as Array<{ text: string }>
        expect(content[0].text).toContain('Cannot specify to, cc, or bcc when replyAll is true')
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

// A client whose list_inboxes returns a single inbox tagged with `marker`, so a test
// can tell which client actually served a call.
function inboxListClient(marker: string): AgentMailClient {
    return {
        inboxes: { list: async () => ({ count: 1, inboxes: [{ ...inbox(), inboxId: marker }] }) },
    } as unknown as AgentMailClient
}

describe('invoke (stateless per-call client)', () => {
    it('runs the tool with the client passed to invoke, not the one bound at construction', async () => {
        // A host that serves many users builds the toolkit once (bound client is a
        // placeholder) and hands a real per-request client to each call.
        const toolkit = new AgentMailToolkit(inboxListClient('BOUND'))
        const result = await toolkit.invoke('list_inboxes', inboxListClient('PER_CALL'), {})

        expect(result.isError ?? false).toBe(false)
        const structured = result.structuredContent as { inboxes: Array<{ inboxId: string }> }
        expect(structured.inboxes[0].inboxId).toBe('PER_CALL')
        // Same text/structured parity a tools/call returns.
        const content = result.content as Array<{ type: string; text: string }>
        expect(JSON.parse(content[0].text)).toEqual(structured)
    })

    it('returns an isError result for an unknown tool name instead of throwing', async () => {
        const toolkit = new AgentMailToolkit(mockClient())
        const result = await toolkit.invoke('does_not_exist', mockClient(), {})
        expect(result.isError).toBe(true)
    })

    it('surfaces AgentMail errors as an isError result with a concise, bounded message', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const failing = {
            inboxes: {
                list: async () => {
                    throw new AgentMailError({
                        message: 'Status code: 403\nBody: ...',
                        statusCode: 403,
                        body: { message: 'Forbidden' },
                    })
                },
            },
        } as unknown as AgentMailClient
        const toolkit = new AgentMailToolkit(mockClient())
        const result = await toolkit.invoke('list_inboxes', failing, {})

        expect(result.isError).toBe(true)
        const content = result.content as Array<{ text: string }>
        expect(content[0].text).toContain('Forbidden')
        expect(content[0].text).toContain('403')
        expect(result.structuredContent).toBeUndefined()
    })
})

describe('provider tools', () => {
    it('strips tenancy and registry internals from provider and account results', async () => {
        const client = await connect(mockClient())
        await client.listTools()

        const accountsResult = await client.callTool({
            name: 'list_provider_accounts',
            arguments: argsByTool.list_provider_accounts,
        })
        const structured = accountsResult.structuredContent as {
            provider?: Record<string, unknown>
            accounts: Record<string, unknown>[]
        }
        // The fixtures deliberately carry these internals; strip mode must drop
        // every one — the InboxSchema podId rule, asserted per-resource like the
        // email strip tests above.
        expect(structured.provider).not.toHaveProperty('client_id')
        expect(structured.provider).not.toHaveProperty('score')
        for (const account of structured.accounts) {
            expect(account).not.toHaveProperty('podId')
            expect(account).not.toHaveProperty('organizationId')
        }

        const listResult = await client.callTool({ name: 'list_providers', arguments: {} })
        for (const provider of (listResult.structuredContent as { providers: Record<string, unknown>[] }).providers) {
            expect(provider).not.toHaveProperty('client_id')
            expect(provider).not.toHaveProperty('score')
        }
    })

    it('maps the SDK calls: positional ids, camelCase body, fresh idempotency key, no POST retries', async () => {
        const calls: unknown[][] = []
        const client = await connect(
            mockClient({
                providers: {
                    list: async () => fixtureByTool.list_providers(),
                    search: async () => fixtureByTool.search_providers(),
                    get: async () => fixtureByTool.get_provider(),
                    listAccounts: async (...args: unknown[]) => {
                        calls.push(['listAccounts', ...args])
                        return fixtureByTool.list_provider_accounts()
                    },
                    connect: async (...args: unknown[]) => {
                        calls.push(['connect', ...args])
                        return connectAccepted()
                    },
                },
            })
        )

        await client.callTool({ name: 'list_provider_accounts', arguments: { providerId: 'prov_1', limit: 5 } })
        expect(calls[0]![1]).toBe('prov_1')
        expect(calls[0]![2]).toEqual({ limit: 5 })

        await client.callTool({
            name: 'connect_provider',
            arguments: { providerId: 'prov_1', inboxId: 'agent@agentmail.to', authorize: false },
        })
        const [, connectId, connectBody, connectOptions] = calls[1] as [
            string,
            string,
            Record<string, unknown>,
            { idempotencyKey: string; maxRetries: number },
        ]
        expect(connectId).toBe('prov_1')
        // authorize: false must be transmitted, not dropped — omitting it means
        // "keep the first-use disclosure", which is not the same request.
        expect(connectBody).toEqual({ inboxId: 'agent@agentmail.to', authorize: false })
        // The SDK fetcher retries POSTs by default; a re-POST of a committed
        // session can only 409 while the first response's magic URL is lost.
        expect(connectOptions.maxRetries).toBe(0)
        expect(connectOptions.idempotencyKey).toMatch(/^[A-Za-z0-9._~-]+$/)

        await client.callTool({ name: 'connect_provider', arguments: { providerId: 'prov_1' } })
        const secondKey = (calls[2]![3] as { idempotencyKey: string }).idempotencyKey
        expect(secondKey).not.toBe(connectOptions.idempotencyKey)
    })

    it('rejects idempotency keys the API would 400 before any request is sent', () => {
        expect(ConnectProviderParams.safeParse({ providerId: 'prov_1', idempotencyKey: '' }).success).toBe(false)
        expect(ConnectProviderParams.safeParse({ providerId: 'prov_1', idempotencyKey: 'retry 2' }).success).toBe(false)
        expect(ConnectProviderParams.safeParse({ providerId: 'prov_1', idempotencyKey: 'retry-2' }).success).toBe(true)
    })
})

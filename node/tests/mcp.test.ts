import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { AgentMailError, type AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { tools } from '../src/tools.js'
import { mockClient, argsByTool, inbox } from './fixtures.js'

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

    describe.each([
        ['send_message', 'messages', 'send'],
        ['reply_to_message', 'messages', 'reply'],
        ['forward_message', 'messages', 'forward'],
        ['create_draft', 'drafts', 'create'],
    ] as const)('%s attachment validation', (toolName, resourceName, methodName) => {
        it('rejects both or neither attachment source before the SDK call', async () => {
            const agentMail = mockClient()
            const sdkCall = vi.fn()
            ;(agentMail.inboxes[resourceName] as unknown as Record<string, unknown>)[methodName] = sdkCall
            const client = await connect(agentMail)
            const base = argsByTool[toolName]

            const both = await client.callTool({
                name: toolName,
                arguments: {
                    ...base,
                    attachments: [{ filename: 'both.txt', content: 'aGk=', url: 'https://example.com/both.txt' }],
                },
            })
            const neither = await client.callTool({
                name: toolName,
                arguments: {
                    ...base,
                    attachments: [{ filename: 'neither.txt' }],
                },
            })

            expect(both.isError).toBe(true)
            expect(neither.isError).toBe(true)
            expect(sdkCall).not.toHaveBeenCalled()
        })
    })

    it('rejects conflicting and legacy reply routing before either SDK reply operation', async () => {
        const agentMail = mockClient()
        const reply = vi.fn()
        const replyAll = vi.fn()
        ;(agentMail.inboxes.messages as unknown as Record<string, unknown>).reply = reply
        ;(agentMail.inboxes.messages as unknown as Record<string, unknown>).replyAll = replyAll
        const client = await connect(agentMail)
        const base = argsByTool.reply_to_message

        const invalidArguments = [
            { ...base, recipients: { mode: 'all', to: ['conflict@example.com'] } },
            { ...base, replyAll: true },
            { ...base, to: ['legacy@example.com'] },
        ]
        for (const args of invalidArguments) {
            const result = await client.callTool({ name: 'reply_to_message', arguments: args })
            expect(result.isError).toBe(true)
        }

        expect(reply).not.toHaveBeenCalled()
        expect(replyAll).not.toHaveBeenCalled()
    })

    it('passes an input date transform to the callback exactly once', async () => {
        const agentMail = mockClient()
        const list = vi.fn(async (_inboxId: string, _options: unknown) => ({ count: 0, messages: [] }))
        ;(agentMail.inboxes.messages as unknown as Record<string, unknown>).list = list
        const client = await connect(agentMail)
        const before = '2026-07-01T12:00:00.000Z'

        const result = await client.callTool({
            name: 'list_messages',
            arguments: { inboxId: 'inbox_1', before },
        })

        expect(result.isError ?? false).toBe(false)
        const options = list.mock.calls[0][1] as { before: Date }
        expect(options.before).toBeInstanceOf(Date)
        expect(options.before.toISOString()).toBe(before)
    })

    it('returns a generic public error while preserving bounded API details in server logs', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
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
        expect(content[0].text).toBe('AgentMail request failed (HTTP 404)')
        // The API's text and internal/debug fields remain available in bounded server
        // logs but never reach the model-facing MCP result.
        expect(content[0].text).not.toContain('inbox not found')
        expect(content[0].text).not.toContain('req_internal_123')
        expect(errorSpy).toHaveBeenCalledWith(
            '[agentmail-toolkit] tool error',
            expect.objectContaining({
                tool: 'get_inbox',
                error: 'inbox not found (HTTP 404)',
                statusCode: 404,
                body: expect.objectContaining({ message: 'inbox not found', requestId: 'req_internal_123' }),
            })
        )
        expect(result.structuredContent).toBeUndefined()
    })

    it('strips internal attachment extraction failures from output and its advertised schema', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const internal = mockClient()
        ;(internal.inboxes.threads as { getAttachment: unknown }).getAttachment = async () => ({
            attachmentId: 'att_1',
            filename: 'doc.pdf',
            size: 4,
            contentType: 'application/pdf',
            downloadUrl: 'http://unsafe.example/att_1',
            expiresAt: new Date('2026-07-10T12:00:00.000Z'),
        })
        const client = await connect(internal)
        const listed = await client.listTools()
        const schema = listed.tools.find((tool) => tool.name === 'get_attachment')!.outputSchema as {
            properties?: Record<string, unknown>
        }
        expect(schema.properties).not.toHaveProperty('extractionError')

        const result = await client.callTool({
            name: 'get_attachment',
            arguments: { inboxId: 'inbox_1', threadId: 'thread_1', attachmentId: 'att_1' },
        })
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).not.toHaveProperty('extractionError')
        const content = result.content as Array<{ text: string }>
        expect(JSON.parse(content[0].text)).not.toHaveProperty('extractionError')
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

    it('validates direct invoke arguments once and rejects invalid input before the SDK call', async () => {
        const agentMail = mockClient()
        const reply = vi.fn()
        ;(agentMail.inboxes.messages as unknown as Record<string, unknown>).reply = reply
        const toolkit = new AgentMailToolkit(mockClient())

        const result = await toolkit.invoke('reply_to_message', agentMail, {
            ...argsByTool.reply_to_message,
            replyAll: true,
        })

        expect(result.isError).toBe(true)
        expect(result.content).toEqual([{ type: 'text', text: 'Invalid arguments for tool: reply_to_message' }])
        expect(reply).not.toHaveBeenCalled()
    })

    it('sanitizes AgentMail errors while preserving their status code', async () => {
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
        expect(content[0].text).toBe('AgentMail request failed (HTTP 403)')
        expect(content[0].text).not.toContain('Forbidden')
        expect(result.structuredContent).toBeUndefined()
    })

    it('uses a status-free public error and bounds the private server log when no status exists', async () => {
        const rawMessage = 'private failure: ' + 'x'.repeat(2_000)
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const failing = {
            inboxes: {
                list: async () => {
                    throw new Error(rawMessage)
                },
            },
        } as unknown as AgentMailClient
        const toolkit = new AgentMailToolkit(mockClient())
        const result = await toolkit.invoke('list_inboxes', failing, {})

        expect(result.isError).toBe(true)
        const content = result.content as Array<{ text: string }>
        expect(content[0].text).toBe('AgentMail request failed')
        expect(content[0].text).not.toContain('private failure')
        const logged = errorSpy.mock.calls[0][1] as { error: string }
        expect(logged.error).toContain('private failure')
        expect(logged.error).toHaveLength(500)
    })
})

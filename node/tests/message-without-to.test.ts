import { describe, it, expect, afterEach, vi } from 'vitest'
import { type AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { AgentMailToolkit as BareToolkit } from '../src/index.js'
import { AgentMailToolkit as AiSdkToolkit } from '../src/ai-sdk.js'
import { AgentMailToolkit as LangchainToolkit } from '../src/langchain.js'
import { AgentMailToolkit as ClawdbotToolkit } from '../src/clawdbot.js'
import { ListMessagesResponseSchema, MessageItemSchema, MessageSchema, SearchMessagesResponseSchema, ThreadSchema } from '../src/output-schemas.js'
import { mockClient, messageItem, message, threadItem } from './fixtures.js'

// A message delivered with no To header (Bcc-only delivery, an
// "undisclosed-recipients:;" group) is stored and returned by the API without
// `to`. The SDK type and the docs contract list `to` as required, and the output
// schemas used to follow them, so every list, search, thread, or get that touched
// such a message failed as an "output schema" mismatch. These tests pin the
// schemas to the wire instead.
const withoutTo = <T extends { to?: unknown }>(fixture: T): Omit<T, 'to'> => {
    const { to: _to, ...rest } = fixture
    return rest
}
const bccOnlyItem = () => withoutTo(messageItem())
const bccOnlyMessage = () => withoutTo(message())

// The fixtures carry Date objects; the MCP path converts them to ISO strings
// (normalize) before validation. A JSON round-trip does the same for a direct
// schema check, and drops undefined the same way.
const asWire = (value: unknown) => JSON.parse(JSON.stringify(value))

type Item = Record<string, unknown>
type Page = { count: number; messages: Item[] }

async function connect(client: AgentMailClient) {
    const server = new McpServer({ name: 'agentmail-test', version: '0.0.0' })
    for (const tool of new AgentMailToolkit(client).getTools()) {
        server.registerTool(tool.name, tool, tool.callback)
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const mcpClient = new Client({ name: 'test-client', version: '0.0.0' })
    await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)])
    // listTools first so the MCP client validates structuredContent against the
    // listed outputSchema on every call, the way a host does.
    await mcpClient.listTools()
    return mcpClient
}

type Inboxes = { messages: Record<string, unknown>; threads: Record<string, unknown> }

// The fixture client with only the message reads swapped for the given message.
// mockClient's overrides replace a whole top-level key, so the swap is done on
// the built client to keep every sibling method (inbox, draft, list tools) intact.
function messagesClient(item: Item, full: Item = { ...item, text: 'Hello there' }): AgentMailClient {
    const client = mockClient() as unknown as { inboxes: Inboxes }
    client.inboxes.messages = {
        ...client.inboxes.messages,
        list: async () => ({ count: 1, messages: [item] }),
        search: async () => ({ count: 1, messages: [{ ...item, highlights: { text: ['<em>Hello</em> there'] } }] }),
        get: async () => full,
    }
    client.inboxes.threads = { ...client.inboxes.threads, get: async () => ({ ...threadItem(), messages: [full] }) }
    return client as unknown as AgentMailClient
}

afterEach(() => {
    vi.restoreAllMocks()
})

describe('output schemas: a message with no To header', () => {
    it('MessageItemSchema accepts it and keeps `to` absent rather than inventing one', () => {
        const parsed = MessageItemSchema.parse(asWire(bccOnlyItem()))
        expect(parsed).not.toHaveProperty('to')
        expect(parsed.from).toBe('sender@example.com')
        expect(parsed.messageId).toBe('msg_1')
    })

    it('still strips the fields the schema exists to strip', () => {
        const parsed = MessageItemSchema.parse(asWire(bccOnlyItem()))
        expect(parsed).not.toHaveProperty('headers')
        expect(parsed).not.toHaveProperty('organization_id')
        expect(parsed).not.toHaveProperty('pod_id')
    })

    it('keeps an explicit empty `to` as an empty list', () => {
        const parsed = MessageItemSchema.parse(asWire({ ...messageItem(), to: [] }))
        expect(parsed.to).toEqual([])
    })

    it('MessageSchema (get_message) accepts it too', () => {
        const parsed = MessageSchema.parse(asWire(bccOnlyMessage()))
        expect(parsed).not.toHaveProperty('to')
        expect(parsed.text).toBe('Hello there')
    })

    it('a list page mixing messages with and without `to` validates as a whole', () => {
        const page = ListMessagesResponseSchema.parse(asWire({ count: 2, messages: [messageItem(), bccOnlyItem()] }))
        expect(page.messages).toHaveLength(2)
        expect(page.messages[0].to).toEqual(['agent@agentmail.to'])
        expect(page.messages[1]).not.toHaveProperty('to')
    })

    it('a search page with highlights validates with `to` absent', () => {
        const page = SearchMessagesResponseSchema.parse(asWire({ count: 1, messages: [{ ...bccOnlyItem(), highlights: { text: ['<em>Hello</em>'] } }] }))
        expect(page.messages[0]).not.toHaveProperty('to')
        expect(page.messages[0].highlights).toEqual({ text: ['<em>Hello</em>'] })
    })

    it('a thread whose messages lack `to` validates', () => {
        const parsed = ThreadSchema.parse(asWire({ ...threadItem(), messages: [bccOnlyMessage()] }))
        expect(parsed.messages[0]).not.toHaveProperty('to')
        expect(parsed.recipients).toEqual(['agent@agentmail.to'])
    })

    it('the other required fields stay required: `from` and `messageId` missing still fail', () => {
        const { from: _from, ...noFrom } = messageItem()
        expect(MessageItemSchema.safeParse(asWire(noFrom)).success).toBe(false)
        const { messageId: _id, ...noId } = messageItem()
        expect(MessageItemSchema.safeParse(asWire(noId)).success).toBe(false)
    })
})

describe('tools/list: the schemas a host validates against do not require `to`', () => {
    it('list_messages, search_messages, get_thread items and get_message', async () => {
        const client = await connect(mockClient())
        const { tools } = await client.listTools()
        const byName = Object.fromEntries(tools.map((t) => [t.name, t.outputSchema as Record<string, unknown>]))

        const itemsOf = (schema: Record<string, unknown>) => {
            const properties = schema.properties as Record<string, { items: { required: string[]; properties: Record<string, unknown> } }>
            return properties.messages.items
        }
        for (const name of ['list_messages', 'search_messages', 'get_thread']) {
            const items = itemsOf(byName[name])
            expect(items.required, `${name} items.required`).not.toContain('to')
            expect(items.required, `${name} items.required`).toContain('from')
            expect(items.properties, `${name} items.properties`).toHaveProperty('to')
        }
        const getMessage = byName.get_message as { required: string[]; properties: Record<string, unknown> }
        expect(getMessage.required).not.toContain('to')
        expect(getMessage.required).toContain('from')
        expect(getMessage.properties).toHaveProperty('to')
    })
})

describe('tools/call through the real MCP path with a Bcc-only message', () => {
    it('list_messages returns the page instead of an internal error', async () => {
        const client = await connect(messagesClient(bccOnlyItem()))
        const result = await client.callTool({ name: 'list_messages', arguments: { inboxId: 'inbox_1', from: ['sender@example.com'], limit: 1 } })

        expect(result.isError ?? false, (result.content as Array<{ text: string }>)?.[0]?.text).toBe(false)
        const page = result.structuredContent as Page
        expect(page.count).toBe(1)
        expect(page.messages[0].messageId).toBe('msg_1')
        expect(page.messages[0]).not.toHaveProperty('to')
        expect(page.messages[0]).not.toHaveProperty('headers')
        expect(page.messages[0]).not.toHaveProperty('organization_id')
    })

    it('search_messages returns the page, highlights intact', async () => {
        const client = await connect(messagesClient(bccOnlyItem()))
        const result = await client.callTool({ name: 'search_messages', arguments: { inboxId: 'inbox_1', q: 'Daily Brief' } })

        expect(result.isError ?? false, (result.content as Array<{ text: string }>)?.[0]?.text).toBe(false)
        const page = result.structuredContent as Page
        expect(page.messages[0]).not.toHaveProperty('to')
        expect(page.messages[0].highlights).toEqual({ text: ['<em>Hello</em> there'] })
    })

    it('get_message returns the message', async () => {
        const client = await connect(messagesClient(bccOnlyItem()))
        const result = await client.callTool({ name: 'get_message', arguments: { inboxId: 'inbox_1', messageId: 'msg_1' } })

        expect(result.isError ?? false, (result.content as Array<{ text: string }>)?.[0]?.text).toBe(false)
        const got = result.structuredContent as Item
        expect(got).not.toHaveProperty('to')
        expect(got.text).toBe('Hello there')
    })

    it('get_thread returns the thread with the message in it', async () => {
        const client = await connect(messagesClient(bccOnlyItem()))
        const result = await client.callTool({ name: 'get_thread', arguments: { inboxId: 'inbox_1', threadId: 'thread_1' } })

        expect(result.isError ?? false, (result.content as Array<{ text: string }>)?.[0]?.text).toBe(false)
        const got = result.structuredContent as { messages: Item[] }
        expect(got.messages).toHaveLength(1)
        expect(got.messages[0]).not.toHaveProperty('to')
    })

    it('a page mixing both kinds comes back whole, in order', async () => {
        const mixed = messagesClient(bccOnlyItem()) as unknown as { inboxes: Inboxes }
        mixed.inboxes.messages.list = async () => ({
            count: 2,
            messages: [
                { ...messageItem(), messageId: 'msg_with_to' },
                { ...bccOnlyItem(), messageId: 'msg_bcc_only' },
            ],
        })
        const client = await connect(mixed as unknown as AgentMailClient)
        const result = await client.callTool({ name: 'list_messages', arguments: { inboxId: 'inbox_1' } })

        expect(result.isError ?? false).toBe(false)
        const page = result.structuredContent as Page
        expect(page.messages.map((m) => m.messageId)).toEqual(['msg_with_to', 'msg_bcc_only'])
        expect(page.messages[0].to).toEqual(['agent@agentmail.to'])
        expect(page.messages[1]).not.toHaveProperty('to')
    })

    it('text and structuredContent still agree', async () => {
        const client = await connect(messagesClient(bccOnlyItem()))
        const result = await client.callTool({ name: 'list_messages', arguments: { inboxId: 'inbox_1' } })
        const content = result.content as Array<{ type: string; text: string }>
        expect(JSON.parse(content[0].text)).toEqual(result.structuredContent)
    })

    it('a message that is genuinely malformed still fails visibly', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { from: _from, ...noFrom } = bccOnlyItem()
        const client = await connect(messagesClient(noFrom))
        const result = await client.callTool({ name: 'list_messages', arguments: { inboxId: 'inbox_1' } })

        expect(result.isError).toBe(true)
        expect((result.content as Array<{ text: string }>)[0].text).toMatch(/output schema/)
    })
})

describe('invoke (stateless per-call client) with a Bcc-only message', () => {
    it('list_messages succeeds and strips the same fields', async () => {
        const toolkit = new AgentMailToolkit(mockClient())
        const result = await toolkit.invoke('list_messages', messagesClient(bccOnlyItem()), { inboxId: 'inbox_1' })

        expect(result.isError ?? false).toBe(false)
        const page = result.structuredContent as Page
        expect(page.messages[0]).not.toHaveProperty('to')
        expect(page.messages[0]).not.toHaveProperty('headers')
    })

    it('the bare toolkit hands the SDK result through unchanged, `to` absent', async () => {
        // The bare tool runs on the client bound at construction and takes only args.
        const toolkit = new BareToolkit(messagesClient(bccOnlyItem()))
        const tool = toolkit.getTools().find((t) => t.name === 'list_messages')
        expect(tool).toBeDefined()
        const page = (await tool!.func({ inboxId: 'inbox_1' })) as Page
        expect(page.messages[0]).not.toHaveProperty('to')
        expect(page.messages[0].messageId).toBe('msg_1')
    })
})

// The framework adapters do not validate output, so they never failed on this;
// pinned so a future shared strip cannot reintroduce the requirement there.
describe('framework adapters with a Bcc-only message', () => {
    it('ai-sdk returns the page with `to` absent', async () => {
        const tools = new AiSdkToolkit(messagesClient(bccOnlyItem())).getTools()
        const page = (await tools['list_messages'].execute!({ inboxId: 'inbox_1' }, { toolCallId: 't1', messages: [] })) as Page
        expect(page.count).toBe(1)
        expect(page.messages[0]).not.toHaveProperty('to')
        expect(page.messages[0].from).toBe('sender@example.com')
    })

    it('langchain returns the page as JSON with `to` absent', async () => {
        const tools = new LangchainToolkit(messagesClient(bccOnlyItem())).getTools()
        const listMessages = tools.find((t) => t.name === 'list_messages')!
        const page = JSON.parse((await listMessages.invoke({ inboxId: 'inbox_1' })) as string) as Page
        expect(page.count).toBe(1)
        expect(page.messages[0]).not.toHaveProperty('to')
    })

    it('clawdbot returns text content with `to` absent', async () => {
        const tools = new ClawdbotToolkit(messagesClient(bccOnlyItem())).getTools()
        const listMessages = tools.find((t) => t.name === 'list_messages')!
        const result = await listMessages.execute('call_1', { inboxId: 'inbox_1' }, undefined as never)
        const page = JSON.parse((result.content[0] as { text: string }).text) as Page
        expect(page.count).toBe(1)
        expect(page.messages[0]).not.toHaveProperty('to')
    })
})

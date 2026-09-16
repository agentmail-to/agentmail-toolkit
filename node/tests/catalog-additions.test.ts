import { describe, it, expect } from 'vitest'
import { AgentMailError, type AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { tools } from '../src/tools.js'
import {
    ListAccountsParams,
    SearchInboxesParams,
    GetMessageParams,
    ListListEntriesParams,
    GetListEntryParams,
    CreateListEntryParams,
    DeleteListEntryParams,
} from '../src/schemas.js'
import { listAccounts, searchInboxes, getMessage, listListEntries, getListEntry, createListEntry, deleteListEntry } from '../src/functions.js'
import { mockClient, account, provider, message, inbox, listEntry } from './fixtures.js'

// The tools added alongside the api-keys rework, driven the way an MCP host
// drives them: through a real client/server pair over an in-memory transport,
// with the SDK stubbed at the method boundary so every argument the function
// hands the SDK is observable.

async function connect(client: AgentMailClient) {
    const server = new McpServer({ name: 'agentmail-test', version: '0.0.0' })
    for (const tool of new AgentMailToolkit(client).getTools()) {
        server.registerTool(tool.name, tool, tool.callback)
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const mcpClient = new Client({ name: 'test-client', version: '0.0.0' })
    await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)])
    await mcpClient.listTools()
    return mcpClient
}

type Call = { method: string; args: unknown[] }

function recordingClient(calls: Call[], overrides: Record<string, unknown> = {}): AgentMailClient {
    const record = (method: string, result: unknown) => async (...args: unknown[]) => {
        calls.push({ method, args })
        return result
    }
    return mockClient({
        accounts: { list: record('accounts.list', { count: 1, limit: 10, accounts: [account()] }) },
        providers: {
            list: record('providers.list', { count: 0, limit: 10, providers: [] }),
            search: record('providers.search', { count: 0, limit: 10, providers: [] }),
            get: record('providers.get', provider()),
            listAccounts: record('providers.listAccounts', { provider: provider(), count: 1, accounts: [account()] }),
            connect: record('providers.connect', { apiKeyId: '33333333-3333-4333-8333-333333333333', magicUrl: 'https://agentid.example/connect#t', expiresAt: new Date('2026-07-10T12:05:00.000Z') }),
        },
        ...overrides,
    })
}

describe('catalog: the five additions are registered with complete metadata', () => {
    it('lists them in resource order with all five annotations', () => {
        const names = tools.map((t) => t.name)
        expect(names.indexOf('search_inboxes')).toBe(names.indexOf('list_inboxes') + 1)
        expect(names.indexOf('get_message')).toBe(names.indexOf('update_message') + 1)
        expect(names.slice(names.indexOf('list_list_entries'), names.indexOf('list_list_entries') + 4)).toEqual(['list_list_entries', 'get_list_entry', 'create_list_entry', 'delete_list_entry'])
        expect(names.indexOf('delete_list_entry')).toBe(names.indexOf('auth_me') - 1)
        expect(names.indexOf('list_accounts')).toBeGreaterThan(names.indexOf('get_provider'))
        expect(names[names.length - 1]).toBe('connect_provider')
        expect(names).not.toContain('list_provider_accounts')
        expect(names).not.toContain('get_provider_connection')
        expect(names).not.toContain('unblock_recipient')
        for (const name of ['search_inboxes', 'get_message', 'list_list_entries', 'get_list_entry', 'create_list_entry', 'delete_list_entry', 'list_accounts']) {
            const tool = tools.find((t) => t.name === name)!
            expect(tool.title).toBeTruthy()
            expect(tool.description.length).toBeGreaterThan(40)
            for (const key of ['title', 'readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']) {
                expect(tool.annotations).toHaveProperty(key)
            }
        }
    })

    it('marks the reads read-only and the list writes as destructive', () => {
        const by = (name: string) => tools.find((t) => t.name === name)!.annotations
        expect(by('search_inboxes').readOnlyHint).toBe(true)
        expect(by('get_message').readOnlyHint).toBe(true)
        expect(by('get_message').openWorldHint).toBe(true) // external senders' content
        expect(by('list_accounts').readOnlyHint).toBe(true)
        expect(by('list_list_entries').readOnlyHint).toBe(true)
        expect(by('get_list_entry').readOnlyHint).toBe(true)
        expect(by('create_list_entry').readOnlyHint).toBe(false)
        expect(by('create_list_entry').destructiveHint).toBe(true)
        expect(by('create_list_entry').idempotentHint).toBe(false)
        expect(by('delete_list_entry').destructiveHint).toBe(true)
        expect(by('delete_list_entry').idempotentHint).toBe(true)
    })
})

describe('list_accounts', () => {
    it('routes to the cross-provider list when no providerId is given', async () => {
        const calls: Call[] = []
        const client = await connect(recordingClient(calls))
        const result = await client.callTool({ name: 'list_accounts', arguments: { limit: 5, pageToken: 'tok' } })
        expect(calls).toEqual([{ method: 'accounts.list', args: [{ limit: 5, pageToken: 'tok' }] }])
        expect(result.isError ?? false).toBe(false)
        const structured = result.structuredContent as { provider?: unknown; accounts: Record<string, unknown>[] }
        expect(structured.provider).toBeUndefined()
        expect(structured.accounts).toHaveLength(1)
    })

    it('routes to the per-provider list when providerId is given, with the id positional', async () => {
        const calls: Call[] = []
        const client = await connect(recordingClient(calls))
        const result = await client.callTool({ name: 'list_accounts', arguments: { providerId: 'prov_1', limit: 5 } })
        expect(calls).toEqual([{ method: 'providers.listAccounts', args: ['prov_1', { limit: 5 }] }])
        const structured = result.structuredContent as { provider?: Record<string, unknown>; accounts: Record<string, unknown>[] }
        expect(structured.provider?.providerId).toBe(provider().providerId)
        expect(structured.accounts).toHaveLength(1)
    })

    it('strips tenancy identifiers from every account row on both routes', async () => {
        for (const args of [{}, { providerId: 'prov_1' }]) {
            const client = await connect(recordingClient([]))
            const result = await client.callTool({ name: 'list_accounts', arguments: args })
            const structured = result.structuredContent as { accounts: Record<string, unknown>[] }
            for (const row of structured.accounts) {
                expect(row).toHaveProperty('accountId')
                expect(row).not.toHaveProperty('podId')
                expect(row).not.toHaveProperty('organizationId')
            }
        }
    })

    it('rejects an empty providerId instead of routing it as a filter', () => {
        expect(ListAccountsParams.safeParse({ providerId: '' }).success).toBe(false)
        expect(ListAccountsParams.safeParse({}).success).toBe(true)
        expect(ListAccountsParams.safeParse({ limit: 101 }).success).toBe(false)
        expect(ListAccountsParams.safeParse({ limit: 0 }).success).toBe(false)
    })

    it('does not apply a default page size (the accounts index pages sparsely)', async () => {
        const calls: Call[] = []
        await listAccounts(recordingClient(calls), ListAccountsParams.parse({}))
        expect(calls[0]!.args).toEqual([{}])
    })
})

describe('get_message', () => {
    it('fetches one message by positional ids and strips headers and internals', async () => {
        const calls: Call[] = []
        const withMessages = mockClient({
            inboxes: {
                ...(mockClient() as unknown as { inboxes: Record<string, unknown> }).inboxes,
                messages: {
                    ...((mockClient() as unknown as { inboxes: { messages: Record<string, unknown> } }).inboxes.messages),
                    get: async (...args: unknown[]) => {
                        calls.push({ method: 'messages.get', args })
                        return message()
                    },
                },
            },
        })
        const client = await connect(withMessages)
        const result = await client.callTool({ name: 'get_message', arguments: { inboxId: 'inbox_1', messageId: 'msg_1' } })
        expect(calls).toEqual([{ method: 'messages.get', args: ['inbox_1', 'msg_1'] }])
        expect(result.isError ?? false).toBe(false)
        const structured = result.structuredContent as Record<string, unknown>
        expect(structured.text).toBe('Hello there')
        expect(structured).not.toHaveProperty('headers')
        expect(structured).not.toHaveProperty('organization_id')
        expect(structured).not.toHaveProperty('pod_id')
    })

    it('passes exactly the two ids the SDK takes', async () => {
        const calls: Call[] = []
        const client = { inboxes: { messages: { get: async (...args: unknown[]) => { calls.push({ method: 'get', args }); return message() } } } } as unknown as AgentMailClient
        await getMessage(client, GetMessageParams.parse({ inboxId: 'inbox_1', messageId: 'msg_1' }))
        expect(calls[0]!.args).toEqual(['inbox_1', 'msg_1'])
    })
})

describe('search_inboxes', () => {
    it('forwards q with the list page controls and republishes inbox rows without podId', async () => {
        const calls: Call[] = []
        const client = await connect(
            mockClient({
                inboxes: {
                    ...(mockClient() as unknown as { inboxes: Record<string, unknown> }).inboxes,
                    search: async (...args: unknown[]) => {
                        calls.push({ method: 'inboxes.search', args })
                        return { count: 1, inboxes: [inbox()] }
                    },
                },
            })
        )
        const result = await client.callTool({ name: 'search_inboxes', arguments: { q: 'agent', limit: 3 } })
        expect(calls).toEqual([{ method: 'inboxes.search', args: [{ q: 'agent', limit: 3 }] }])
        const structured = result.structuredContent as { inboxes: Record<string, unknown>[] }
        expect(structured.inboxes[0]).toHaveProperty('inboxId')
        expect(structured.inboxes[0]).not.toHaveProperty('podId')
    })

    it('applies the catalog default page size and the API bounds on q', () => {
        expect(SearchInboxesParams.parse({ q: 'ag' }).limit).toBe(10)
        expect(SearchInboxesParams.safeParse({ q: 'a' }).success).toBe(false)
        expect(SearchInboxesParams.safeParse({ q: 'x'.repeat(257) }).success).toBe(false)
        expect(SearchInboxesParams.safeParse({}).success).toBe(false)
    })

    it('hands the parsed args straight to the SDK', async () => {
        const calls: Call[] = []
        const client = { inboxes: { search: async (...args: unknown[]) => { calls.push({ method: 's', args }); return { count: 0, inboxes: [] } } } } as unknown as AgentMailClient
        await searchInboxes(client, SearchInboxesParams.parse({ q: 'team', pageToken: 'p2' }))
        expect(calls[0]!.args).toEqual([{ q: 'team', pageToken: 'p2', limit: 10 }])
    })
})

function listsClient(calls: Call[], overrides: Partial<Record<'list' | 'get' | 'create' | 'delete', (...args: unknown[]) => Promise<unknown>>> = {}): AgentMailClient {
    const record = (method: string, result: unknown) => async (...args: unknown[]) => {
        calls.push({ method, args })
        return result
    }
    const base = (mockClient() as unknown as { inboxes: Record<string, unknown> }).inboxes
    return mockClient({
        inboxes: {
            ...base,
            lists: {
                list: record('lists.list', { count: 1, limit: 10, entries: [listEntry()] }),
                get: record('lists.get', listEntry()),
                create: record('lists.create', listEntry()),
                delete: record('lists.delete', undefined),
                ...overrides,
            },
        },
    })
}

describe('list_list_entries', () => {
    it('passes direction and type positionally and the page controls as options', async () => {
        const calls: Call[] = []
        const client = await connect(listsClient(calls))
        const result = await client.callTool({
            name: 'list_list_entries',
            arguments: { inboxId: 'inbox_1', direction: 'receive', listType: 'allow', limit: 5, pageToken: 'tok' },
        })
        expect(calls).toEqual([{ method: 'lists.list', args: ['inbox_1', 'receive', 'allow', { limit: 5, pageToken: 'tok' }] }])
        expect(result.isError ?? false).toBe(false)
        const structured = result.structuredContent as { entries: Record<string, unknown>[] }
        expect(structured.entries).toHaveLength(1)
    })

    it('strips tenancy identifiers and keeps readOnly and reason on every row', async () => {
        const client = await connect(listsClient([], { list: async () => ({ count: 1, entries: [{ ...listEntry(), readOnly: true }] }) }))
        const result = await client.callTool({ name: 'list_list_entries', arguments: { inboxId: 'inbox_1', direction: 'send', listType: 'block' } })
        const [row] = (result.structuredContent as { entries: Record<string, unknown>[] }).entries
        expect(row).toMatchObject({ entry: 'blocked@example.com', direction: 'send', listType: 'block', entryType: 'email', reason: 'asked by the human', readOnly: true })
        expect(row).toHaveProperty('createdAt', '2026-07-10T12:00:00.000Z')
        expect(row).not.toHaveProperty('organizationId')
        expect(row).not.toHaveProperty('podId')
        expect(row).not.toHaveProperty('scope_key')
    })

    it('rejects a direction or listType outside the API vocabulary before any request', () => {
        expect(ListListEntriesParams.safeParse({ inboxId: 'inbox_1', direction: 'send', listType: 'block' }).success).toBe(true)
        expect(ListListEntriesParams.safeParse({ inboxId: 'inbox_1', direction: 'outbound', listType: 'block' }).success).toBe(false)
        expect(ListListEntriesParams.safeParse({ inboxId: 'inbox_1', direction: 'send', listType: 'deny' }).success).toBe(false)
        expect(ListListEntriesParams.parse({ inboxId: 'inbox_1', direction: 'send', listType: 'block' }).limit).toBe(10)
    })

    it('hands the parsed page controls to the SDK without the routing fields', async () => {
        const calls: Call[] = []
        await listListEntries(listsClient(calls), ListListEntriesParams.parse({ inboxId: 'inbox_1', direction: 'reply', listType: 'allow' }))
        expect(calls[0]!.args).toEqual(['inbox_1', 'reply', 'allow', { limit: 10 }])
    })
})

describe('get_list_entry', () => {
    it('reads one entry by its value and strips tenancy identifiers', async () => {
        const calls: Call[] = []
        const client = await connect(listsClient(calls))
        const result = await client.callTool({
            name: 'get_list_entry',
            arguments: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'blocked@example.com' },
        })
        expect(calls).toEqual([{ method: 'lists.get', args: ['inbox_1', 'send', 'block', 'blocked@example.com'] }])
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).not.toHaveProperty('organizationId')
        expect(result.structuredContent).not.toHaveProperty('podId')
        expect((result.structuredContent as { entry: string }).entry).toBe('blocked@example.com')
    })

    it('passes the four routing values positionally and nothing else', async () => {
        const calls: Call[] = []
        await getListEntry(listsClient(calls), GetListEntryParams.parse({ inboxId: 'inbox_1', direction: 'reply', listType: 'allow', entry: 'example.com' }))
        expect(calls[0]!.args).toEqual(['inbox_1', 'reply', 'allow', 'example.com'])
    })

    it('requires a non-empty entry that is not a dot segment', () => {
        expect(GetListEntryParams.safeParse({ inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: '..' }).success).toBe(false)
        expect(GetListEntryParams.safeParse({ inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: '' }).success).toBe(false)
        expect(GetListEntryParams.safeParse({ inboxId: 'inbox_1', direction: 'send', listType: 'block' }).success).toBe(false)
    })

    it('surfaces a missing entry as the API 404', async () => {
        const client = await connect(
            listsClient([], {
                get: async () => {
                    throw new AgentMailError({ statusCode: 404, body: { name: 'NotFoundError', message: 'ListEntry not found' } })
                },
            })
        )
        const result = await client.callTool({ name: 'get_list_entry', arguments: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'nobody@example.com' } })
        expect(result.isError).toBe(true)
        expect((result.content as Array<{ text: string }>)[0]!.text).toContain('404')
    })
})

describe('create_list_entry', () => {
    it('posts the entry and reason as the body, routing fields positional', async () => {
        const calls: Call[] = []
        const client = await connect(listsClient(calls))
        const result = await client.callTool({
            name: 'create_list_entry',
            arguments: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'blocked@example.com', reason: 'asked by the human' },
        })
        expect(calls).toEqual([{ method: 'lists.create', args: ['inbox_1', 'send', 'block', { entry: 'blocked@example.com', reason: 'asked by the human' }] }])
        expect(result.isError ?? false).toBe(false)
        expect((result.structuredContent as { entry: string }).entry).toBe('blocked@example.com')
        expect(result.structuredContent).not.toHaveProperty('organizationId')
    })

    it('omits reason from the body when not given', async () => {
        const calls: Call[] = []
        await createListEntry(listsClient(calls), CreateListEntryParams.parse({ inboxId: 'inbox_1', direction: 'receive', listType: 'allow', entry: 'example.com' }))
        expect(calls[0]!.args).toEqual(['inbox_1', 'receive', 'allow', { entry: 'example.com' }])
    })

    it('passes a duplicate-entry conflict through with its message', async () => {
        const client = await connect(
            listsClient([], {
                create: async () => {
                    throw new AgentMailError({ statusCode: 409, body: { name: 'ConflictError', message: 'ListEntry already exists' } })
                },
            })
        )
        const result = await client.callTool({ name: 'create_list_entry', arguments: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'blocked@example.com' } })
        expect(result.isError).toBe(true)
        expect((result.content as Array<{ text: string }>)[0]!.text).toContain('already exists')
    })
})

describe('delete_list_entry', () => {
    it('deletes exactly the addressed entry and reports success', async () => {
        const calls: Call[] = []
        const client = await connect(listsClient(calls))
        const result = await client.callTool({
            name: 'delete_list_entry',
            arguments: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'someone@example.com' },
        })
        expect(calls).toEqual([{ method: 'lists.delete', args: ['inbox_1', 'send', 'block', 'someone@example.com'] }])
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toEqual({ success: true })
    })

    it('addresses whichever list the arguments name, never a fixed one', async () => {
        const calls: Call[] = []
        await deleteListEntry(listsClient(calls), DeleteListEntryParams.parse({ inboxId: 'inbox_1', direction: 'receive', listType: 'allow', entry: 'example.com' }))
        expect(calls[0]!.args).toEqual(['inbox_1', 'receive', 'allow', 'example.com'])
    })

    it('passes the read-only suppression refusal through with its remedy text', async () => {
        const client = await connect(
            listsClient([], {
                delete: async () => {
                    throw new AgentMailError({
                        statusCode: 409,
                        body: {
                            name: 'CannotDeleteError',
                            message: 'Cannot delete ListEntry: entry is read-only',
                            fix: 'This entry is an AgentMail suppression. Email support@agentmail.to to have it reviewed.',
                        },
                    })
                },
            })
        )
        const result = await client.callTool({ name: 'delete_list_entry', arguments: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'bounced@example.com' } })
        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ text: string }>)[0]!.text
        expect(text).toContain('suppression')
        expect(text).toContain('support@agentmail.to')
    })

    it('requires a non-empty entry', () => {
        expect(DeleteListEntryParams.safeParse({ inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: '' }).success).toBe(false)
        expect(DeleteListEntryParams.safeParse({ inboxId: 'inbox_1', direction: 'send', listType: 'block' }).success).toBe(false)
    })
})

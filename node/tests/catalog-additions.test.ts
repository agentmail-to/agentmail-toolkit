import { describe, it, expect } from 'vitest'
import { AgentMailError, type AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { tools } from '../src/tools.js'
import {
    ListAccountsParams,
    GetProviderConnectionParams,
    SearchInboxesParams,
    UnblockRecipientParams,
    GetMessageParams,
} from '../src/schemas.js'
import { listAccounts, getProviderConnection, unblockRecipient, searchInboxes, getMessage } from '../src/functions.js'
import { mockClient, account, provider, signInKey, bearerKey, message, inbox } from './fixtures.js'

// The five tools added alongside the api-keys rework, driven the way an MCP host
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
            connect: record('providers.connect', { apiKeyId: signInKey().apiKeyId, magicUrl: 'https://agentid.example/connect#t', expiresAt: new Date('2026-07-10T12:05:00.000Z') }),
        },
        apiKeys: { get: record('apiKeys.get', signInKey()) },
        ...overrides,
    })
}

describe('catalog: the five additions are registered with complete metadata', () => {
    it('lists them in resource order with all five annotations', () => {
        const names = tools.map((t) => t.name)
        expect(names.indexOf('search_inboxes')).toBe(names.indexOf('list_inboxes') + 1)
        expect(names.indexOf('get_message')).toBe(names.indexOf('update_message') + 1)
        expect(names.indexOf('unblock_recipient')).toBe(names.indexOf('auth_me') - 1)
        expect(names.indexOf('list_accounts')).toBeGreaterThan(names.indexOf('get_provider'))
        expect(names[names.length - 1]).toBe('get_provider_connection')
        expect(names).not.toContain('list_provider_accounts')
        for (const name of ['search_inboxes', 'get_message', 'unblock_recipient', 'list_accounts', 'get_provider_connection']) {
            const tool = tools.find((t) => t.name === name)!
            expect(tool.title).toBeTruthy()
            expect(tool.description.length).toBeGreaterThan(40)
            for (const key of ['title', 'readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint']) {
                expect(tool.annotations).toHaveProperty(key)
            }
        }
    })

    it('marks the reads read-only and the block-list removal as a destructive write', () => {
        const by = (name: string) => tools.find((t) => t.name === name)!.annotations
        expect(by('search_inboxes').readOnlyHint).toBe(true)
        expect(by('get_message').readOnlyHint).toBe(true)
        expect(by('get_message').openWorldHint).toBe(true) // external senders' content
        expect(by('list_accounts').readOnlyHint).toBe(true)
        expect(by('get_provider_connection').readOnlyHint).toBe(true)
        expect(by('unblock_recipient').readOnlyHint).toBe(false)
        expect(by('unblock_recipient').destructiveHint).toBe(true)
        expect(by('unblock_recipient').idempotentHint).toBe(true)
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

describe('get_provider_connection', () => {
    it('returns only the sign-in status fields, never the key metadata', async () => {
        const calls: Call[] = []
        const client = await connect(recordingClient(calls))
        const result = await client.callTool({ name: 'get_provider_connection', arguments: { apiKeyId: signInKey().apiKeyId } })
        expect(calls).toEqual([{ method: 'apiKeys.get', args: [signInKey().apiKeyId] }])
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toEqual({
            apiKeyId: signInKey().apiKeyId,
            status: 'pending',
            inboxId: 'agent@agentmail.to',
            expiresAt: '2026-07-10T12:00:00.000Z',
        })
        for (const leaked of ['permissions', 'createdBy', 'podId', 'publicKey', 'name', 'type']) {
            expect(result.structuredContent).not.toHaveProperty(leaked)
        }
    })

    it('projects exactly four fields at the function boundary, before any adapter allowlist', async () => {
        // The MCP path strips through the output schema regardless, so only a direct call
        // proves the function itself drops the key metadata for the other adapters.
        const result = await getProviderConnection(recordingClient([]), { apiKeyId: signInKey().apiKeyId })
        expect(Object.keys(result).sort()).toEqual(['apiKeyId', 'expiresAt', 'inboxId', 'status'])
        expect(result).not.toHaveProperty('permissions')
        expect(result).not.toHaveProperty('createdBy')
        expect(result).not.toHaveProperty('podId')
    })

    it('reports active once the human has finished the browser sign-in', async () => {
        const client = await connect(recordingClient([], { apiKeys: { get: async () => ({ ...signInKey(), status: 'active' }) } }))
        const result = await client.callTool({ name: 'get_provider_connection', arguments: { apiKeyId: signInKey().apiKeyId } })
        expect((result.structuredContent as { status: string }).status).toBe('active')
    })

    it('refuses a bearer key id rather than republishing its metadata', async () => {
        const client = await connect(recordingClient([], { apiKeys: { get: async () => bearerKey() } }))
        const result = await client.callTool({ name: 'get_provider_connection', arguments: { apiKeyId: bearerKey().apiKeyId } })
        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ text: string }>)[0]!.text
        expect(text).toContain('not a provider sign-in key')
        expect(text).not.toContain('am_us_')
        expect(result.structuredContent).toBeUndefined()
    })

    it('refuses a public key without a status the same way', async () => {
        const { status: _status, ...registered } = signInKey()
        await expect(getProviderConnection(recordingClient([], { apiKeys: { get: async () => registered } }), { apiKeyId: 'k' })).rejects.toThrow(
            /not a provider sign-in key/
        )
    })

    it('surfaces the API 404 for an unknown key id with its status', async () => {
        const client = await connect(
            recordingClient([], {
                apiKeys: {
                    get: async () => {
                        throw new AgentMailError({ statusCode: 404, body: { name: 'NotFoundError', message: 'API key not found' } })
                    },
                },
            })
        )
        const result = await client.callTool({ name: 'get_provider_connection', arguments: { apiKeyId: 'missing' } })
        expect(result.isError).toBe(true)
        expect((result.content as Array<{ text: string }>)[0]!.text).toContain('404')
    })

    it('requires a non-empty apiKeyId', () => {
        expect(GetProviderConnectionParams.safeParse({ apiKeyId: '' }).success).toBe(false)
        expect(GetProviderConnectionParams.safeParse({}).success).toBe(false)
        expect(GetProviderConnectionParams.safeParse({ apiKeyId: '..' }).success).toBe(false)
        expect(GetProviderConnectionParams.safeParse({ apiKeyId: '.' }).success).toBe(false)
        expect(ListAccountsParams.safeParse({ providerId: '..' }).success).toBe(false)
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

describe('unblock_recipient', () => {
    it('deletes exactly the send/block entry and reports success', async () => {
        const calls: Call[] = []
        const client = await connect(
            mockClient({
                inboxes: {
                    ...(mockClient() as unknown as { inboxes: Record<string, unknown> }).inboxes,
                    lists: {
                        delete: async (...args: unknown[]) => {
                            calls.push({ method: 'lists.delete', args })
                            return undefined
                        },
                    },
                },
            })
        )
        const result = await client.callTool({ name: 'unblock_recipient', arguments: { inboxId: 'inbox_1', entry: 'someone@example.com' } })
        expect(calls).toEqual([{ method: 'lists.delete', args: ['inbox_1', 'send', 'block', 'someone@example.com'] }])
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toEqual({ success: true })
    })

    it('never touches the allow list or the receive/reply directions', async () => {
        const calls: Call[] = []
        const client = { inboxes: { lists: { delete: async (...args: unknown[]) => { calls.push({ method: 'd', args }) } } } } as unknown as AgentMailClient
        await unblockRecipient(client, UnblockRecipientParams.parse({ inboxId: 'inbox_1', entry: 'example.com' }))
        expect(calls[0]!.args[1]).toBe('send')
        expect(calls[0]!.args[2]).toBe('block')
    })

    it('passes the read-only suppression refusal through with its remedy text', async () => {
        const client = await connect(
            mockClient({
                inboxes: {
                    ...(mockClient() as unknown as { inboxes: Record<string, unknown> }).inboxes,
                    lists: {
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
                    },
                },
            })
        )
        const result = await client.callTool({ name: 'unblock_recipient', arguments: { inboxId: 'inbox_1', entry: 'bounced@example.com' } })
        expect(result.isError).toBe(true)
        const text = (result.content as Array<{ text: string }>)[0]!.text
        expect(text).toContain('suppression')
        expect(text).toContain('support@agentmail.to')
    })

    it('requires a non-empty entry', () => {
        expect(UnblockRecipientParams.safeParse({ inboxId: 'inbox_1', entry: '' }).success).toBe(false)
        expect(UnblockRecipientParams.safeParse({ inboxId: 'inbox_1' }).success).toBe(false)
    })
})

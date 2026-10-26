import { describe, expect, it, vi } from 'vitest'
import { AgentMailClient } from 'agentmail'
import { AgentMailToolkit as BaseToolkit } from '../src/index.js'
import { AgentMailToolkit } from '../src/mcp.js'
import { MessageAuthenticationResultsSchema } from '../src/output-schemas.js'
import { tools } from '../src/tools.js'
import { message, mockClient, thread } from './fixtures.js'

describe('unauthenticated mail discovery', () => {
    it.each(['list_messages', 'list_threads'])('%s exposes an explicit opt-in without changing defaults', async (name) => {
        const client = mockClient()
        const resource = name === 'list_messages' ? client.inboxes.messages : client.inboxes.threads
        const list = vi.spyOn(resource, 'list')
        const tool = tools.find((candidate) => candidate.name === name)!
        const args = { inboxId: 'inbox_1', includeUnauthenticated: true, labels: ['unauthenticated'], limit: 10 }
        await tool.func(client, tool.paramsSchema.parse(args) as never)
        expect(list).toHaveBeenLastCalledWith('inbox_1', expect.objectContaining({ includeUnauthenticated: true, labels: ['unauthenticated'] }))
        await tool.func(client, tool.paramsSchema.parse({ inboxId: 'inbox_1' }) as never)
        expect(list.mock.lastCall?.[1]).not.toHaveProperty('includeUnauthenticated')
        await tool.func(client, tool.paramsSchema.parse({ inboxId: 'inbox_1', includeUnauthenticated: false }) as never)
        expect(list.mock.lastCall?.[1]).toMatchObject({ includeUnauthenticated: false })
    })

    it.each(['messages', 'threads'] as const)('serializes the %s opt-in through the real SDK', async (resource) => {
        const fetcher = vi.fn(
            async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ count: 0, [resource]: [] }), { status: 200 })
        )
        const client = new AgentMailClient({ apiKey: 'test-key', fetch: fetcher as never })
        const tool = tools.find((candidate) => candidate.name === `list_${resource}`)!
        await tool.func(client, tool.paramsSchema.parse({ inboxId: 'inbox_1', includeUnauthenticated: true, includeBlocked: true }) as never)
        expect(String(fetcher.mock.calls[0]?.[0])).toContain('include_unauthenticated=true')
        expect(String(fetcher.mock.calls[0]?.[0])).toContain('include_blocked=true')
    })

    // The SDK reads each include* opt-in off the request, so a Proxy lists them: a restricted
    // label the SDK learns fails here until list_messages and list_threads expose it.
    it.each(['messages', 'threads'] as const)('list_%s exposes every restricted-label opt-in the SDK takes', async (resource) => {
        const client = new AgentMailClient({
            apiKey: 'test-key',
            fetch: (async () => new Response(JSON.stringify({ count: 0, [resource]: [] }), { status: 200 })) as never,
        })
        const read = new Set<string>()
        const request = new Proxy(
            {},
            {
                get: (_target, key) => {
                    read.add(String(key))
                    return undefined
                },
            }
        )
        await client.inboxes[resource].list('inbox_1', request as never)
        const includes = (keys: Iterable<string>) => [...keys].filter((key) => key.startsWith('include')).sort()
        const tool = tools.find((candidate) => candidate.name === `list_${resource}`)!
        expect(includes(read)).toContain('includeUnauthenticated')
        expect(includes(Object.keys(tool.paramsSchema.shape))).toEqual(includes(read))
    })
})

describe('recorded authentication verdicts', () => {
    it('projects verdicts passed through by the installed SDK from a real API-shaped response', async () => {
        const wireMessage = {
            inbox_id: 'inbox_1',
            thread_id: 'thread_1',
            message_id: 'msg_1',
            labels: ['received', 'unauthenticated'],
            timestamp: '2026-07-10T12:00:00.000Z',
            from: 'sender@example.com',
            to: ['agent@agentmail.to'],
            size: 123,
            updated_at: '2026-07-10T12:00:00.000Z',
            created_at: '2026-07-10T12:00:00.000Z',
            authentication_results: { dkim: 'none', spf: 'temperror', spf_domain: 'example.com', private_debug: 'hidden' },
            headers: { 'Authentication-Results': 'attacker supplied; dkim=pass' },
        }
        const client = new AgentMailClient({ apiKey: 'test-key', fetch: (async () => new Response(JSON.stringify(wireMessage), { status: 200 })) as never })
        const tool = new AgentMailToolkit(client).getTools().find((candidate) => candidate.name === 'get_message')!
        const result = await tool.callback({ inboxId: 'inbox_1', messageId: 'msg_1' } as never, {} as never)
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toMatchObject({ authenticationResults: { dkim: 'none', spf: 'temperror', spfDomain: 'example.com' } })
        expect(JSON.stringify(result.structuredContent)).not.toContain('hidden')
        expect(JSON.stringify(result.structuredContent)).not.toContain('attacker supplied')
    })

    it.each(['get_message', 'get_thread'])('%s returns public verdicts without raw headers or diagnostics', async (name) => {
        const client = mockClient()
        const received = {
            ...message(),
            labels: ['received', 'unread', 'unauthenticated'],
            authentication_results: { dkim: 'none', dmarc: 'fail', dmarc_domain: 'example.com', private_debug: 'never expose' },
        }
        vi.spyOn(client.inboxes.messages, 'get').mockResolvedValue(received as never)
        vi.spyOn(client.inboxes.threads, 'get').mockResolvedValue({ ...thread(), messages: [received] } as never)
        const tool = new AgentMailToolkit(client).getTools().find((candidate) => candidate.name === name)!
        const result = await tool.callback({ inboxId: 'inbox_1', messageId: 'msg_1', threadId: 'thread_1' } as never, {} as never)
        expect(result.isError ?? false).toBe(false)
        const output = result.structuredContent as Record<string, unknown>
        const actual = name === 'get_thread' ? (output.messages as Record<string, unknown>[])[0] : output
        expect(actual.authenticationResults).toEqual({ dkim: 'none', dmarc: 'fail', dmarcDomain: 'example.com' })
        expect(actual.labels).toContain('unauthenticated')
        expect(actual).not.toHaveProperty('headers')
        expect(actual).not.toHaveProperty('authentication_results')
        expect(actual).not.toHaveProperty('organization_id')
        expect(JSON.stringify(actual)).not.toContain('never expose')
        expect(actual.authenticationResults).not.toHaveProperty('spf')
    })

    it('reads a thread whose verdict is one it does not know, dropping values that are not strings', async () => {
        const client = mockClient()
        const received = { ...message(), authentication_results: { dkim: 'policy', spf: 42, dmarc: null } }
        vi.spyOn(client.inboxes.threads, 'get').mockResolvedValue({ ...thread(), messages: [received] } as never)
        const tool = new AgentMailToolkit(client).getTools().find((candidate) => candidate.name === 'get_thread')!
        const result = await tool.callback({ inboxId: 'inbox_1', threadId: 'thread_1' } as never, {} as never)
        expect(result.isError ?? false).toBe(false)
        const [first] = (result.structuredContent as { messages: Record<string, unknown>[] }).messages
        expect(first?.authenticationResults).toEqual({ dkim: 'policy' })
        expect(first?.authenticationResults).not.toHaveProperty('spf')
    })

    // The base toolkit returns the func result as is, like the ai-sdk, LangChain and clawdbot
    // adapters, so it shows exactly what the projection lets through.
    const getMessageFromBaseToolkit = async (received: object) => {
        const client = mockClient()
        vi.spyOn(client.inboxes.messages, 'get').mockResolvedValue(received as never)
        const tool = new BaseToolkit(client).getTools().find((candidate) => candidate.name === 'get_message')!
        return (await tool.func({ inboxId: 'inbox_1', messageId: 'msg_1' })) as Record<string, unknown>
    }

    it('filters the camelCase field an SDK that types authenticationResults returns', async () => {
        const result = await getMessageFromBaseToolkit({ ...message(), authenticationResults: { dkim: 'pass', dkimDomain: 'example.com', private_debug: 'leak' } })
        expect(result.authenticationResults).toStrictEqual({ dkim: 'pass', dkimDomain: 'example.com' })
    })

    it('gives adapters that do not strip undeclared fields only the projected copy', async () => {
        const result = await getMessageFromBaseToolkit({ ...message(), authentication_results: { spf: 'pass', private_debug: 'never expose' } })
        expect(result).not.toHaveProperty('authentication_results')
        expect(result.authenticationResults).toStrictEqual({ spf: 'pass' })
        expect(JSON.stringify(result)).not.toContain('never expose')
    })

    it('maps every key MessageAuthenticationResultsSchema declares from its snake_case wire name', async () => {
        const keys = Object.keys(MessageAuthenticationResultsSchema.shape)
        const wire = Object.fromEntries(keys.map((key) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), key]))
        const result = await getMessageFromBaseToolkit({ ...message(), authentication_results: wire })
        expect(result.authenticationResults).toStrictEqual(Object.fromEntries(keys.map((key) => [key, key])))
    })

    it.each(['list_messages', 'search_messages'] as const)('%s items carry projected verdicts on every adapter', async (name) => {
        const client = mockClient()
        const item = { ...message(), authentication_results: { dkim: 'none', private_debug: 'leak' } }
        const page = { count: 1, messages: [item] }
        vi.spyOn(client.inboxes.messages, name === 'list_messages' ? 'list' : 'search').mockResolvedValue(page as never)
        const args = { inboxId: 'inbox_1', q: 'invoice' }

        const base = new BaseToolkit(client).getTools().find((candidate) => candidate.name === name)!
        const [baseItem] = ((await base.func(args)) as { messages: Record<string, unknown>[] }).messages
        expect(baseItem).not.toHaveProperty('authentication_results')
        expect(baseItem?.authenticationResults).toStrictEqual({ dkim: 'none' })

        const mcp = new AgentMailToolkit(client).getTools().find((candidate) => candidate.name === name)!
        const result = await mcp.callback(args as never, {} as never)
        expect(result.isError ?? false).toBe(false)
        const [mcpItem] = (result.structuredContent as { messages: Record<string, unknown>[] }).messages
        expect(mcpItem?.authenticationResults).toEqual({ dkim: 'none' })
        expect(JSON.stringify(result.structuredContent)).not.toContain('leak')
    })
})

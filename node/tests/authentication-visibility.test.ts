import { describe, expect, it, vi } from 'vitest'
import { AgentMailClient } from 'agentmail'
import { AgentMailToolkit } from '../src/mcp.js'
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
        await tool.func(client, tool.paramsSchema.parse({ inboxId: 'inbox_1', includeUnauthenticated: true }) as never)
        expect(String(fetcher.mock.calls[0]?.[0])).toContain('include_unauthenticated=true')
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
})

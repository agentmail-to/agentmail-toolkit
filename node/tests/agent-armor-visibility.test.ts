import { describe, expect, it, vi } from 'vitest'
import { AgentMailClient } from 'agentmail'
import { AgentMailToolkit } from '../src/mcp.js'
import { message, mockClient, thread } from './fixtures.js'

const complete = {
    status: 'complete',
    verdict: 'review',
    reason: 'Requests an unrelated action',
    model: 'test-model',
    completed_at: '2026-10-30T10:00:00.000Z',
    scan_id: 'private-scan',
    input_token_count: 123,
    raw_response: 'private scorer response',
}

describe('Agent Armor visibility in MCP', () => {
    it.each(['get_message', 'list_messages', 'search_messages', 'get_thread'])('%s preserves public results and strips internal fields', async (name) => {
        const client = mockClient()
        const m = { ...message(), agent_armor: complete }
        vi.spyOn(client.inboxes.messages, 'get').mockResolvedValue(m as never)
        vi.spyOn(client.inboxes.messages, 'list').mockResolvedValue({ count: 1, messages: [m] } as never)
        vi.spyOn(client.inboxes.messages, 'search').mockResolvedValue({ count: 1, messages: [m] } as never)
        vi.spyOn(client.inboxes.threads, 'get').mockResolvedValue({ ...thread(), messages: [m] } as never)
        const tool = new AgentMailToolkit(client).getTools().find((t) => t.name === name)!
        const result = await tool.callback({ inboxId: 'inbox_1', messageId: 'msg_1', threadId: 'thread_1', q: 'test' } as never, {} as never)
        expect(result.isError ?? false).toBe(false)
        const content = result.structuredContent as Record<string, unknown>
        const found = (content.messages ? (content.messages as Record<string, unknown>[])[0] : content)!
        expect(found.agentArmor).toEqual({
            status: 'complete',
            verdict: 'review',
            reason: 'Requests an unrelated action',
            model: 'test-model',
            completedAt: '2026-10-30T10:00:00.000Z',
        })
        expect(JSON.stringify(result)).not.toMatch(/private-scan|private scorer|input_token_count|agent_armor|headers/)
    })

    it.each([
        { status: 'pending', started_at: '2026-10-30T10:00:00.000Z', deadline_at: '2026-10-30T10:15:00.000Z' },
        complete,
        { status: 'unavailable', unavailable_reason: 'deadline_exceeded' },
    ])('reads $status results through the real installed SDK', async (agent_armor) => {
        const wire = {
            inbox_id: 'inbox_1',
            thread_id: 'thread_1',
            message_id: 'msg_1',
            from: 'sender@example.com',
            labels: ['received'],
            timestamp: '2026-10-30T10:00:00Z',
            created_at: '2026-10-30T10:00:00Z',
            updated_at: '2026-10-30T10:00:00Z',
            size: 1,
            agent_armor,
        }
        const client = new AgentMailClient({ apiKey: 'test-key', fetch: (async () => new Response(JSON.stringify(wire), { status: 200 })) as never })
        const tool = new AgentMailToolkit(client).getTools().find((t) => t.name === 'get_message')!
        const result = await tool.callback({ inboxId: 'inbox_1', messageId: 'msg_1' } as never, {} as never)
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toMatchObject({ agentArmor: { status: agent_armor.status } })
    })

    it('keeps camelCase dates and only public manual-release audit fields', async () => {
        const client = mockClient()
        vi.spyOn(client.inboxes.messages, 'get').mockResolvedValue({
            ...message(),
            agentArmor: {
                ...complete,
                completedAt: new Date('2026-10-30T10:00:00Z'),
                manualOverride: {
                    overrideId: 'release_1',
                    actor: { kind: 'console', private_user: 'hidden' },
                    reason: 'Reviewed by a person',
                    originalVerdict: 'review',
                    releasedAt: new Date('2026-10-30T10:05:00Z'),
                    private_audit: 'hidden',
                },
            },
        } as never)
        const tool = new AgentMailToolkit(client).getTools().find((t) => t.name === 'get_message')!
        const result = await tool.callback({ inboxId: 'inbox_1', messageId: 'msg_1' } as never, {} as never)
        expect(result.structuredContent).toMatchObject({
            agentArmor: { completedAt: '2026-10-30T10:00:00.000Z', manualOverride: { actor: { kind: 'console' }, releasedAt: '2026-10-30T10:05:00.000Z' } },
        })
        expect(JSON.stringify(result)).not.toContain('hidden')
    })

    it('keeps malformed or future scan states explicitly unavailable', async () => {
        const client = mockClient()
        vi.spyOn(client.inboxes.messages, 'get').mockResolvedValue({ ...message(), agent_armor: { status: 'new_state', verdict: 'clear' } } as never)
        const tool = new AgentMailToolkit(client).getTools().find((t) => t.name === 'get_message')!
        const result = await tool.callback({ inboxId: 'inbox_1', messageId: 'msg_1' } as never, {} as never)
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toMatchObject({ agentArmor: { status: 'unavailable', unavailableReason: 'contract_error' } })
    })
})

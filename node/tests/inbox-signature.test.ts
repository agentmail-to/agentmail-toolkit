import { describe, expect, it, vi } from 'vitest'
import { AgentMailClient } from 'agentmail'
import { InboxSchema } from '../src/output-schemas.js'
import { tools } from '../src/tools.js'
import { inbox } from './fixtures.js'

const SIGNATURE = { text: 'Ava, Acme Support\nacme.com', html: '<b>Ava</b>, Acme Support' }

// The real SDK over a stubbed fetch, so the assertion is the request body the API receives.
const call = async (name: string, args: unknown) => {
    const fetcher = vi.fn(
        async (_url: RequestInfo | URL, _init?: RequestInit) =>
            new Response(
                JSON.stringify({
                    inbox_id: 'inbox_1',
                    pod_id: 'pod_1',
                    email: 'a@agentmail.to',
                    updated_at: '2026-10-29T00:00:00Z',
                    created_at: '2026-10-29T00:00:00Z',
                }),
                {
                    status: 200,
                }
            )
    )
    const client = new AgentMailClient({ apiKey: 'test-key', fetch: fetcher as never })
    const tool = tools.find((candidate) => candidate.name === name)!
    await tool.func(client, tool.paramsSchema.parse(args) as never)
    return JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
}

describe('inbox signature', () => {
    it('create_inbox sends it', async () => {
        expect(await call('create_inbox', { signature: SIGNATURE })).toMatchObject({ signature: SIGNATURE })
    })

    it('update_inbox sets it, removes it with null, and leaves it alone when omitted', async () => {
        expect(await call('update_inbox', { inboxId: 'inbox_1', signature: { text: 'Ava' } })).toEqual({ signature: { text: 'Ava' } })
        expect(await call('update_inbox', { inboxId: 'inbox_1', signature: null })).toEqual({ signature: null })
        expect(await call('update_inbox', { inboxId: 'inbox_1', displayName: 'Ava' })).not.toHaveProperty('signature')
    })

    it('reaches agents in inbox results instead of being stripped', () => {
        // Tool results reach the schema JSON-encoded, so dates arrive as strings.
        const result = JSON.parse(JSON.stringify({ ...inbox(), signature: SIGNATURE }))
        expect(InboxSchema.parse(result).signature).toEqual(SIGNATURE)
    })
})

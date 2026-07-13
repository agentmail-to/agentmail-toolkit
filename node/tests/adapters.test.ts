import { describe, it, expect, vi } from 'vitest'
import { AgentMailError } from 'agentmail'

import { AgentMailToolkit as GenericToolkit } from '../src/index.js'
import { AgentMailToolkit as AiSdkToolkit } from '../src/ai-sdk.js'
import { AgentMailToolkit as LangchainToolkit } from '../src/langchain.js'
import { AgentMailToolkit as ClawdbotToolkit } from '../src/clawdbot.js'
import { mockClient, inbox } from './fixtures.js'

// Every adapter must signal failures through its framework's native mechanism
// (never an error message dressed up as a successful result), with the same
// concise, bounded message - not the SDK's raw multi-line dump.
const CONCISE = 'inbox not found (HTTP 404)'

function failingClient() {
    const client = mockClient()
    ;(client.inboxes as { get: unknown }).get = async () => {
        throw new AgentMailError({
            message: 'Status code: 404\nBody: {...raw dump...}',
            statusCode: 404,
            body: { name: 'NotFoundError', message: 'inbox not found' },
        })
    }
    return client
}

describe('generic toolkit', () => {
    it('returns the raw SDK result and exposes schemas', async () => {
        const tools = new GenericToolkit(mockClient()).getTools()
        const listInboxes = tools.find((t) => t.name === 'list_inboxes')!
        expect(listInboxes.paramsSchema).toBeDefined()
        expect(listInboxes.outputSchema).toBeDefined()
        const result = (await listInboxes.func({})) as { count: number }
        expect(result.count).toBe(1)
    })

    it('throws a concise Error on API failure', async () => {
        const tools = new GenericToolkit(failingClient()).getTools()
        const getInbox = tools.find((t) => t.name === 'get_inbox')!
        await expect(getInbox.func({ inboxId: 'nope' })).rejects.toThrow(CONCISE)
    })
})

describe('ai-sdk adapter', () => {
    it('returns a normalized object result and carries the output schema', async () => {
        const tools = new AiSdkToolkit(mockClient()).getTools()
        const getInbox = tools['get_inbox']
        expect(getInbox.outputSchema).toBeDefined()
        const result = (await getInbox.execute!({ inboxId: 'inbox_1' }, { toolCallId: 't1', messages: [] })) as Record<string, unknown>
        expect(result).toEqual({ ...inbox(), createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-10T12:00:00.000Z' })
    })

    it('throws on API failure so the ai SDK emits its native tool-error part', async () => {
        const tools = new AiSdkToolkit(failingClient()).getTools()
        await expect(tools['get_inbox'].execute!({ inboxId: 'nope' }, { toolCallId: 't1', messages: [] })).rejects.toThrow(CONCISE)
    })
})

describe('langchain adapter', () => {
    it('returns a JSON string result', async () => {
        const tools = new LangchainToolkit(mockClient()).getTools()
        const listInboxes = tools.find((t) => t.name === 'list_inboxes')!
        const result = await listInboxes.invoke({})
        expect(JSON.parse(result as string).count).toBe(1)
    })

    it('rejects on API failure instead of returning an error string as success', async () => {
        const tools = new LangchainToolkit(failingClient()).getTools()
        const getInbox = tools.find((t) => t.name === 'get_inbox')!
        await expect(getInbox.invoke({ inboxId: 'nope' })).rejects.toThrow(CONCISE)
    })
})

describe('clawdbot adapter', () => {
    it('returns text content plus raw details, with a JSON Schema parameters object', async () => {
        const tools = new ClawdbotToolkit(mockClient()).getTools()
        const listInboxes = tools.find((t) => t.name === 'list_inboxes')!
        expect((listInboxes.parameters as unknown as { type: string }).type).toBe('object')
        const result = await listInboxes.execute('call_1', {}, undefined as never)
        expect(result.content[0]).toEqual({ type: 'text', text: expect.stringContaining('"count":1') })
    })

    it('throws a concise Error so the agent loop marks the result as errored', async () => {
        const tools = new ClawdbotToolkit(failingClient()).getTools()
        const getInbox = tools.find((t) => t.name === 'get_inbox')!
        await expect(getInbox.execute('call_1', { inboxId: 'nope' }, undefined as never)).rejects.toThrow(CONCISE)
    })
})

describe('cross-adapter error conciseness', () => {
    it('never surfaces the raw SDK dump', async () => {
        const spy = vi.fn()
        const tools = new GenericToolkit(failingClient()).getTools()
        const getInbox = tools.find((t) => t.name === 'get_inbox')!
        await getInbox.func({ inboxId: 'nope' }).catch((err: Error) => spy(err.message))
        expect(spy).toHaveBeenCalledWith(CONCISE)
        expect(spy).not.toHaveBeenCalledWith(expect.stringContaining('raw dump'))
    })
})

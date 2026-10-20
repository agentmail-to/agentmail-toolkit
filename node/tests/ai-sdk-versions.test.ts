import { describe, it, expect } from 'vitest'
import { AgentMailError } from 'agentmail'
import { generateText as generateTextV6, stepCountIs as stepCountIsV6 } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { generateText as generateTextV7, stepCountIs as stepCountIsV7, type ToolSet as ToolSetV7 } from 'ai-v7'
import { MockLanguageModelV4 } from 'ai-v7/test'

import { AgentMailToolkit } from '../src/ai-sdk.js'
import { mockClient } from './fixtures.js'

// The `ai` peer range spans two majors, so the adapter's tools are driven through each
// major's real `generateText` tool loop - not just `execute()` called by hand - to prove
// the tool shape, result normalization, and native `tool-error` signaling hold on both.

const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
}

// Step 1 calls `get_inbox`; step 2 ends the loop with text once the tool has run.
function scriptedModel(onFirstCall: (toolNames: string[]) => void) {
    let step = 0
    return async (options: { tools?: { name: string }[] }) => {
        if (step++ === 0) {
            onFirstCall((options.tools ?? []).map((t) => t.name))
            return {
                content: [{ type: 'tool-call' as const, toolCallId: 'call_1', toolName: 'get_inbox', input: '{"inboxId":"inbox_1"}' }],
                finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
                usage,
                warnings: [],
            }
        }
        return { content: [{ type: 'text' as const, text: 'done' }], finishReason: { unified: 'stop' as const, raw: 'stop' }, usage, warnings: [] }
    }
}

type Run = (client: ReturnType<typeof mockClient>, onFirstCall: (toolNames: string[]) => void) => Promise<{ type: string; output?: unknown; error?: unknown }[]>

const majors: [string, Run][] = [
    [
        'ai@6',
        async (client, onFirstCall) => {
            const result = await generateTextV6({
                model: new MockLanguageModelV3({ doGenerate: scriptedModel(onFirstCall) as never }),
                prompt: 'Get inbox_1',
                tools: new AgentMailToolkit(client).getTools(),
                stopWhen: stepCountIsV6(3),
            })
            return result.steps.flatMap((s) => s.content)
        },
    ],
    [
        'ai@7',
        async (client, onFirstCall) => {
            const result = await generateTextV7({
                model: new MockLanguageModelV4({ doGenerate: scriptedModel(onFirstCall) as never }),
                prompt: 'Get inbox_1',
                // In this repo `ai` is v6, so the adapter's declared `Tool` is v6's. In a consumer's
                // install `ai` resolves to v7 and the same declaration names v7's `Tool`.
                tools: new AgentMailToolkit(client).getTools() as unknown as ToolSetV7,
                stopWhen: stepCountIsV7(3),
            })
            return result.steps.flatMap((s) => s.content)
        },
    ],
]

describe.each(majors)('ai-sdk adapter on %s', (_, run) => {
    it('exposes every tool to the model and returns a normalized tool-result', async () => {
        let toolNames: string[] = []
        const parts = await run(mockClient(), (names) => (toolNames = names))

        expect(toolNames).toEqual(Object.keys(new AgentMailToolkit(mockClient()).getTools()))
        expect(toolNames).toContain('get_inbox')

        const result = parts.find((p) => p.type === 'tool-result')
        expect(result?.output).toMatchObject({ inboxId: 'inbox_1', createdAt: '2026-07-10T12:00:00.000Z' })
        expect(parts.some((p) => p.type === 'tool-error')).toBe(false)
    })

    it('surfaces an API failure as a native tool-error part with the concise message', async () => {
        const client = mockClient()
        ;(client.inboxes as { get: unknown }).get = async () => {
            throw new AgentMailError({
                message: 'Status code: 404\nBody: {...raw dump...}',
                statusCode: 404,
                body: { name: 'NotFoundError', message: 'inbox not found' },
            })
        }
        const parts = await run(client, () => {})

        expect(parts.some((p) => p.type === 'tool-result')).toBe(false)
        const error = parts.find((p) => p.type === 'tool-error')?.error
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('inbox not found (HTTP 404)')
    })
})

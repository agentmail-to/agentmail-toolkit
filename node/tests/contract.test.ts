import { describe, it, expect, vi } from 'vitest'
import { type AgentMailClient } from 'agentmail'
import { z, toJSONSchema } from 'zod'

import { replyToMessage } from '../src/functions.js'
import { tools } from '../src/tools.js'
import { normalize } from '../src/util.js'
import { fixtureByTool, argsByTool } from './fixtures.js'

const ANNOTATION_KEYS = ['title', 'readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const

// Matches the clawdbot adapter's conversion options: params schemas contain
// z.coerce.date() pipes whose output type is unrepresentable in JSON Schema.
const toInputJsonSchema = (schema: z.ZodType) => toJSONSchema(schema, { unrepresentable: 'any' })

describe('canonical tool catalog', () => {
    it('has every tool covered by a fixture and args entry', () => {
        expect(Object.keys(fixtureByTool).sort()).toEqual(tools.map((t) => t.name).sort())
        expect(Object.keys(argsByTool).sort()).toEqual(tools.map((t) => t.name).sort())
    })

    it('has unique names and deterministic ordering', () => {
        const names = tools.map((t) => t.name)
        expect(new Set(names).size).toBe(names.length)
        // Grouped by resource: inboxes, threads, messages, drafts, auth.
        expect(names[0]).toBe('list_inboxes')
        expect(names[names.length - 1]).toBe('auth_me')
    })
})

describe.each(tools.map((tool) => [tool.name, tool] as const))('%s', (_name, tool) => {
    it('has a title and description', () => {
        expect(tool.title.length).toBeGreaterThan(0)
        expect(tool.description.length).toBeGreaterThan(0)
    })

    it('has all five annotations explicit', () => {
        for (const key of ANNOTATION_KEYS) {
            expect(tool.annotations, `missing annotation ${key}`).toHaveProperty(key)
        }
        expect(tool.annotations.title).toBe(tool.title)
        for (const key of ANNOTATION_KEYS.slice(1)) {
            expect(typeof tool.annotations[key], `${key} must be boolean`).toBe('boolean')
        }
    })

    it('has coherent annotations', () => {
        if (tool.annotations.readOnlyHint) {
            expect(tool.annotations.destructiveHint, 'read-only tools must not be destructive').toBe(false)
            expect(tool.annotations.idempotentHint, 'read-only tools must be idempotent').toBe(true)
        }
        if (tool.name === 'delete_thread') {
            // A second delete_thread call on an already-trashed thread permanently
            // purges it - a qualitatively more severe, non-recoverable action than the
            // first call's soft-trash - see node-audit.md section 3b. Must stay false.
            expect(tool.annotations.idempotentHint, 'delete_thread must not claim idempotency').toBe(false)
        }
    })

    it('input schema converts to a root-object JSON Schema', () => {
        const json = toInputJsonSchema(tool.paramsSchema) as { type?: string }
        expect(json.type).toBe('object')
    })

    it('output schema converts to a root-object JSON Schema with a strict root', () => {
        // Strict (additionalProperties:false) is safe because mcp.ts strip-parses every
        // result before returning it, so a future SDK field is dropped rather than
        // failing validation - and it's required: loose schemas let undeclared API
        // fields (raw headers, organization_id, debug data) reach the model, the
        // data-minimization failure OpenAI app review rejects.
        const json = toJSONSchema(tool.outputSchema) as { type?: string; additionalProperties?: unknown }
        expect(json.type).toBe('object')
        expect(json.additionalProperties).toBe(false)
    })

    it('accepts its representative SDK-shaped fixture (after normalize)', () => {
        const result = tool.outputSchema.safeParse(normalize(fixtureByTool[tool.name]()))
        expect(result.error?.issues ?? []).toEqual([])
        expect(result.success).toBe(true)
    })

    it('rejects an empty result object', () => {
        expect(tool.outputSchema.safeParse({}).success).toBe(false)
    })

    it('rejects its fixture with a corrupted required field', () => {
        const fixture = normalize(fixtureByTool[tool.name]()) as Record<string, unknown>
        // Corrupt a DECLARED field: undeclared fixture keys (SDK passthrough
        // internals) are stripped, so corrupting them can't and shouldn't fail.
        const requiredKey = Object.keys(fixture).find((key) => key in tool.outputSchema.shape)!
        const corrupted = { ...fixture, [requiredKey]: { unexpected: 'object' } }
        expect(tool.outputSchema.safeParse(corrupted).success).toBe(false)
    })

    it('accepts its minimal call arguments', () => {
        expect(tool.paramsSchema.safeParse(argsByTool[tool.name]).success).toBe(true)
    })
})

it('keeps every tool annotation exactly unchanged', () => {
    const actual = Object.fromEntries(
        tools.map((tool) => [
            tool.name,
            [
                tool.annotations.title,
                tool.annotations.readOnlyHint,
                tool.annotations.destructiveHint,
                tool.annotations.idempotentHint,
                tool.annotations.openWorldHint,
            ],
        ])
    )
    expect(actual).toEqual({
        list_inboxes: ['List Inboxes', true, false, true, false],
        get_inbox: ['Get Inbox', true, false, true, false],
        create_inbox: ['Create Inbox', false, false, false, false],
        update_inbox: ['Update Inbox', false, true, true, false],
        delete_inbox: ['Delete Inbox', false, true, true, false],
        list_threads: ['List Threads', true, false, true, true],
        search_threads: ['Search Threads', true, false, true, true],
        get_thread: ['Get Thread', true, false, true, true],
        get_attachment: ['Get Attachment', true, false, true, true],
        update_thread: ['Update Thread', false, true, true, false],
        delete_thread: ['Delete Thread', false, true, false, false],
        list_messages: ['List Messages', true, false, true, true],
        search_messages: ['Search Messages', true, false, true, true],
        send_message: ['Send Message', false, true, false, true],
        reply_to_message: ['Reply To Message', false, true, false, true],
        forward_message: ['Forward Message', false, true, false, true],
        update_message: ['Update Message', false, true, true, false],
        create_draft: ['Create Draft', false, false, false, false],
        list_drafts: ['List Drafts', true, false, true, false],
        get_draft: ['Get Draft', true, false, true, false],
        update_draft: ['Update Draft', false, true, true, false],
        send_draft: ['Send Draft', false, true, false, true],
        delete_draft: ['Delete Draft', false, true, true, false],
        auth_me: ['Auth Me', true, false, true, false],
    })
})

// The attachment content/url exclusivity must be STRUCTURAL in the advertised JSON
// Schema (anyOf: requires content | requires url) - description-only exclusivity kept
// tripping OpenAI app review's "Unclear Arguments" analyzer on send/reply/forward/draft.
describe.each(['send_message', 'reply_to_message', 'forward_message', 'create_draft'])(
    '%s attachment content/url exclusivity',
    (toolName) => {
        const tool = tools.find((candidate) => candidate.name === toolName)!

        it('advertises two strict branches that each require exactly one source', () => {
            const json = toInputJsonSchema(tool.paramsSchema) as {
                type?: string
                properties: {
                    attachments: {
                        items: {
                            anyOf?: Array<{ required?: string[]; additionalProperties?: boolean }>
                        }
                    }
                }
            }
            expect(json.type).toBe('object')
            const variants = json.properties.attachments.items.anyOf!
            expect(variants).toHaveLength(2)
            expect(variants[0]).toMatchObject({ required: ['content'], additionalProperties: false })
            expect(variants[1]).toMatchObject({ required: ['url'], additionalProperties: false })
        })

        it('accepts either source and rejects both or neither at runtime', () => {
            const args = (attachment: Record<string, unknown>) => ({
                ...argsByTool[toolName],
                attachments: [{ filename: 'a.txt', ...attachment }],
            })
            expect(tool.paramsSchema.safeParse(args({ content: 'aGk=' })).success).toBe(true)
            expect(tool.paramsSchema.safeParse(args({ url: 'https://example.com/a.txt' })).success).toBe(true)
            expect(tool.paramsSchema.safeParse(args({})).success).toBe(false)
            expect(tool.paramsSchema.safeParse(args({ content: 'aGk=', url: 'https://example.com/a.txt' })).success).toBe(false)
        })
    }
)

describe('reply recipient routing', () => {
    const replyTool = tools.find((tool) => tool.name === 'reply_to_message')!

    it('keeps one strict root object and nests the discriminated recipient variants', () => {
        const json = toInputJsonSchema(replyTool.paramsSchema) as {
            type?: string
            oneOf?: unknown
            anyOf?: unknown
            additionalProperties?: boolean
            properties: {
                recipients: {
                    oneOf?: Array<{ required?: string[]; additionalProperties?: boolean }>
                }
            }
        }
        expect(json).toMatchObject({ type: 'object', additionalProperties: false })
        expect(json.oneOf).toBeUndefined()
        expect(json.anyOf).toBeUndefined()
        expect(json.properties.recipients.oneOf).toEqual([
            expect.objectContaining({ required: ['mode'], additionalProperties: false }),
            expect.objectContaining({ required: ['mode', 'to'], additionalProperties: false }),
        ])
    })

    it('accepts sender-default, all, and nonempty custom modes but rejects ambiguous legacy fields', () => {
        const base = argsByTool.reply_to_message
        expect(replyTool.paramsSchema.safeParse(base).success).toBe(true)
        expect(replyTool.paramsSchema.safeParse({ ...base, recipients: { mode: 'all' } }).success).toBe(true)
        expect(replyTool.paramsSchema.safeParse({ ...base, recipients: { mode: 'custom', to: ['custom@example.com'] } }).success).toBe(true)
        expect(replyTool.paramsSchema.safeParse({ ...base, recipients: { mode: 'custom', to: [] } }).success).toBe(false)
        expect(replyTool.paramsSchema.safeParse({ ...base, recipients: { mode: 'all', to: ['conflict@example.com'] } }).success).toBe(false)
        expect(replyTool.paramsSchema.safeParse({ ...base, replyAll: true }).success).toBe(false)
        expect(replyTool.paramsSchema.safeParse({ ...base, to: ['legacy@example.com'] }).success).toBe(false)
    })

    it('maps the three modes to the matching SDK operations without leaking mode', async () => {
        const reply = vi.fn(async () => ({ messageId: 'msg_1', threadId: 'thread_1' }))
        const replyAll = vi.fn(async () => ({ messageId: 'msg_1', threadId: 'thread_1' }))
        const client = { inboxes: { messages: { reply, replyAll } } } as unknown as AgentMailClient
        const base = { inboxId: 'inbox_1', messageId: 'msg_1', text: 'hello' }

        await replyToMessage(client, base)
        await replyToMessage(client, { ...base, recipients: { mode: 'all' } })
        await replyToMessage(client, {
            ...base,
            recipients: {
                mode: 'custom',
                to: ['to@example.com'],
                cc: ['cc@example.com'],
                bcc: ['bcc@example.com'],
            },
        })

        expect(replyAll).toHaveBeenCalledOnce()
        expect(replyAll).toHaveBeenCalledWith('inbox_1', 'msg_1', { text: 'hello' })
        expect(reply).toHaveBeenNthCalledWith(1, 'inbox_1', 'msg_1', { text: 'hello' })
        expect(reply).toHaveBeenNthCalledWith(2, 'inbox_1', 'msg_1', {
            text: 'hello',
            to: ['to@example.com'],
            cc: ['cc@example.com'],
            bcc: ['bcc@example.com'],
        })
    })
})

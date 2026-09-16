import { describe, it, expect } from 'vitest'
import { z, toJSONSchema } from 'zod'

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
        // Grouped by resource: inboxes, threads, messages, drafts, lists, auth, agent, providers.
        expect(names[0]).toBe('list_inboxes')
        expect(names[names.length - 1]).toBe('connect_provider')
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

// The attachment content/url exclusivity must be STRUCTURAL in the advertised JSON
// Schema (anyOf: requires content | requires url) - description-only exclusivity kept
// tripping OpenAI app review's "Unclear Arguments" analyzer on send/reply/forward/draft.
describe('attachment content/url exclusivity', () => {
    const sendMessage = tools.find((t) => t.name === 'send_message')!

    it('advertises an anyOf where each variant requires exactly one of content or url', () => {
        const json = toInputJsonSchema(sendMessage.paramsSchema) as {
            properties: { attachments: { items: { anyOf?: Array<{ required?: string[] }> } } }
        }
        const variants = json.properties.attachments.items.anyOf!
        expect(variants).toHaveLength(2)
        expect(variants[0].required).toContain('content')
        expect(variants[0].required).not.toContain('url')
        expect(variants[1].required).toContain('url')
        expect(variants[1].required).not.toContain('content')
    })

    it('accepts a content-only or url-only attachment and rejects one with neither or both', () => {
        const args = (attachments: unknown[]) => ({ ...argsByTool.send_message, attachments })
        expect(sendMessage.paramsSchema.safeParse(args([{ filename: 'a.txt', content: 'aGk=' }])).success).toBe(true)
        expect(sendMessage.paramsSchema.safeParse(args([{ filename: 'a.txt', url: 'https://example.com/a.txt' }])).success).toBe(true)
        expect(sendMessage.paramsSchema.safeParse(args([{ filename: 'a.txt' }])).success).toBe(false)
        // Both provided must be a hard failure (mirrors the API's SendAttachmentSchema
        // refine) - not accepted with one field silently dropped.
        expect(
            sendMessage.paramsSchema.safeParse(args([{ filename: 'a.txt', content: 'aGk=', url: 'https://example.com/a.txt' }])).success
        ).toBe(false)
    })
})

// replyAll is strictly mutually exclusive with to/cc/bcc - the API's
// ReplyMessageSchema refine rejects the combination. MCP input roots must be plain
// object shapes (no root union), so the rule lives in a schema refine enforced at
// runtime by runTool (the SDK's rebuilt root object drops refines).
describe('replyAll recipient exclusivity', () => {
    const reply = tools.find((t) => t.name === 'reply_to_message')!

    it('rejects replyAll combined with to/cc/bcc, accepts each alone', () => {
        const base = argsByTool.reply_to_message
        expect(reply.paramsSchema.safeParse({ ...base, replyAll: true }).success).toBe(true)
        expect(reply.paramsSchema.safeParse({ ...base, to: ['a@example.com'] }).success).toBe(true)
        expect(reply.paramsSchema.safeParse({ ...base, replyAll: true, to: ['a@example.com'] }).success).toBe(false)
        expect(reply.paramsSchema.safeParse({ ...base, replyAll: true, cc: ['a@example.com'] }).success).toBe(false)
        expect(reply.paramsSchema.safeParse({ ...base, replyAll: true, bcc: ['a@example.com'] }).success).toBe(false)
        // replyAll: false composes with explicit recipients (only true is exclusive)
        expect(reply.paramsSchema.safeParse({ ...base, replyAll: false, to: ['a@example.com'] }).success).toBe(true)
    })
})

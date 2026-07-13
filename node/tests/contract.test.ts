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

    it('output schema converts to a root-object JSON Schema without additionalProperties:false', () => {
        const json = toJSONSchema(tool.outputSchema) as { type?: string; additionalProperties?: unknown }
        expect(json.type).toBe('object')
        expect(json.additionalProperties, 'a future SDK field must not break structuredContent validation').not.toBe(false)
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
        const requiredKey = Object.keys(fixture)[0]
        const corrupted = { ...fixture, [requiredKey]: { unexpected: 'object' } }
        expect(tool.outputSchema.safeParse(corrupted).success).toBe(false)
    })

    it('accepts its minimal call arguments', () => {
        expect(tool.paramsSchema.safeParse(argsByTool[tool.name]).success).toBe(true)
    })
})

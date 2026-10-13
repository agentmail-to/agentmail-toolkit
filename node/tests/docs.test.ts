import { describe, it, expect } from 'vitest'
import { z, toJSONSchema } from 'zod'

import { tools } from '../src/tools.js'

// An agent picks a tool and fills its arguments from these strings alone, and reads results by
// the output schema's field descriptions. A field documented only by its own name ("ID of inbox"
// for inboxId, "Subject" for subject) tells it nothing: not what the value is, not where to get
// it. These checks are the floor, not the standard; they catch a field added with no real docs.
// The length cap keeps every description inside Claude Code's 2 KB field.
const MAX_DESCRIPTION_CHARS = 1800

type JsonSchema = {
    description?: string
    properties?: Record<string, JsonSchema>
    items?: JsonSchema | JsonSchema[]
    anyOf?: JsonSchema[]
    oneOf?: JsonSchema[]
    allOf?: JsonSchema[]
}

// Matches the clawdbot adapter's conversion options: params schemas contain
// z.coerce.date() pipes whose output type is unrepresentable in JSON Schema.
const toInputJsonSchema = (schema: z.ZodType) => toJSONSchema(schema, { unrepresentable: 'any' }) as JsonSchema

/** Every named property in a schema, descending into arrays and unions, with a readable path. */
function namedProperties(schema: JsonSchema, path = ''): { path: string; name: string; description?: string }[] {
    const found: { path: string; name: string; description?: string }[] = []
    for (const [name, child] of Object.entries(schema.properties ?? {})) {
        const childPath = path ? `${path}.${name}` : name
        found.push({ path: childPath, name, description: child.description }, ...namedProperties(child, childPath))
    }
    const items = Array.isArray(schema.items) ? schema.items : schema.items ? [schema.items] : []
    for (const child of [...items, ...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])]) {
        found.push(...namedProperties(child, path))
    }
    return found
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
const nameWords = (name: string) => words(name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'))
const FILLER = new Set(['id', 'of', 'the', 'a', 'an', 'for', 'to'])

/** True when a description adds nothing to the name it documents. */
const restatesName = (name: string, description: string) => {
    const own = new Set([...nameWords(name), ...FILLER])
    return words(description).every((word) => own.has(word))
}

describe.each(tools.map((tool) => [tool.name, tool] as const))('%s docs', (_name, tool) => {
    it('says more than its name in a description that fits the client cap', () => {
        expect(restatesName(tool.name, tool.description), tool.description).toBe(false)
        expect(tool.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION_CHARS)
    })

    it('documents every input field beyond its name', () => {
        const thin = namedProperties(toInputJsonSchema(tool.paramsSchema))
            .filter(({ name, description }) => !description || restatesName(name, description))
            .map(({ path, description }) => `${path}: ${JSON.stringify(description ?? null)}`)
        expect(thin).toEqual([])
    })

    it('describes every output field', () => {
        const undocumented = namedProperties(toJSONSchema(tool.outputSchema) as JsonSchema)
            .filter(({ name, description }) => !description || restatesName(name, description))
            .map(({ path, description }) => `${path}: ${JSON.stringify(description ?? null)}`)
        expect(undocumented).toEqual([])
    })
})

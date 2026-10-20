// Attachment guardrails on every params schema built from BaseMessageParams.
//
//   url  — `z.url()` accepts any scheme, so `file:///…` reached the API's fetch and came back 503
//          "retry with exponential backoff" for a URL that can never resolve.
//   size — the fallback, base64 `content`, has to be emitted verbatim by the MODEL (~444 K chars for
//          the reported 333 KB PDF). It truncates: off a 4-char boundary the API 400s, on one it
//          decodes short and "succeeds" with a corrupt file. Undetectable downstream, so the
//          descriptions are the only place to prevent it — hence asserted, not just written.
import { describe, it, expect } from 'vitest'
import { toJSONSchema } from 'zod'

import { CreateDraftParams, ReplyToMessageParams, SendMessageParams } from '../src/schemas.js'

const schemas = [
    ['send_message', SendMessageParams, { inboxId: 'i', to: ['a@b.com'] }],
    ['reply_to_message', ReplyToMessageParams, { inboxId: 'i', messageId: 'm' }],
    ['create_draft', CreateDraftParams, { inboxId: 'i', to: ['a@b.com'] }],
] as const

describe.each(schemas)('%s attachments', (_name, schema, base) => {
    const parse = (attachment: Record<string, unknown>) => schema.safeParse({ ...base, attachments: [attachment] })

    it.each(['https://example.com/report.pdf', 'https://s3.amazonaws.com/bucket/key?X-Amz-Signature=abc', 'http://example.com/report.pdf'])(
        'accepts the fetchable url %s',
        (url) => {
            expect(parse({ filename: 'report.pdf', url }).success).toBe(true)
        }
    )

    it.each([
        'file:///Users/me/report.pdf',
        'file://localhost/tmp/report.pdf',
        'data:application/pdf;base64,JVBERi0=',
        'ftp://example.com/report.pdf',
        's3://bucket/key',
    ])('rejects the unfetchable url %s', (url) => {
        const result = parse({ filename: 'report.pdf', url })

        expect(result.success).toBe(false)
        expect(result.error?.issues[0]).toMatchObject({ path: ['attachments', 0, 'url'] })
    })

    // Rejecting locally only helps if the agent learns what to do instead.
    it('explains the rejection and names both working alternatives', () => {
        const message = parse({ url: 'file:///Users/me/report.pdf' }).error?.issues[0]?.message ?? ''

        expect(message).toContain('file:')
        expect(message).toMatch(/https/)
        expect(message).toMatch(/content/)
    })

    it('still rejects a bare local path', () => {
        expect(parse({ filename: 'report.pdf', url: '/Users/me/report.pdf' }).success).toBe(false)
    })

    it('still accepts base64 content, and still rejects content and url together', () => {
        expect(parse({ filename: 'a.txt', content: 'aGk=' }).success).toBe(true)
        expect(parse({ filename: 'a.txt', content: 'aGk=', url: 'https://example.com/a.txt' }).success).toBe(false)
    })
})

// Asserted against the advertised JSON Schema — the text that actually reaches the model.
describe('attachment size guidance', () => {
    // Every description in the attachments subtree, joined — which node carries which sentence is a
    // detail of the union.
    const advertisedText = () => {
        const schema = toJSONSchema(SendMessageParams, { unrepresentable: 'any' }) as {
            properties?: Record<string, unknown>
        }
        const descriptions: string[] = []
        const walk = (node: unknown) => {
            if (!node || typeof node !== 'object') return
            for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
                if (key === 'description' && typeof value === 'string') descriptions.push(value)
                else walk(value)
            }
        }
        walk(schema.properties?.attachments)
        return descriptions.join('\n')
    }

    it('warns that content is inlined into the tool call and truncates', () => {
        const text = advertisedText()

        expect(text).toMatch(/KB/)
        expect(text.toLowerCase()).toContain('truncat')
    })

    it('points at url as the route for larger files', () => {
        expect(advertisedText()).toMatch(/url/)
    })

    it('says a url must be publicly fetchable and cannot be a local path', () => {
        const text = advertisedText().toLowerCase()

        expect(text).toContain('public')
        expect(text).toContain('local')
    })
})

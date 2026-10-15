import { describe, it, expect, vi, afterEach } from 'vitest'
import { AgentMailError, type AgentMailClient } from 'agentmail'
import JSZip from 'jszip'

import { getAttachment } from '../src/functions.js'
import { normalize, truncateForLog, errorMessage, extractDocxText } from '../src/util.js'
import { attachmentResponse } from './fixtures.js'

const ARGS = { inboxId: 'inbox_1', threadId: 'thread_1', attachmentId: 'att_1' }

function clientWith(attachment: Record<string, unknown>): AgentMailClient {
    return {
        inboxes: { threads: { getAttachment: async () => attachment } },
    } as unknown as AgentMailClient
}

async function docxBytes(text: string): Promise<Uint8Array> {
    const zip = new JSZip()
    zip.file('word/document.xml', `<w:document><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`)
    return zip.generateAsync({ type: 'uint8array' })
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
})

describe('attachment download bounds', () => {
    it('refuses non-https download URLs without fetching', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const result = await getAttachment(clientWith({ ...attachmentResponse(), downloadUrl: 'http://attacker.example/x' }), ARGS)
        // Skip reasons are server-log-only (debug data must not reach tool results).
        expect(result).not.toHaveProperty('text')
        expect(result).not.toHaveProperty('extractionError')
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('not https'), expect.anything())
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('skips download when declared size exceeds the cap', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const fetchSpy = vi.fn()
        vi.stubGlobal('fetch', fetchSpy)

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const result = await getAttachment(clientWith({ ...attachmentResponse(), size: 26 * 1024 * 1024 }), ARGS)
        expect(result).not.toHaveProperty('text')
        expect(result).not.toHaveProperty('extractionError')
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('too large'), expect.anything())
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('skips extraction when content-length exceeds the cap', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('x', { status: 200, headers: { 'content-length': String(26 * 1024 * 1024) } }))
        )

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const result = await getAttachment(clientWith(attachmentResponse()), ARGS)
        expect(result).not.toHaveProperty('text')
        expect(result).not.toHaveProperty('extractionError')
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('content-length'), expect.anything())
    })

    it('skips extraction when the downloaded body exceeds the cap (no Content-Length header)', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const oversized = new Uint8Array(26 * 1024 * 1024)
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(oversized, { status: 200 }))
        )

        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const result = await getAttachment(clientWith(attachmentResponse()), ARGS)
        expect(result).not.toHaveProperty('text')
        expect(result).not.toHaveProperty('extractionError')
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('exceeds'), expect.anything())
    })

    it('propagates download failures as tool errors', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('nope', { status: 500 }))
        )
        await expect(getAttachment(clientWith(attachmentResponse()), ARGS)).rejects.toThrow('HTTP 500')
    })

    it('passes a timeout signal to fetch and refuses redirects', async () => {
        const fetchSpy = vi.fn(async (_url: string, _options?: RequestInit) => new Response(new Uint8Array([1, 2, 3, 4]), { status: 200 }))
        vi.stubGlobal('fetch', fetchSpy)

        await getAttachment(clientWith(attachmentResponse()), ARGS)
        expect(fetchSpy.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
        // A redirect could downgrade the https-only check to an arbitrary target scheme.
        expect(fetchSpy.mock.calls[0][1]?.redirect).toBe('error')
    })

    it('returns bare metadata for non-PDF/DOCX bytes', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(new Uint8Array([0x61, 0x62, 0x63, 0x64]), { status: 200 }))
        )
        const result = await getAttachment(clientWith(attachmentResponse()), ARGS)
        expect(result).not.toHaveProperty('text')
        expect(result).not.toHaveProperty('extractionError')
    })
})

describe('attachment extraction bounds', () => {
    it('degrades malformed PDF extraction to bare metadata, logging the reason server-side only', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const malformedPdf = new TextEncoder().encode('%PDF-1.4 this is not a real pdf')
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(malformedPdf, { status: 200 }))
        )

        const result = await getAttachment(clientWith(attachmentResponse()), ARGS)
        // Library error strings are debug data - server logs only, never the result.
        expect(result).not.toHaveProperty('extractionError')
        expect(result).not.toHaveProperty('text')
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('attachment extraction failed'), expect.anything())
    })

    it('extracts text from a real DOCX', async () => {
        const bytes = await docxBytes('hello from the docx')
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(bytes as BodyInit, { status: 200 }))
        )

        const result = await getAttachment(clientWith(attachmentResponse()), ARGS)
        expect((result as { text?: string }).text).toContain('hello from the docx')
    })

    it('truncates pathologically large extracted text', async () => {
        // Repeated chars zip tiny (a decompression-bomb shape), so the source is a small
        // docx that extracts to > the API's RESPONSE_SIZE_LIMIT ceiling (5.95 MB chars).
        const oversized = 7 * 1024 * 1024
        const text = await extractDocxText(await docxBytes('a'.repeat(oversized)))
        expect(text!.length).toBeLessThan(oversized)
        expect(text).toContain('[truncated]')
    })
})

describe('bounded errors and logs', () => {
    it('bounds long API error messages returned to callers', () => {
        const error = new AgentMailError({ message: 'x'.repeat(2000), statusCode: 500 })
        const message = errorMessage(error)
        expect(message.length).toBeLessThan(600)
        expect(message).toContain('(HTTP 500)')
    })

    it('summarizes ValidationErrorResponse bodies concisely', () => {
        const error = new AgentMailError({
            message: 'raw dump',
            statusCode: 422,
            body: { name: 'ValidationErrorResponse', errors: [{ path: 'to', message: 'required' }] },
        })
        const message = errorMessage(error)
        expect(message).toContain('ValidationErrorResponse')
        expect(message).toContain('required')
        expect(message.length).toBeLessThan(600)
    })

    it('truncates both string and object bodies for logging', () => {
        expect((truncateForLog('y'.repeat(2000)) as string).length).toBe(500)
        const big = truncateForLog({ data: 'z'.repeat(2000) }) as string
        expect(big).toContain('[truncated]')
        expect(big.length).toBeLessThanOrEqual(520)
    })
})

describe('normalize', () => {
    it('converts Dates to ISO strings and strips undefined, recursively', () => {
        const input = {
            when: new Date('2026-01-01T00:00:00.000Z'),
            missing: undefined,
            nested: [{ when: new Date('2026-01-02T00:00:00.000Z'), keep: 1 }],
        }
        expect(normalize(input)).toEqual({
            when: '2026-01-01T00:00:00.000Z',
            nested: [{ when: '2026-01-02T00:00:00.000Z', keep: 1 }],
        })
    })
})

describe('attachment download cancellation', () => {
    it("passes the caller's signal to the download", async () => {
        const fetchSpy = vi.fn(async () => new Response(null, { status: 404 }))
        vi.stubGlobal('fetch', fetchSpy)
        const controller = new AbortController()
        controller.abort()

        await expect(getAttachment(clientWith(attachmentResponse()), ARGS, { signal: controller.signal })).rejects.toThrow()

        const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
        expect(init.signal?.aborted).toBe(true)
    })
})

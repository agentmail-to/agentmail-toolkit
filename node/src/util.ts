import { AgentMailClient, AgentMailError } from 'agentmail'
import { getDocumentProxy, extractText } from 'unpdf'
import JSZip from 'jszip'

// Cap on the error text returned to callers, so neither a large ValidationErrorResponse
// nor any other body can produce an unbounded message.
const MAX_ERROR_BODY_LENGTH = 500

// Pull the API's own explanation out of the error body (e.g. "address already
// taken") instead of returning the SDK's verbose multi-line "Status code / Body"
// dump. Generic across every tool. Handles the `ValidationErrorResponse` shape
// (`{name, errors}`, no top-level `message`) as well as `{message|detail|error}`
// bodies, and bounds the result so a large/unbounded body is never returned to callers.
function apiErrorMessage(error: AgentMailError): string {
    const body = error.body as
        | { message?: string; detail?: string; error?: string; name?: string; errors?: unknown[] }
        | string
        | undefined
    let detail: string | undefined
    if (typeof body === 'string') {
        detail = body
    } else if (body?.message ?? body?.detail ?? body?.error) {
        detail = body.message ?? body.detail ?? body.error
    } else if (body?.name === 'ValidationErrorResponse' && Array.isArray(body.errors)) {
        detail = `${body.name}: ${JSON.stringify(body.errors).slice(0, MAX_ERROR_BODY_LENGTH)}`
    }
    const base = detail ?? error.message
    const bounded = typeof base === 'string' && base.length > MAX_ERROR_BODY_LENGTH ? base.slice(0, MAX_ERROR_BODY_LENGTH) + '…' : base
    return error.statusCode ? `${bounded} (HTTP ${error.statusCode})` : bounded
}

// Pull a concise, human-readable message out of any thrown value - the API's own
// explanation for an `AgentMailError` (via `apiErrorMessage`, above) instead of the
// SDK's verbose multi-line "Status code / Body" dump, `error.message` for a generic
// `Error`, or a generic fallback otherwise. Used by `safeFunc` below (catch-and-return,
// for adapters that signal errors via a result flag) and directly by adapters that
// signal errors by throwing (ai-sdk, langchain, clawdbot) so a concise, bounded message
// reaches the framework's native error mechanism instead of a raw SDK dump.
export function errorMessage(error: unknown): string {
    if (error instanceof AgentMailError) return apiErrorMessage(error)
    if (error instanceof Error) return error.message
    return 'Unknown error'
}

export const safeFunc = async <T>(
    func: (client: AgentMailClient, args: Record<string, any>) => Promise<T>,
    client: AgentMailClient,
    args: Record<string, any>
): Promise<{ isError: boolean; result: T | string; statusCode?: number; body?: unknown }> => {
    try {
        return { isError: false, result: await func(client, args) }
    } catch (error) {
        return {
            isError: true,
            result: errorMessage(error),
            ...(error instanceof AgentMailError ? { statusCode: error.statusCode, body: error.body } : {}),
        }
    }
}

// Bounds error-body *logging* regardless of whether the body is a string or a parsed
// JSON object - object bodies (e.g. ValidationErrorResponse) can be just as large/
// sensitive as string ones, so both need the same cap. Exported for adapters (e.g.
// mcp.ts's console.error call) to use instead of only truncating string bodies.
export function truncateForLog(body: unknown, max = 500): unknown {
    if (typeof body === 'string') return body.slice(0, max)
    if (body && typeof body === 'object') {
        const json = JSON.stringify(body)
        return json.length > max ? json.slice(0, max) + '...[truncated]' : body
    }
    return body
}

// JSON-safe a result so it can be checked against a Zod output schema / returned as MCP
// structuredContent: Date -> ISO string, undefined values stripped from objects.
export function normalize(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString()
    if (Array.isArray(value)) return value.map(normalize)
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [key, v] of Object.entries(value)) {
            if (v !== undefined) out[key] = normalize(v)
        }
        return out
    }
    return value
}

export function detectFileType(bytes: Uint8Array): string | undefined {
    // PDF: starts with %PDF (0x25 0x50 0x44 0x46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return 'application/pdf'
    }
    // ZIP (DOCX is a ZIP): starts with PK\x03\x04 (0x50 0x4B 0x03 0x04)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
        return 'application/zip'
    }
    return undefined
}

// ~150-200 dense pages; generous for real documents while bounding a decompression-
// bomb-style DOCX or a pathological PDF from producing an unbounded string.
const MAX_EXTRACTED_CHARS = 500_000

function truncateExtracted(text: string): string {
    return text.length > MAX_EXTRACTED_CHARS ? text.slice(0, MAX_EXTRACTED_CHARS) + '\n...[truncated]' : text
}

// Note: Promise.race bounds when the caller gets a response, but does not cancel the
// losing extraction work - it keeps running in the background with its result
// discarded. Full cancellation would need a worker thread; call this out rather than
// silently accepting partial protection.
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`extraction timed out after ${ms}ms`)), ms)),
    ])
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
    return withTimeout(
        (async () => {
            const pdf = await getDocumentProxy(bytes)
            const { text } = await extractText(pdf)
            return truncateExtracted(Array.isArray(text) ? text.join('\n') : text)
        })(),
        20_000
    )
}

export async function extractDocxText(bytes: Uint8Array): Promise<string | undefined> {
    return withTimeout(
        (async () => {
            const zip = await JSZip.loadAsync(bytes)
            const documentXml = await zip.file('word/document.xml')?.async('string')
            if (!documentXml) return undefined
            return truncateExtracted(
                documentXml
                    .replace(/<w:p[^>]*>/g, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&apos;/g, "'")
                    .replace(/\n{3,}/g, '\n\n')
                    .trim()
            )
        })(),
        20_000
    )
}

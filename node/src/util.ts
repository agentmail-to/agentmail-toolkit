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
        | { message?: string; detail?: string; error?: string; name?: string; errors?: unknown[]; fix?: string }
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
    // The API's own `fix` names the real remedy — the cap that was hit, the window it resets in,
    // the tier that raises it and its price, or (for an unverified agent org) the verification
    // call that lifts the cap for free. It is always better than a status-code guess, so when it
    // is present it replaces the canned guidance below rather than sitting alongside it.
    const fix = typeof body === 'object' && typeof body?.fix === 'string' ? body.fix : undefined

    const base = detail ?? error.message
    const combined = fix ? `${base} — ${fix}` : base
    const bounded =
        typeof combined === 'string' && combined.length > MAX_ERROR_BODY_LENGTH
            ? combined.slice(0, MAX_ERROR_BODY_LENGTH) + '…'
            : combined
    const withStatus = error.statusCode ? `${bounded} (HTTP ${error.statusCode})` : bounded

    // Action-specific guidance for the statuses a model can actually act on. Skipped entirely when
    // the API supplied a `fix`: a plan-cap 403 is not a permissions problem, and telling a model to
    // "wait before retrying" a monthly send quota sends it down a road that does not end.
    if (fix) return withStatus
    if (error.statusCode === 401) return `${withStatus} — credentials are missing or invalid; reconnect or provide a valid API key`
    if (error.statusCode === 403) return `${withStatus} — the authenticated credential lacks permission for this action`
    if (error.statusCode === 429) return `${withStatus} — rate limited; wait before retrying`
    return withStatus
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

// Per-call options a host passes to a tool. `signal` cancels the tool's own fetches (a presigned
// upload, an attachment download), which a signal bound into the SDK client never reaches.
export type ToolCallOptions = { signal?: AbortSignal }

export const safeFunc = async <A, T>(
    func: (client: AgentMailClient, args: A, options?: ToolCallOptions) => Promise<T>,
    client: AgentMailClient,
    args: A,
    options?: ToolCallOptions
): Promise<{ isError: boolean; result: T | string; statusCode?: number; body?: unknown }> => {
    try {
        return { isError: false, result: await func(client, args, options) }
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

// Mirrors the AgentMail API's enforced content ceiling (RESPONSE_SIZE_LIMIT in
// agentmail-api/src/agentmail/utils/limits.ts). The API caps returned extracted content
// by comparing its `.length` to that byte constant (get-message.ts), so the toolkit caps
// extracted text at the same number of characters - it never returns more inline text
// than the API itself would.
const MAX_EXTRACTED_CHARS = 5.95 * 1024 * 1024

function truncateExtracted(text: string): string {
    return text.length > MAX_EXTRACTED_CHARS ? text.slice(0, MAX_EXTRACTED_CHARS) + '\n...[truncated]' : text
}

// The extraction/fetch timeouts (20s here, 15s in functions.ts) are deliberate
// client-side choices, NOT derived from an enforced API constant: only this surface can
// bound how long it waits on a CDN fetch or a local parse, and there is no upstream limit
// to mirror (unlike the size caps, which mirror the API's RESPONSE_SIZE_LIMIT). A hang on
// the shared multi-tenant host is worse than a slightly-off timeout, so a bound is needed;
// the value is judgment, not citation.
//
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

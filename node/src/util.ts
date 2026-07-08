import { AgentMailClient, AgentMailError } from 'agentmail'
import { getDocumentProxy, extractText } from 'unpdf'
import JSZip from 'jszip'

// Pull the API's own explanation out of the error body (e.g. "address already
// taken") instead of returning the SDK's verbose multi-line "Status code / Body"
// dump. Generic across every tool.
function apiErrorMessage(error: AgentMailError): string {
    const body = error.body as { message?: string; detail?: string; error?: string } | string | undefined
    const detail =
        typeof body === 'string' ? body : (body?.message ?? body?.detail ?? body?.error)
    const base = detail ?? error.message
    return error.statusCode ? `${base} (HTTP ${error.statusCode})` : base
}

export const safeFunc = async <T>(
    func: (client: AgentMailClient, args: Record<string, any>) => Promise<T>,
    client: AgentMailClient,
    args: Record<string, any>
): Promise<{ isError: boolean; result: T | string; statusCode?: number; body?: unknown }> => {
    try {
        return { isError: false, result: await func(client, args) }
    } catch (error) {
        if (error instanceof AgentMailError) {
            return {
                isError: true,
                result: apiErrorMessage(error),
                statusCode: error.statusCode,
                body: error.body,
            }
        }
        if (error instanceof Error) return { isError: true, result: error.message }
        return { isError: true, result: 'Unknown error' }
    }
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

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf)
    return Array.isArray(text) ? text.join('\n') : text
}

export async function extractDocxText(bytes: Uint8Array): Promise<string | undefined> {
    const zip = await JSZip.loadAsync(bytes)
    const documentXml = await zip.file('word/document.xml')?.async('string')
    if (!documentXml) return undefined
    return documentXml
        .replace(/<w:p[^>]*>/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

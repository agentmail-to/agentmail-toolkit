import { AgentMailClient } from 'agentmail'
import { getDocumentProxy, extractText } from 'unpdf'
import JSZip from 'jszip'

export const safeFunc = async <T>(
    func: (client: AgentMailClient, args: Record<string, any>) => Promise<T>,
    client: AgentMailClient,
    args: Record<string, any>
) => {
    try {
        return { isError: false, result: await func(client, args) }
    } catch (error) {
        if (error instanceof Error) return { isError: true, result: error.message }
        else return { isError: true, result: 'Unknown error' }
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

import { AgentMailClient } from 'agentmail'
import { fileTypeFromBuffer } from 'file-type'
import { extractText, getDocumentProxy } from 'unpdf'
import mammoth from 'mammoth'

export type Args = Record<string, any>

interface Attachment {
    text?: string
    error?: string
    fileType?: string
}

export async function listInboxes(client: AgentMailClient, args: Args) {
    return client.inboxes.list(args)
}

export async function getInbox(client: AgentMailClient, args: Args) {
    const { inboxId, ...options } = args
    return client.inboxes.get(inboxId, options)
}

export async function createInbox(client: AgentMailClient, args: Args) {
    return client.inboxes.create(args)
}

export async function deleteInbox(client: AgentMailClient, args: Args) {
    const { inboxId } = args
    return client.inboxes.delete(inboxId)
}

export async function listThreads(client: AgentMailClient, args: Args) {
    const { inboxId, ...options } = args
    return client.inboxes.threads.list(inboxId, options)
}

export async function getThread(client: AgentMailClient, args: Args) {
    const { inboxId, threadId, ...options } = args
    return client.inboxes.threads.get(inboxId, threadId, options)
}

export async function getAttachment(client: AgentMailClient, args: Args): Promise<Attachment> {
    const { threadId, attachmentId } = args

    const response = await client.threads.getAttachment(threadId, attachmentId)
    const arrayBuffer = await response.arrayBuffer()
    const fileBytes = new Uint8Array(arrayBuffer)

    const fileKind = await fileTypeFromBuffer(fileBytes)
    const fileType = fileKind?.mime

    let text = undefined

    if (fileType === 'application/pdf') {
        const pdf = await getDocumentProxy(fileBytes)
        const { text: pdfText } = await extractText(pdf)
        text = Array.isArray(pdfText) ? pdfText.join('\n') : pdfText
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // Use buffer for Node.js, arrayBuffer for browser/edge
        const input = typeof Buffer !== 'undefined' ? { buffer: Buffer.from(arrayBuffer) } : { arrayBuffer }
        const result = await mammoth.extractRawText(input)
        text = result.value
    } else {
        return { error: `Unsupported file type: ${fileType || 'unknown'}`, fileType }
    }

    return { text, fileType }
}

export async function sendMessage(client: AgentMailClient, args: Args) {
    const { inboxId, ...options } = args
    return client.inboxes.messages.send(inboxId, options)
}

export async function replyToMessage(client: AgentMailClient, args: Args) {
    const { inboxId, messageId, ...options } = args
    return client.inboxes.messages.reply(inboxId, messageId, options)
}

export async function updateMessage(client: AgentMailClient, args: Args) {
    const { inboxId, messageId, ...options } = args
    return client.inboxes.messages.update(inboxId, messageId, options)
}

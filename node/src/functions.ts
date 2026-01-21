import { AgentMailClient } from 'agentmail'
import { detectFileType, extractPdfText, extractDocxText } from './util.js'

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

    const { downloadUrl } = await client.threads.getAttachment(threadId, attachmentId)
    const response = await fetch(downloadUrl)
    const arrayBuffer = await response.arrayBuffer()
    const fileBytes = new Uint8Array(arrayBuffer)

    const detectedType = detectFileType(fileBytes)

    if (detectedType === 'application/pdf') {
        return { text: await extractPdfText(fileBytes), fileType: detectedType }
    } else if (detectedType === 'application/zip') {
        const text = await extractDocxText(fileBytes)
        if (text) return { text, fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
    }

    return { error: 'Unsupported file type', fileType: detectedType || 'unknown' }
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

import { AgentMailClient } from 'agentmail'
import { CanvasFactory } from 'pdf-parse/worker'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { fileTypeFromBuffer } from 'file-type'

export type Args = Record<string, any>

interface Attachment {
    text?: string
    error?: string
    file_type?: string
}

export async function listInboxes(client: AgentMailClient, args: Args) {
    return client.inboxes.list(args)
}

export async function getInbox(client: AgentMailClient, args: Args) {
    const { inbox_id, ...options } = args
    return client.inboxes.get(inbox_id, options)
}

export async function createInbox(client: AgentMailClient, args: Args) {
    return client.inboxes.create(args)
}

export async function deleteInbox(client: AgentMailClient, args: Args) {
    const { inbox_id } = args
    return client.inboxes.delete(inbox_id)
}

export async function listThreads(client: AgentMailClient, args: Args) {
    const { inbox_id, ...options } = args
    return client.inboxes.threads.list(inbox_id, options)
}

export async function getThread(client: AgentMailClient, args: Args) {
    const { inbox_id, thread_id, ...options } = args
    return client.inboxes.threads.get(inbox_id, thread_id, options)
}

export async function getAttachment(client: AgentMailClient, args: Args): Promise<Attachment> {
    const { thread_id, attachment_id } = args

    const response = await client.threads.getAttachment(thread_id, attachment_id)
    const fileBytes = Buffer.from(await response.arrayBuffer())

    const fileKind = await fileTypeFromBuffer(fileBytes)
    const fileType = fileKind?.mime

    let text = undefined

    if (fileType === 'application/pdf') {
        const parser = new PDFParse({ data: fileBytes, CanvasFactory })
        const pdfData = await parser.getText()
        text = pdfData.text
    } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: fileBytes })
        text = result.value
    } else {
        return {
            error: `Unsupported file type: ${fileType || 'unknown'}`,
            file_type: fileType,
        }
    }

    return { text, file_type: fileType }
}

export async function sendMessage(client: AgentMailClient, args: Args) {
    const { inbox_id, ...options } = args
    return client.inboxes.messages.send(inbox_id, options)
}

export async function replyToMessage(client: AgentMailClient, args: Args) {
    const { inbox_id, message_id, ...options } = args
    return client.inboxes.messages.reply(inbox_id, message_id, options)
}

export async function updateMessage(client: AgentMailClient, args: Args) {
    const { inbox_id, message_id, ...options } = args
    return client.inboxes.messages.update(inbox_id, message_id, options)
}

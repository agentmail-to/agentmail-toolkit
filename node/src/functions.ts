import { AgentMailClient } from 'agentmail'
import { z } from 'zod'

import { detectFileType, extractPdfText, extractDocxText } from './util.js'
import {
    ListItemsParams,
    GetInboxParams,
    CreateInboxParams,
    UpdateInboxParams,
    ListThreadsParams,
    SearchInboxItemsParams,
    GetThreadParams,
    UpdateThreadParams,
    GetAttachmentParams,
    ListMessagesParams,
    SendMessageParams,
    ReplyToMessageParams,
    ForwardMessageParams,
    UpdateMessageParams,
    CreateDraftParams,
    ListDraftsParams,
    GetDraftParams,
    UpdateDraftParams,
    SendDraftParams,
    DeleteDraftParams,
} from './schemas.js'

export async function listInboxes(client: AgentMailClient, args: z.infer<typeof ListItemsParams>) {
    return client.inboxes.list(args)
}

export async function getInbox(client: AgentMailClient, args: z.infer<typeof GetInboxParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.get(inboxId, options)
}

export async function createInbox(client: AgentMailClient, args: z.infer<typeof CreateInboxParams>) {
    return client.inboxes.create(args)
}

export async function updateInbox(client: AgentMailClient, args: z.infer<typeof UpdateInboxParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.update(inboxId, options)
}

export async function deleteInbox(client: AgentMailClient, args: z.infer<typeof GetInboxParams>) {
    const { inboxId } = args
    await client.inboxes.delete(inboxId)
    return { success: true as const }
}

export async function listThreads(client: AgentMailClient, args: z.infer<typeof ListThreadsParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.threads.list(inboxId, options)
}

export async function searchThreads(client: AgentMailClient, args: z.infer<typeof SearchInboxItemsParams>) {
    const { inboxId, q, ...options } = args
    return client.inboxes.threads.search(inboxId, { q, ...options })
}

export async function getThread(client: AgentMailClient, args: z.infer<typeof GetThreadParams>) {
    const { inboxId, threadId, ...options } = args
    return client.inboxes.threads.get(inboxId, threadId, options)
}

export async function updateThread(client: AgentMailClient, args: z.infer<typeof UpdateThreadParams>) {
    const { inboxId, threadId, ...options } = args
    return client.inboxes.threads.update(inboxId, threadId, options)
}

export async function deleteThread(client: AgentMailClient, args: z.infer<typeof GetThreadParams>) {
    const { inboxId, threadId } = args
    await client.inboxes.threads.delete(inboxId, threadId)
    return { success: true as const }
}

export async function getAttachment(client: AgentMailClient, args: z.infer<typeof GetAttachmentParams>) {
    const { inboxId, threadId, attachmentId } = args

    const attachment = await client.inboxes.threads.getAttachment(inboxId, threadId, attachmentId)

    try {
        const response = await fetch(attachment.downloadUrl)
        const arrayBuffer = await response.arrayBuffer()
        const fileBytes = new Uint8Array(arrayBuffer)

        const detectedType = detectFileType(fileBytes)

        if (detectedType === 'application/pdf') {
            return { ...attachment, text: await extractPdfText(fileBytes) }
        } else if (detectedType === 'application/zip') {
            return { ...attachment, text: await extractDocxText(fileBytes) }
        }
    } catch {}

    return attachment
}

export async function listMessages(client: AgentMailClient, args: z.infer<typeof ListMessagesParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.messages.list(inboxId, options)
}

export async function searchMessages(client: AgentMailClient, args: z.infer<typeof SearchInboxItemsParams>) {
    const { inboxId, q, ...options } = args
    return client.inboxes.messages.search(inboxId, { q, ...options })
}

export async function sendMessage(client: AgentMailClient, args: z.infer<typeof SendMessageParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.messages.send(inboxId, options)
}

export async function replyToMessage(client: AgentMailClient, args: z.infer<typeof ReplyToMessageParams>) {
    const { inboxId, messageId, ...options } = args
    return client.inboxes.messages.reply(inboxId, messageId, options)
}

export async function forwardMessage(client: AgentMailClient, args: z.infer<typeof ForwardMessageParams>) {
    const { inboxId, messageId, ...options } = args
    return client.inboxes.messages.forward(inboxId, messageId, options)
}

export async function updateMessage(client: AgentMailClient, args: z.infer<typeof UpdateMessageParams>) {
    const { inboxId, messageId, ...options } = args
    return client.inboxes.messages.update(inboxId, messageId, options)
}

// Draft functions

export async function createDraft(client: AgentMailClient, args: z.infer<typeof CreateDraftParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.drafts.create(inboxId, options)
}

export async function listDrafts(client: AgentMailClient, args: z.infer<typeof ListDraftsParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.drafts.list(inboxId, options)
}

export async function getDraft(client: AgentMailClient, args: z.infer<typeof GetDraftParams>) {
    const { inboxId, draftId } = args
    return client.inboxes.drafts.get(inboxId, draftId)
}

export async function updateDraft(client: AgentMailClient, args: z.infer<typeof UpdateDraftParams>) {
    const { inboxId, draftId, ...options } = args
    return client.inboxes.drafts.update(inboxId, draftId, options)
}

export async function sendDraft(client: AgentMailClient, args: z.infer<typeof SendDraftParams>) {
    const { inboxId, draftId } = args
    return client.inboxes.drafts.send(inboxId, draftId, {})
}

export async function deleteDraft(client: AgentMailClient, args: z.infer<typeof DeleteDraftParams>) {
    const { inboxId, draftId } = args
    await client.inboxes.drafts.delete(inboxId, draftId)
    return { success: true as const }
}

export async function authMe(client: AgentMailClient) {
    return client.auth.me()
}

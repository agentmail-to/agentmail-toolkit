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

// 25 MB matches common provider inbound attachment ceilings (e.g. Gmail); generous
// for legitimate mail while bounding worst-case memory for text extraction.
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

export async function getAttachment(client: AgentMailClient, args: z.infer<typeof GetAttachmentParams>) {
    const { inboxId, threadId, attachmentId } = args

    const attachment = await client.inboxes.threads.getAttachment(inboxId, threadId, attachmentId)

    if (!attachment.downloadUrl.startsWith('https://')) {
        console.error('[agentmail-toolkit] attachment download URL is not https, skipping extraction', { attachmentId })
        return { ...attachment, extractionError: 'download URL is not https' }
    }

    if (attachment.size > MAX_ATTACHMENT_BYTES) {
        console.error('[agentmail-toolkit] attachment too large to extract, skipping', { attachmentId, size: attachment.size })
        return { ...attachment, extractionError: 'attachment exceeds size cap' }
    }

    // Download failures (network error, timeout, non-2xx) propagate as a tool error -
    // the attachment couldn't be fetched at all, which is a different failure mode from
    // a successfully-downloaded file that fails to extract (handled below).
    const response = await fetch(attachment.downloadUrl, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) {
        throw new Error(`failed to download attachment: HTTP ${response.status}`)
    }

    const contentLength = Number(response.headers.get('content-length'))
    if (contentLength && contentLength > MAX_ATTACHMENT_BYTES) {
        console.error('[agentmail-toolkit] content-length exceeds cap, skipping', { attachmentId, contentLength })
        return { ...attachment, extractionError: 'content-length exceeds size cap' }
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_ATTACHMENT_BYTES) {
        console.error('[agentmail-toolkit] downloaded attachment exceeds cap, skipping', { attachmentId, size: arrayBuffer.byteLength })
        return { ...attachment, extractionError: 'downloaded attachment exceeds size cap' }
    }
    const fileBytes = new Uint8Array(arrayBuffer)

    const detectedType = detectFileType(fileBytes)
    if (detectedType !== 'application/pdf' && detectedType !== 'application/zip') {
        return attachment
    }

    try {
        const text = detectedType === 'application/pdf' ? await extractPdfText(fileBytes) : await extractDocxText(fileBytes)
        return { ...attachment, text }
    } catch (err) {
        // Don't let an expired signed URL response, or a malformed/adversarial PDF/DOCX,
        // or a bug in unpdf/jszip silently look identical to "extraction wasn't
        // attempted" - surface it as explicit fallback metadata (previously a bare
        // `catch {}`), while still degrading gracefully to the bare attachment instead
        // of failing the whole call.
        console.error('[agentmail-toolkit] attachment extraction failed', {
            attachmentId,
            error: err instanceof Error ? err.message : String(err),
        })
        return { ...attachment, extractionError: err instanceof Error ? err.message : String(err) }
    }
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

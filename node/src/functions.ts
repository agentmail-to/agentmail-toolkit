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
    AgentVerifyParams,
    ListProvidersParams,
    SearchProvidersParams,
    GetProviderParams,
    ListProviderAccountsParams,
    ConnectProviderParams,
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

// Mirrors the AgentMail API's own enforced content ceiling (RESPONSE_SIZE_LIMIT in
// agentmail-api/src/agentmail/utils/limits.ts: 5.95 MB, the Lambda payload limit less
// envelope headroom). The API returns extracted message content inline only up to this
// size and otherwise hands back a URL (get-message.ts); the toolkit inlines extracted
// attachment text into a tool result, the same class of payload, so it uses the same
// ceiling rather than an invented one. Larger attachments degrade to metadata + the
// download URL; skip reasons are logged server-side only (extraction diagnostics are
// debug data OpenAI app review requires kept out of tool results).
const MAX_ATTACHMENT_BYTES = 5.95 * 1024 * 1024

export async function getAttachment(client: AgentMailClient, args: z.infer<typeof GetAttachmentParams>) {
    const { inboxId, threadId, attachmentId } = args

    const attachment = await client.inboxes.threads.getAttachment(inboxId, threadId, attachmentId)

    if (!attachment.downloadUrl.startsWith('https://')) {
        console.error('[agentmail-toolkit] attachment download URL is not https, skipping extraction', { attachmentId })
        return attachment
    }

    if (attachment.size > MAX_ATTACHMENT_BYTES) {
        console.error('[agentmail-toolkit] attachment too large to extract, skipping', { attachmentId, size: attachment.size })
        return attachment
    }

    // Download failures (network error, timeout, non-2xx) propagate as a tool error -
    // the attachment couldn't be fetched at all, which is a different failure mode from
    // a successfully-downloaded file that fails to extract (handled below).
    // redirect: 'error' - the signed CDN URL should never redirect; following one could
    // silently downgrade the https-only check above (fetch follows redirects by default
    // with no scheme restriction on the target).
    const response = await fetch(attachment.downloadUrl, { signal: AbortSignal.timeout(15_000), redirect: 'error' })
    if (!response.ok) {
        throw new Error(`failed to download attachment: HTTP ${response.status}`)
    }

    const contentLength = Number(response.headers.get('content-length'))
    if (contentLength && contentLength > MAX_ATTACHMENT_BYTES) {
        console.error('[agentmail-toolkit] content-length exceeds cap, skipping', { attachmentId, contentLength })
        return attachment
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_ATTACHMENT_BYTES) {
        console.error('[agentmail-toolkit] downloaded attachment exceeds cap, skipping', { attachmentId, size: arrayBuffer.byteLength })
        return attachment
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
        // A malformed/adversarial PDF/DOCX or a bug in unpdf/jszip degrades gracefully
        // to the bare attachment. The failure reason goes to server logs only - library
        // error strings are debug data that must not reach tool results.
        console.error('[agentmail-toolkit] attachment extraction failed', {
            attachmentId,
            error: err instanceof Error ? err.message : String(err),
        })
        return attachment
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

export async function listProviders(client: AgentMailClient, args: z.infer<typeof ListProvidersParams>) {
    return client.providers.list(args)
}

export async function searchProviders(client: AgentMailClient, args: z.infer<typeof SearchProvidersParams>) {
    return client.providers.search(args)
}

export async function getProvider(client: AgentMailClient, args: z.infer<typeof GetProviderParams>) {
    return client.providers.get(args.providerId)
}

export async function listProviderAccounts(client: AgentMailClient, args: z.infer<typeof ListProviderAccountsParams>) {
    const { providerId, ...options } = args
    return client.providers.listAccounts(providerId, options)
}

// globalThis.crypto is unflagged only from Node 19, and this package's floor is Node 18 (the
// SDK's own engines), so fall back to a random hex key — the key is a dedup token, not a secret,
// and the fallback stays within the API's `A-Za-z0-9._~-` charset. No node: import, so the module
// stays runtime-neutral, matching the fetch usage above.
function randomIdempotencyKey(): string {
    const uuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)
    if (uuid) return uuid()
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export async function connectProvider(client: AgentMailClient, args: z.infer<typeof ConnectProviderParams>) {
    const { providerId, idempotencyKey, ...body } = args
    // The API requires an Idempotency-Key, and its contract is dedup-with-conflict, not replay
    // (the magic URL is single-use and never re-served) — so a generated key only distinguishes
    // duplicate attempts; it can never recover a lost response. maxRetries: 0 for the same
    // reason: the SDK's fetcher retries POSTs on 408/429/5xx with the SAME key, and a re-POST of
    // a committed session can only answer 409 while the URL from the first attempt is lost.
    return client.providers.connect(providerId, body, {
        idempotencyKey: idempotencyKey ?? randomIdempotencyKey(),
        maxRetries: 0,
    })
}

export async function agentVerify(client: AgentMailClient, args: z.infer<typeof AgentVerifyParams>) {
    return client.agent.verify(args)
}

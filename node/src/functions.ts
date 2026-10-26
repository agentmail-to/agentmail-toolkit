import { AgentMailClient } from 'agentmail'
import { z } from 'zod'

import { detectFileType, extractPdfText, extractDocxText, type ToolCallOptions } from './util.js'
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
    UploadFileParams,
    ListFilesParams,
    GetFileParams,
    DeleteFileParams,
    GetAgendaParams,
    GetEventParams,
    CreateEventParams,
    UpdateEventParams,
    DeleteEventParams,
    RespondToInvitationParams,
    GetCalendarParams,
    UpdateCalendarParams,
    AgentAttachHumanParams,
    AgentVerifyParams,
    ListAppsParams,
    SearchAppsParams,
    GetAppParams,
    ListAccountsParams,
    GetMessageParams,
    SearchInboxesParams,
    ListListEntriesParams,
    GetListEntryParams,
    CreateListEntryParams,
    DeleteListEntryParams,
    ConnectAppParams,
    AuthorizeInboxParams,
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
    const thread = await client.inboxes.threads.get(inboxId, threadId, options)
    return { ...thread, messages: thread.messages.map(withMessageAuthentication) }
}

// SDK 0.5.46 passes this public API field through in snake_case. The API's Fern definition
// already declares it, so delete this projection once the toolkit requires an SDK that types
// authenticationResults. Until then, project only the documented verdicts and drop the raw
// copy: only the MCP adapter strips undeclared fields, the other adapters return this object.
function withMessageAuthentication<T extends object>(message: T) {
    const { authentication_results: raw, ...rest } = message as T & { authentication_results?: unknown }
    if ('authenticationResults' in rest || !raw || typeof raw !== 'object' || Array.isArray(raw)) return rest
    const auth = raw as Record<string, unknown>
    const text = (value: unknown) => (typeof value === 'string' ? value : undefined)
    return {
        ...rest,
        authenticationResults: {
            spf: text(auth.spf),
            dkim: text(auth.dkim),
            dmarc: text(auth.dmarc),
            spfDomain: text(auth.spf_domain),
            dkimDomain: text(auth.dkim_domain),
            dmarcDomain: text(auth.dmarc_domain),
            arcSealer: text(auth.arc_sealer),
        },
    }
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

// A direct fetch's own timeout, cancelled early by the caller's signal when there is one.
const fetchSignal = (ms: number, signal?: AbortSignal) => (signal ? AbortSignal.any([AbortSignal.timeout(ms), signal]) : AbortSignal.timeout(ms))

export async function getAttachment(client: AgentMailClient, args: z.infer<typeof GetAttachmentParams>, { signal }: ToolCallOptions = {}) {
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
    const response = await fetch(attachment.downloadUrl, { signal: fetchSignal(15_000, signal), redirect: 'error' })
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

const fileBytes = (content: string, encoding: 'utf8' | 'base64'): Uint8Array<ArrayBuffer> => {
    if (encoding === 'utf8') return new TextEncoder().encode(content)
    let binary: string
    try {
        binary = atob(content)
    } catch {
        throw new Error('content is not valid base64')
    }
    // An indexed loop: Uint8Array.from(binary, fn) goes through the iterator, which holds about
    // twelve times the file in heap and blocks for ~250 ms on a 7.5 MB file.
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

const sha256Base64 = async (bytes: Uint8Array<ArrayBuffer>) => {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return btoa(String.fromCharCode(...digest))
}

// One tool for the API's three-step upload: create the file, PUT its bytes to the presigned URL, complete it.
// A model can't make the PUT itself. Retrying the identical call is safe: the API returns the file it already
// made, completing it if its bytes landed, so only a file still waiting for its bytes gets another PUT.
export async function uploadFile(client: AgentMailClient, args: z.infer<typeof UploadFileParams>, { signal }: ToolCallOptions = {}) {
    const { inboxId, path, content, encoding, contentType, expiresAt } = args
    const bytes = fileBytes(content, encoding)
    const file = await client.inboxes.files.create(inboxId, {
        path,
        size: bytes.length,
        sha256: await sha256Base64(bytes),
        contentType: contentType ?? (encoding === 'utf8' ? 'text/plain; charset=utf-8' : undefined),
        expiresAt,
    })
    if (!file.upload) return file
    // redirect: 'error' - a presigned S3 URL never redirects, and following one would send the bytes elsewhere.
    const response = await fetch(file.upload.url, {
        method: 'PUT',
        headers: file.upload.headers,
        body: bytes,
        signal: fetchSignal(60_000, signal),
        redirect: 'error',
    })
    // 412: the PUT is signed If-None-Match: *, so another PUT of this file's bytes already landed
    // (a concurrent or abandoned identical call). Complete checks the stored bytes either way.
    if (!response.ok && response.status !== 412) throw new Error(`failed to upload the file's bytes: HTTP ${response.status}`)
    return client.inboxes.files.complete(inboxId, file.fileId)
}

export async function listFiles(client: AgentMailClient, args: z.infer<typeof ListFilesParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.files.list(inboxId, options)
}

export async function getFile(client: AgentMailClient, args: z.infer<typeof GetFileParams>) {
    const { inboxId, fileId } = args
    return client.inboxes.files.get(inboxId, fileId)
}

export async function deleteFile(client: AgentMailClient, args: z.infer<typeof DeleteFileParams>) {
    const { inboxId, fileId } = args
    await client.inboxes.files.delete(inboxId, fileId)
    return { success: true as const }
}

// Calendar functions

export async function getAgenda(client: AgentMailClient, args: z.infer<typeof GetAgendaParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.calendar.getAgenda(inboxId, options)
}

export async function getEvent(client: AgentMailClient, args: z.infer<typeof GetEventParams>) {
    const { inboxId, eventId, ...options } = args
    return client.inboxes.calendar.getEvent(inboxId, eventId, options)
}

export async function createEvent(client: AgentMailClient, args: z.infer<typeof CreateEventParams>) {
    const { inboxId, ...body } = args
    return client.inboxes.calendar.createEvent(inboxId, body)
}

export async function updateEvent(client: AgentMailClient, args: z.infer<typeof UpdateEventParams>) {
    const { inboxId, eventId, ...body } = args
    return client.inboxes.calendar.updateEvent(inboxId, eventId, body)
}

export async function deleteEvent(client: AgentMailClient, args: z.infer<typeof DeleteEventParams>) {
    const { inboxId, eventId, ...options } = args
    return { success: true as const, ...(await client.inboxes.calendar.deleteEvent(inboxId, eventId, options)) }
}

export async function respondToInvitation(client: AgentMailClient, args: z.infer<typeof RespondToInvitationParams>) {
    const { inboxId, eventId, ...body } = args
    return client.inboxes.calendar.respondToEvent(inboxId, eventId, body)
}

export async function getCalendar(client: AgentMailClient, args: z.infer<typeof GetCalendarParams>) {
    const { inboxId, ...options } = args
    return client.inboxes.calendar.get(inboxId, options)
}

export async function updateCalendar(client: AgentMailClient, args: z.infer<typeof UpdateCalendarParams>) {
    const { inboxId, ...body } = args
    return client.inboxes.calendar.update(inboxId, body)
}

export async function authMe(client: AgentMailClient) {
    return client.auth.me()
}

export async function listApps(client: AgentMailClient, args: z.infer<typeof ListAppsParams>) {
    return client.apps.list(args)
}

export async function searchApps(client: AgentMailClient, args: z.infer<typeof SearchAppsParams>) {
    return client.apps.search(args)
}

export async function getApp(client: AgentMailClient, args: z.infer<typeof GetAppParams>) {
    return client.apps.get(args.appId)
}

export async function listAccounts(client: AgentMailClient, args: z.infer<typeof ListAccountsParams>) {
    const { appId, ...options } = args
    // The per-app route is the API's only server-side app filter, so one tool
    // fans out to whichever list answers the question asked.
    return appId === undefined ? client.accounts.list(options) : client.apps.listAccounts(appId, options)
}

export async function getMessage(client: AgentMailClient, args: z.infer<typeof GetMessageParams>) {
    const { inboxId, messageId } = args
    return withMessageAuthentication(await client.inboxes.messages.get(inboxId, messageId))
}

export async function searchInboxes(client: AgentMailClient, args: z.infer<typeof SearchInboxesParams>) {
    return client.inboxes.search(args)
}

export async function listListEntries(client: AgentMailClient, args: z.infer<typeof ListListEntriesParams>) {
    const { inboxId, direction, listType, ...options } = args
    return client.inboxes.lists.list(inboxId, direction, listType, options)
}

export async function getListEntry(client: AgentMailClient, args: z.infer<typeof GetListEntryParams>) {
    const { inboxId, direction, listType, entry } = args
    return client.inboxes.lists.get(inboxId, direction, listType, entry)
}

export async function createListEntry(client: AgentMailClient, args: z.infer<typeof CreateListEntryParams>) {
    const { inboxId, direction, listType, ...body } = args
    return client.inboxes.lists.create(inboxId, direction, listType, body)
}

export async function deleteListEntry(client: AgentMailClient, args: z.infer<typeof DeleteListEntryParams>) {
    const { inboxId, direction, listType, entry } = args
    await client.inboxes.lists.delete(inboxId, direction, listType, entry)
    return { success: true as const }
}

export async function agentAttachHuman(client: AgentMailClient, args: z.infer<typeof AgentAttachHumanParams>) {
    return client.agent.attachHuman(args)
}

export async function agentVerify(client: AgentMailClient, args: z.infer<typeof AgentVerifyParams>) {
    return client.agent.verify(args)
}

export async function getLabs(client: AgentMailClient) {
    return client.organizations.getLabs()
}

export async function joinLabs(client: AgentMailClient) {
    return client.organizations.joinLabs()
}

export async function connectApp(client: AgentMailClient, args: z.infer<typeof ConnectAppParams>) {
    const { appId, ...body } = args
    // maxRetries: 0 because the SDK's fetcher retries POSTs on 408/429/5xx, and this
    // POST mints a live sign-in session on every accepted attempt (the endpoint has no
    // idempotency key): a blind re-POST after a lost response would mint a second one
    // against the caller's bounded live-session budget.
    return client.apps.connect(appId, body, { maxRetries: 0 })
}

export async function authorizeInbox(client: AgentMailClient, args: z.infer<typeof AuthorizeInboxParams>) {
    const { inboxId, ...body } = args
    // Default retries are safe here, unlike connectApp: a repeat for the same token, inbox and
    // credential returns the same key ID instead of minting another.
    return client.inboxes.authorize(inboxId, body)
}

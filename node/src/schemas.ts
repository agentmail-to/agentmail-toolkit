import { z } from 'zod'

const InboxIdSchema = z.string().describe('ID of inbox')
const ThreadIdSchema = z.string().describe('ID of thread')
const MessageIdSchema = z.string().describe('ID of message')
const AttachmentIdSchema = z.string().describe('ID of attachment')
const DraftIdSchema = z.string().describe('ID of draft')

export const ListItemsParams = z.object({
    limit: z.number().optional().default(10).describe('Max number of items to return'),
    pageToken: z.string().optional().describe('Page token for pagination'),
})

export const GetInboxParams = z.object({
    inboxId: InboxIdSchema,
})

export const CreateInboxParams = z.object({
    username: z.string().optional().describe('Username'),
    domain: z.string().optional().describe('Domain'),
    displayName: z.string().optional().describe('Display name'),
})

export const ListInboxItemsParams = ListItemsParams.extend({
    inboxId: InboxIdSchema,
    labels: z.array(z.string()).optional().describe('Labels to filter items by'),
    before: z.string().pipe(z.coerce.date()).optional().describe('Filter items before datetime'),
    after: z.string().pipe(z.coerce.date()).optional().describe('Filter items after datetime'),
})

export const GetThreadParams = z.object({
    inboxId: InboxIdSchema,
    threadId: ThreadIdSchema,
})

export const GetAttachmentParams = z.object({
    inboxId: InboxIdSchema,
    threadId: ThreadIdSchema,
    attachmentId: AttachmentIdSchema,
})

const AttachmentSchema = z.object({
    filename: z.string().optional().describe('Filename'),
    content_id: z.string().optional().describe('Content ID for inline attachments'),
    content: z.string().optional().describe('Base64 encoded content'),
    url: z.url().optional().describe('URL'),
})

const BaseMessageParams = z.object({
    inboxId: InboxIdSchema,
    text: z.string().optional().describe('Plain text body'),
    html: z.string().optional().describe('HTML body'),
    labels: z.array(z.string()).optional().describe('Labels'),
    attachments: z.array(AttachmentSchema).optional().describe('Attachments'),
})

export const SendMessageParams = BaseMessageParams.extend({
    to: z.array(z.string()).describe('Recipients'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    subject: z.string().optional().describe('Subject'),
})

export const ReplyToMessageParams = BaseMessageParams.extend({
    messageId: MessageIdSchema,
    replyAll: z.boolean().optional().describe('Reply to all recipients'),
})

export const ForwardMessageParams = SendMessageParams.extend({
    messageId: MessageIdSchema,
})

export const UpdateMessageParams = z.object({
    inboxId: InboxIdSchema,
    messageId: MessageIdSchema,
    addLabels: z.array(z.string()).optional().describe('Labels to add'),
    removeLabels: z.array(z.string()).optional().describe('Labels to remove'),
})

// Draft schemas

export const CreateDraftParams = z.object({
    inboxId: InboxIdSchema,
    to: z.array(z.string()).optional().describe('Recipients'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    subject: z.string().optional().describe('Subject'),
    text: z.string().optional().describe('Plain text body'),
    html: z.string().optional().describe('HTML body'),
    replyTo: z.array(z.string()).optional().describe('Reply-to addresses'),
    inReplyTo: z.string().optional().describe('Message ID this draft is replying to'),
    sendAt: z.string().optional().describe('ISO 8601 datetime to schedule sending (e.g. 2026-04-01T09:00:00Z)'),
    labels: z.array(z.string()).optional().describe('Labels'),
})

export const ListDraftsParams = ListInboxItemsParams

export const GetDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

export const UpdateDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
    to: z.array(z.string()).optional().describe('Recipients'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    subject: z.string().optional().describe('Subject'),
    text: z.string().optional().describe('Plain text body'),
    html: z.string().optional().describe('HTML body'),
    replyTo: z.array(z.string()).optional().describe('Reply-to addresses'),
    sendAt: z.string().optional().describe('ISO 8601 datetime to reschedule sending'),
})

export const SendDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

export const DeleteDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

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
    clientId: z.string().optional().describe('Client-provided ID for idempotent creation'),
    metadata: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe('Custom metadata key-value pairs to attach to the inbox'),
})

export const UpdateInboxParams = z.object({
    inboxId: InboxIdSchema,
    displayName: z.string().optional().describe('Display name'),
    metadata: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .nullable()
        .optional()
        .describe('Metadata to merge into existing metadata. Set a key to null to remove it, or the whole field to null to clear all metadata'),
})

export const ListInboxItemsParams = ListItemsParams.extend({
    inboxId: InboxIdSchema,
    labels: z.array(z.string()).optional().describe('Labels to filter items by'),
    before: z.string().pipe(z.coerce.date()).optional().describe('Filter items before datetime'),
    after: z.string().pipe(z.coerce.date()).optional().describe('Filter items after datetime'),
    ascending: z.boolean().optional().describe('Sort by oldest first instead of most recent first'),
})

export const ListThreadsParams = ListInboxItemsParams.extend({
    senders: z.array(z.string()).optional().describe('Filter threads by senders (substring match; all values must match)'),
    recipients: z.array(z.string()).optional().describe('Filter threads by recipients (substring match; all values must match)'),
    subject: z.array(z.string()).optional().describe('Filter threads by subject (substring match; all values must match)'),
    includeSpam: z.boolean().optional().describe('Include threads in spam'),
    includeTrash: z.boolean().optional().describe('Include threads in trash'),
})

export const SearchInboxItemsParams = ListItemsParams.extend({
    inboxId: InboxIdSchema,
    q: z.string().describe('Full-text search query'),
    before: z.string().pipe(z.coerce.date()).optional().describe('Filter items before datetime'),
    after: z.string().pipe(z.coerce.date()).optional().describe('Filter items after datetime'),
})

export const GetThreadParams = z.object({
    inboxId: InboxIdSchema,
    threadId: ThreadIdSchema,
})

export const UpdateThreadParams = GetThreadParams.extend({
    addLabels: z.array(z.string()).optional().describe('Labels to add'),
    removeLabels: z.array(z.string()).optional().describe('Labels to remove'),
})

export const GetAttachmentParams = z.object({
    inboxId: InboxIdSchema,
    threadId: ThreadIdSchema,
    attachmentId: AttachmentIdSchema,
})

const AttachmentBaseSchema = z.object({
    filename: z.string().optional().describe('Filename'),
    contentType: z.string().optional().describe('MIME type of the attachment'),
    contentDisposition: z.enum(['inline', 'attachment']).optional().describe('Content disposition'),
    contentId: z.string().optional().describe('Content ID for inline attachments'),
})

// A two-variant union so the ADVERTISED JSON Schema expresses content/url
// exclusivity structurally (anyOf: requires content | requires url), not just in
// description text - description-only exclusivity kept tripping OpenAI app
// review's "Unclear Arguments" analyzer on every send/reply/forward/draft tool.
const AttachmentSchema = z
    .union([
        AttachmentBaseSchema.extend({
            content: z.string().describe('Base64 encoded content'),
        }),
        AttachmentBaseSchema.extend({
            url: z.url().describe('Publicly accessible URL to fetch the attachment from'),
        }),
    ])
    .describe('Attachment: provide exactly one of content (base64) or url')

const BaseMessageParams = z.object({
    inboxId: InboxIdSchema,
    text: z.string().optional().describe('Plain text body'),
    html: z.string().optional().describe('HTML body'),
    labels: z.array(z.string()).optional().describe('Labels'),
    attachments: z
        .array(AttachmentSchema)
        .optional()
        .describe('Attachments. Each item must specify exactly one of content (base64) or url'),
})

export const SendMessageParams = BaseMessageParams.extend({
    to: z.array(z.string()).describe('Recipients'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    subject: z.string().optional().describe('Subject'),
    replyTo: z.array(z.string()).optional().describe('Reply-to addresses'),
})

export const ReplyToMessageParams = BaseMessageParams.extend({
    messageId: MessageIdSchema,
    replyAll: z
        .boolean()
        .optional()
        .describe('Reply to all original recipients. Mutually exclusive with to, cc, and bcc — the API rejects the request if both are set'),
    to: z
        .array(z.string())
        .optional()
        .describe('Override reply recipients, replacing the default (the original sender). Omit to reply to the sender only. Cannot be combined with replyAll'),
    cc: z.array(z.string()).optional().describe('Override CC recipients. Cannot be combined with replyAll'),
    bcc: z.array(z.string()).optional().describe('Override BCC recipients. Cannot be combined with replyAll'),
    replyTo: z.array(z.string()).optional().describe('Reply-to addresses'),
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

export const ListMessagesParams = ListInboxItemsParams.extend({
    from: z.array(z.string()).optional().describe('Filter messages by sender (substring match; all values must match)'),
    to: z.array(z.string()).optional().describe('Filter messages by recipients (substring match; all values must match)'),
    subject: z.array(z.string()).optional().describe('Filter messages by subject (substring match; all values must match)'),
    includeSpam: z.boolean().optional().describe('Include messages in spam'),
    includeTrash: z.boolean().optional().describe('Include messages in trash'),
})

// Draft schemas

export const CreateDraftParams = BaseMessageParams.extend({
    to: z.array(z.string()).optional().describe('Recipients'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    subject: z.string().optional().describe('Subject'),
    replyTo: z.array(z.string()).optional().describe('Reply-to addresses'),
    inReplyTo: z.string().optional().describe('Message ID this draft is replying to'),
    sendAt: z.string().pipe(z.coerce.date()).optional().describe('ISO 8601 datetime to schedule sending (e.g. 2026-04-01T09:00:00Z)'),
    clientId: z.string().optional().describe('Client-provided ID for idempotent creation'),
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
    sendAt: z.string().pipe(z.coerce.date()).optional().describe('ISO 8601 datetime to reschedule sending'),
})

export const SendDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

export const DeleteDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

export const AuthMeParams = z.object({})

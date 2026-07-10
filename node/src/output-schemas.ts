import { z } from 'zod'

// Output (result) schemas for the AgentMail SDK's response shapes, derived from the
// installed `agentmail` SDK (0.5.11) runtime types (all responses are genuine camelCase
// JS objects at runtime, per the SDK's Fern-generated serializers). Dates are modeled as
// ISO-8601 strings because MCP structuredContent must be JSON-Schema-representable; the
// `normalize` helper in util.ts converts real Date objects to ISO strings before a result
// is checked against these schemas.

const isoDate = () => z.iso.datetime().describe('ISO 8601 datetime')

const MetadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

export const PaginationSchema = z.looseObject({
    count: z.number().describe('Number of items returned'),
    limit: z.number().optional().describe('Limit of number of items returned'),
    nextPageToken: z.string().optional().describe('Page token for pagination'),
})

// Stable result for tools whose SDK call returns void (deletes).
export const VoidResultSchema = z.looseObject({
    success: z.literal(true),
})

export const InboxSchema = z.looseObject({
    podId: z.string(),
    inboxId: z.string(),
    email: z.string(),
    displayName: z.string().optional(),
    clientId: z.string().optional(),
    metadata: MetadataSchema.optional().describe('Custom metadata attached to the inbox'),
    updatedAt: isoDate(),
    createdAt: isoDate(),
})

export const ListInboxesResponseSchema = PaginationSchema.extend({
    inboxes: z.array(InboxSchema),
})

const AttachmentMetaSchema = z.looseObject({
    attachmentId: z.string(),
    filename: z.string().optional(),
    size: z.number(),
    contentType: z.string().optional(),
    contentDisposition: z.string().optional(),
    contentId: z.string().optional(),
})

export const AttachmentResponseSchema = AttachmentMetaSchema.extend({
    downloadUrl: z.string().describe('URL to download the attachment'),
    expiresAt: isoDate().describe('Time at which the download URL expires'),
    text: z.string().optional().describe('Extracted text (PDF/DOCX only, toolkit-added)'),
    extractionError: z.string().optional().describe('Set when PDF/DOCX text extraction failed or was skipped (toolkit-added)'),
})

// "Item" variants are what list/search endpoints return (a subset of the full
// get-by-id shape). The full shapes extend the item shapes with the extra fields.

export const ThreadItemSchema = z.looseObject({
    inboxId: z.string(),
    threadId: z.string(),
    labels: z.array(z.string()),
    timestamp: isoDate(),
    receivedTimestamp: isoDate().optional(),
    sentTimestamp: isoDate().optional(),
    senders: z.array(z.string()),
    recipients: z.array(z.string()),
    subject: z.string().optional(),
    preview: z.string().optional(),
    attachments: z.array(AttachmentMetaSchema).optional(),
    lastMessageId: z.string(),
    messageCount: z.number(),
    size: z.number(),
    updatedAt: isoDate(),
    createdAt: isoDate(),
})

export const MessageItemSchema = z.looseObject({
    inboxId: z.string(),
    threadId: z.string(),
    messageId: z.string(),
    labels: z.array(z.string()),
    timestamp: isoDate(),
    from: z.string(),
    to: z.array(z.string()),
    cc: z.array(z.string()).optional(),
    bcc: z.array(z.string()).optional(),
    subject: z.string().optional(),
    preview: z.string().optional(),
    attachments: z.array(AttachmentMetaSchema).optional(),
    inReplyTo: z.string().optional(),
    references: z.array(z.string()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    size: z.number(),
    updatedAt: isoDate(),
    createdAt: isoDate(),
})

export const MessageSchema = MessageItemSchema.extend({
    replyTo: z.array(z.string()).optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    extractedText: z.string().optional(),
    extractedHtml: z.string().optional(),
})

export const ThreadSchema = ThreadItemSchema.extend({
    messages: z.array(MessageSchema).describe('Messages in thread, ordered by timestamp ascending'),
})

export const ListThreadsResponseSchema = PaginationSchema.extend({
    threads: z.array(ThreadItemSchema),
})

export const SearchThreadsResponseSchema = ListThreadsResponseSchema

export const ListMessagesResponseSchema = PaginationSchema.extend({
    messages: z.array(MessageItemSchema),
})

export const SearchMessagesResponseSchema = ListMessagesResponseSchema

export const UpdateThreadResponseSchema = z.looseObject({
    threadId: z.string(),
    labels: z.array(z.string()),
})

export const UpdateMessageResponseSchema = z.looseObject({
    messageId: z.string(),
    labels: z.array(z.string()),
})

export const SendMessageResponseSchema = z.looseObject({
    messageId: z.string(),
    threadId: z.string(),
})

const DraftSendStatusSchema = z.enum(['scheduled', 'sending', 'failed'])

export const DraftItemSchema = z.looseObject({
    inboxId: z.string(),
    draftId: z.string(),
    labels: z.array(z.string()),
    to: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
    bcc: z.array(z.string()).optional(),
    subject: z.string().optional(),
    preview: z.string().optional(),
    attachments: z.array(AttachmentMetaSchema).optional(),
    inReplyTo: z.string().optional(),
    sendStatus: DraftSendStatusSchema.optional(),
    sendAt: isoDate().optional(),
    updatedAt: isoDate(),
})

export const DraftSchema = DraftItemSchema.extend({
    clientId: z.string().optional(),
    replyTo: z.array(z.string()).optional(),
    text: z.string().optional(),
    html: z.string().optional(),
    references: z.array(z.string()).optional(),
    createdAt: isoDate(),
})

export const ListDraftsResponseSchema = PaginationSchema.extend({
    drafts: z.array(DraftItemSchema),
})

const ScopeTypeSchema = z.enum(['organization', 'pod', 'inbox'])

export const IdentitySchema = z.looseObject({
    scopeType: ScopeTypeSchema,
    scopeId: z.string(),
    organizationId: z.string(),
    podId: z.string().optional(),
    inboxId: z.string().optional(),
    apiKeyId: z.string().optional(),
})

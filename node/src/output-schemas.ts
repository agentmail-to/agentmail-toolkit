import { z } from 'zod'

// Output (result) schemas for the AgentMail SDK's response shapes, derived from the
// installed `agentmail` SDK (0.5.22) runtime types (all responses are genuine camelCase
// JS objects at runtime, per the SDK's Fern-generated serializers). Dates are modeled as
// ISO-8601 strings because MCP structuredContent must be JSON-Schema-representable; the
// `normalize` helper in util.ts converts real Date objects to ISO strings before a result
// is checked against these schemas.
//
// These schemas are an ALLOWLIST, at every nesting level: plain z.object (strip mode)
// drops any field not declared here before a result leaves the toolkit. The SDK parses
// API responses with unrecognizedObjectKeys:"passthrough", so internal/undisclosed API
// fields (organization_id, pod_id, future debug data) would otherwise flow through to
// the model — the exact data-minimization failure OpenAI app review rejects. Do not
// switch these to looseObject; add a field explicitly if a consumer needs it.

const isoDate = () => z.iso.datetime().describe('ISO 8601 datetime')

const MetadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

export const PaginationSchema = z.object({
    count: z.number().describe('Number of items returned'),
    limit: z.number().optional().describe('Limit of number of items returned'),
    nextPageToken: z.string().optional().describe('Page token for pagination'),
})

// Stable result for tools whose SDK call returns void (deletes).
export const VoidResultSchema = z.object({
    success: z.literal(true),
})

// Internal identifiers (podId, clientId) deliberately excluded — not needed for any
// email task; flagged by OpenAI app review as undisclosed personal identifiers.
export const InboxSchema = z.object({
    inboxId: z.string(),
    email: z.string(),
    displayName: z.string().optional(),
    metadata: MetadataSchema.optional().describe('Custom metadata attached to the inbox'),
    updatedAt: isoDate(),
    createdAt: isoDate(),
})

export const ListInboxesResponseSchema = PaginationSchema.extend({
    inboxes: z.array(InboxSchema),
})

const AttachmentMetaSchema = z.object({
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
    text: z.string().optional().describe('Extracted text (PDF/DOCX only, toolkit-added; absent when extraction was skipped or failed - see download URL)'),
})

// "Item" variants are what list/search endpoints return (a subset of the full
// get-by-id shape). The full shapes extend the item shapes with the extra fields.

export const ThreadItemSchema = z.object({
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

export const MessageItemSchema = z.object({
    inboxId: z.string(),
    threadId: z.string(),
    messageId: z.string(),
    labels: z.array(z.string()),
    timestamp: isoDate(),
    from: z.string(),
    // Optional to match what the API sends, not the SDK type: a message with no
    // To header (Bcc-only delivery, undisclosed recipients) is stored and
    // returned without `to`. Requiring it here turned every list, search,
    // thread, or get result holding such a message into an "output schema"
    // failure, since MessageSchema and ThreadSchema build on this shape.
    to: z.array(z.string()).optional(),
    cc: z.array(z.string()).optional(),
    bcc: z.array(z.string()).optional(),
    subject: z.string().optional(),
    preview: z.string().optional(),
    attachments: z.array(AttachmentMetaSchema).optional(),
    inReplyTo: z.string().optional(),
    references: z.array(z.string()).optional(),
    // Raw RFC-822 `headers` deliberately excluded: they carry personal identifiers
    // (Received-chain IPs, Return-Path) a model never needs — flagged by OpenAI app
    // review. Threading works via inReplyTo/references.
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

// Search results are list items plus `highlights` (SDK SearchThreadItem /
// SearchMessageItem). Modeled explicitly because strip mode would otherwise
// silently drop the match excerpts.
const HighlightsSchema = z.object({
    from: z.array(z.string()).optional().describe('Matched fragments from the sender address'),
    recipients: z.array(z.string()).optional().describe('Matched fragments from recipient addresses'),
    subject: z.array(z.string()).optional().describe('Matched fragments from the subject'),
    text: z.array(z.string()).optional().describe('Matched fragments from the body'),
})

export const SearchThreadsResponseSchema = PaginationSchema.extend({
    threads: z.array(
        ThreadItemSchema.extend({
            highlights: HighlightsSchema.optional().describe('Matched fragments per field, present when the query matched an indexed field'),
        })
    ),
})

export const ListMessagesResponseSchema = PaginationSchema.extend({
    messages: z.array(MessageItemSchema),
})

export const SearchMessagesResponseSchema = PaginationSchema.extend({
    messages: z.array(
        MessageItemSchema.extend({
            highlights: HighlightsSchema.optional().describe('Matched fragments per field, present when the query matched an indexed field'),
        })
    ),
})

export const UpdateThreadResponseSchema = z.object({
    threadId: z.string(),
    labels: z.array(z.string()),
})

export const UpdateMessageResponseSchema = z.object({
    messageId: z.string(),
    labels: z.array(z.string()),
})

export const SendMessageResponseSchema = z.object({
    messageId: z.string(),
    threadId: z.string(),
})

const DraftSendStatusSchema = z.enum(['scheduled', 'sending', 'failed'])

export const DraftItemSchema = z.object({
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

export const IdentitySchema = z.object({
    scopeType: ScopeTypeSchema,
    scopeId: z.string(),
    organizationId: z.string(),
    podId: z.string().optional(),
    inboxId: z.string().optional(),
    apiKeyId: z.string().optional(),
})

export const AgentAttachHumanResponseSchema = z.object({
    humanEmail: z.string().describe('Email address of the attached human'),
    instructions: z.string().describe('Next steps for the agent, in plain text'),
})

export const AgentVerifyResponseSchema = z.object({
    verified: z.boolean().describe('Whether the organization was verified'),
})

// One shape for both projections GET /apps/{id} serves: a curated catalog entry (name +
// updatedAt + display fields) and the bare identity resolved for an app the catalog does not
// list — one the caller holds an account at, or any registered app (id, maybe a name,
// nothing else). Catalog membership shows as updatedAt
// being present — the API publishes no flag for it. Display fields are app-authored.
export const AppSchema = z.object({
    appId: z.string(),
    slug: z
        .string()
        .optional()
        .describe(
            'Short name accepted in place of appId by get_app, list_accounts and connect_app. Present on catalog entries; store appId, the permanent ID'
        ),
    name: z.string().optional().describe('Display name of app'),
    updatedAt: isoDate()
        .optional()
        .describe(
            'Time at which the listing was last updated. Present only for curated catalog entries; absent means the app resolved as a bare identity'
        ),
    description: z.string().optional(),
    // Plain strings, not the input enum: a category the API adds before the next SDK release must not
    // fail the output check.
    categories: z
        .array(z.string())
        .optional()
        .describe('Kinds of app, up to 3 (such as search, scraping or payments). Omitted when the app sets none'),
    logoUrl: z.string().optional(),
    termsUrl: z.string().optional(),
    privacyUrl: z.string().optional(),
    ownerSignupLimit: z
        .number()
        .optional()
        .describe(
            "Maximum number of your organization's inboxes that may sign up at this app. Absent when the app sets no limit; 0 means new sign-ups are paused, while inboxes that already hold an account can still sign in. It counts every inbox that has ever signed up, including disabled accounts that list_accounts does not show, and can lag the live value: treat it as a hint and rely on connect_app's limit error"
        ),
})

// The browse surfaces (list, search) serve catalog entries only, where the API requires name and
// updatedAt — declaring them required keeps the output-schema net able to catch a malformed entry
// instead of passing a nameless row to the model. Only get_app and the embedded app on the
// accounts response can be a bare identity.
const CatalogAppSchema = AppSchema.required({ name: true, updatedAt: true })

export const ListAppsResponseSchema = PaginationSchema.extend({
    apps: z.array(CatalogAppSchema),
})

// Search's own envelope, NOT PaginationSchema: the route is unpaginated, so advertising an
// optional nextPageToken would invite a model to read its absence as "the list is complete" —
// wrong on a route that truncates silently. count and limit are always sent.
export const SearchAppsResponseSchema = z.object({
    count: z.number().describe('Number of items returned'),
    limit: z.number().describe('Limit of number of items returned'),
    apps: z.array(CatalogAppSchema),
})

// podId and organizationId are on the wire but deliberately excluded — the same internal-identifier
// rule as InboxSchema above. accountId stays: it is the resource's own addressable id, the same
// class as inboxId. The legacy providerId / providerName aliases are on the wire too and are
// stripped: the tools speak only the app vocabulary.
export const AccountSchema = z.object({
    accountId: z.string(),
    appId: z.string(),
    appName: z.string().optional().describe('Display name of app'),
    inboxId: z.string().describe('The inbox (email address) holding the account'),
    firstSignedInAt: isoDate().describe('Time of first sign-in at app'),
    lastSignedInAt: isoDate().describe('Time of most recent sign-in at app'),
    signInCount: z.number().describe('Number of sign-ins at app'),
})

// Shared by the all-apps and per-app account lists: the per-app route embeds the app, the
// all-apps one has no single app to embed.
export const ListAccountsResponseSchema = PaginationSchema.extend({
    app: AppSchema.optional().describe('The app, when the list was narrowed to one and it resolves for this caller'),
    accounts: z.array(AccountSchema),
})

export const ConnectAppResponseSchema = z.object({
    apiKeyId: z.string().describe('ID of the pending sign-in key; it turns active once the sign-in completes'),
    magicUrl: z.string().describe('Single-use sign-in URL to open in the client that will hold the sign-in'),
    expiresAt: isoDate().describe('Time at which the magic URL stops working'),
})

// organizationId and podId are on the wire but deliberately excluded — the InboxSchema
// internal-identifier rule. readOnly stays: it tells the model an entry is an AgentMail
// suppression it cannot delete, before it tries.
export const ListEntrySchema = z.object({
    entry: z.string().describe('Email address or domain'),
    direction: z.enum(['send', 'receive', 'reply']),
    listType: z.enum(['allow', 'block']),
    entryType: z.enum(['email', 'domain']),
    reason: z.string().optional().describe('Why the entry was added'),
    inboxId: z.string().optional().describe('The inbox the entry is scoped to, when inbox-scoped'),
    readOnly: z
        .boolean()
        .optional()
        .describe('True for suppressions AgentMail added itself (bounce, complaint, unsubscribe); these cannot be deleted'),
    createdAt: isoDate(),
})

export const ListListEntriesResponseSchema = PaginationSchema.extend({
    entries: z.array(ListEntrySchema).describe('Ordered by entry ascending'),
})

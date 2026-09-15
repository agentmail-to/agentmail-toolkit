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
    to: z.array(z.string()),
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

export const AgentVerifyResponseSchema = z.object({
    verified: z.boolean().describe('Whether the organization was verified'),
})

// One shape for both projections GET /providers/{id} serves: a curated catalog entry (name +
// updatedAt + display fields) and the bare identity resolved for an unlisted provider the caller
// holds an account at (id, maybe a name, nothing else). Catalog membership shows as updatedAt
// being present — the API publishes no flag for it. Display fields are provider-authored.
export const ProviderSchema = z.object({
    providerId: z.string(),
    name: z.string().optional().describe('Display name of provider'),
    updatedAt: isoDate()
        .optional()
        .describe(
            'Time at which the listing was last updated. Present only for curated catalog entries; absent means the provider resolved as a bare identity'
        ),
    description: z.string().optional(),
    logoUrl: z.string().optional(),
    termsUrl: z.string().optional(),
    privacyUrl: z.string().optional(),
})

// The browse surfaces (list, search) serve catalog entries only, where the API requires name and
// updatedAt — declaring them required keeps the output-schema net able to catch a malformed entry
// instead of passing a nameless row to the model. Only get_provider and the embedded provider on
// the accounts response can be a bare identity.
const CatalogProviderSchema = ProviderSchema.required({ name: true, updatedAt: true })

export const ListProvidersResponseSchema = PaginationSchema.extend({
    providers: z.array(CatalogProviderSchema),
})

// Search's own envelope, NOT PaginationSchema: the route is unpaginated, so advertising an
// optional nextPageToken would invite a model to read its absence as "the list is complete" —
// wrong on a route that truncates silently. count and limit are always sent.
export const SearchProvidersResponseSchema = z.object({
    count: z.number().describe('Number of items returned'),
    limit: z.number().describe('Limit of number of items returned'),
    providers: z.array(CatalogProviderSchema),
})

// podId and organizationId are on the wire but deliberately excluded — the same internal-identifier
// rule as InboxSchema above. accountId stays: it is the resource's own addressable id, the same
// class as inboxId.
export const AccountSchema = z.object({
    accountId: z.string(),
    providerId: z.string(),
    providerName: z.string().optional().describe('Display name of provider'),
    inboxId: z.string().describe('The inbox (email address) holding the account'),
    firstSignedInAt: isoDate().describe('Time of first sign-in at provider'),
    lastSignedInAt: isoDate().describe('Time of most recent sign-in at provider'),
    signInCount: z.number().describe('Number of sign-ins at provider'),
})

// Shared by the cross-provider and per-provider account lists: the per-provider route embeds
// the provider, the cross-provider one has no single provider to embed.
export const ListAccountsResponseSchema = PaginationSchema.extend({
    provider: ProviderSchema.optional().describe('The provider, when the list was narrowed to one and it resolves for this caller'),
    accounts: z.array(AccountSchema),
})

// A narrow read of the sign-in key connect_provider minted: the model needs its status, not the
// key's permission map, creator, or material — the identifier over-exposure that got auth_me
// pulled from the hosted catalog.
export const ProviderConnectionSchema = z.object({
    apiKeyId: z.string(),
    status: z.enum(['pending', 'active']).describe('pending until the human completes the browser sign-in, then active'),
    inboxId: z.string().optional().describe('The inbox the sign-in is for'),
    expiresAt: isoDate()
        .optional()
        .describe('While pending, when the sign-in stops being completable; once active, when the key itself expires'),
})

export const ConnectProviderResponseSchema = z.object({
    apiKeyId: z.string().describe('ID of the pending sign-in key. Its status turns active once the human completes the sign-in'),
    magicUrl: z.string().describe('Single-use sign-in URL for a human to open in a browser'),
    expiresAt: isoDate().describe('Time at which the magic URL stops working'),
})

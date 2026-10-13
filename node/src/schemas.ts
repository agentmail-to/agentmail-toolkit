import { AgentMail } from 'agentmail'
import { z } from 'zod'

// Where each ID comes from, so an agent can fill it without guessing. Message IDs are RFC 5322
// Message-IDs and keep their angle brackets; get_attachment reads the thread's attachment list,
// so an attachment ID is taken from there.
const InboxIdSchema = z.string().describe("Inbox ID: the inbox's email address, from list_inboxes")

// Shared by every id or value the SDK splices into a URL path. A refine adds no JSON-schema
// keyword for a host to choke on; it only keeps '.' and '..' out of a segment the URL parser
// would otherwise normalize onto a different route.
const notDotSegment = (value: string) => value !== '.' && value !== '..'
const ThreadIdSchema = z.string().describe("Thread ID, from list_threads, search_threads, or a message's threadId")
const MessageIdSchema = z.string().describe('Message ID with its angle brackets, from list_messages, search_messages, or get_thread')
const AttachmentIdSchema = z.string().describe("Attachment ID, from a thread's attachments in list_threads or get_thread")
const DraftIdSchema = z.string().describe('Draft ID, from list_drafts or create_draft')

const PageTokenSchema = z.string().optional().describe("nextPageToken from the previous page's result; omit for the first page")

export const ListItemsParams = z.object({
    limit: z.number().optional().default(10).describe('Number of items per page'),
    pageToken: PageTokenSchema,
})

export const GetInboxParams = z.object({
    inboxId: InboxIdSchema,
})

export const CreateInboxParams = z.object({
    username: z.string().optional().describe('Part of the address before the @; a random one is generated when omitted'),
    domain: z.string().optional().describe('Domain of the address, agentmail.to when omitted; a custom domain must be verified first'),
    displayName: z.string().optional().describe('Sender name recipients see; "AgentMail" when omitted, and an empty string sends none'),
    clientId: z.string().optional().describe('Your idempotency key: creating again with the same clientId returns the existing inbox'),
    metadata: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .describe('Your own key-value data, stored on the inbox and returned with it; recipients never see it'),
})

export const UpdateInboxParams = z.object({
    inboxId: InboxIdSchema,
    displayName: z.string().optional().describe('New sender name recipients see on mail from this inbox'),
    metadata: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
        .nullable()
        .optional()
        .describe('Metadata to merge into existing metadata. Set a key to null to remove it, or the whole field to null to clear all metadata'),
})

// The toolkit parses these with Date and sends UTC, so any ISO 8601 offset works; a time
// without one would be read in the server's own timezone.
const BeforeSchema = z
    .string()
    .pipe(z.coerce.date())
    .optional()
    .describe('Only items before this time, as ISO 8601 with a timezone (e.g. 2026-04-01T09:00:00Z)')
const AfterSchema = z
    .string()
    .pipe(z.coerce.date())
    .optional()
    .describe('Only items at or after this time, as ISO 8601 with a timezone (e.g. 2026-04-01T09:00:00Z)')

export const ListInboxItemsParams = ListItemsParams.extend({
    inboxId: InboxIdSchema,
    labels: z.array(z.string()).optional().describe('Only items carrying all of these labels, such as unread or your own'),
    before: BeforeSchema,
    after: AfterSchema,
    ascending: z.boolean().optional().describe('Sort by oldest first instead of most recent first'),
})

// The API matches these by word prefix, case- and accent-insensitive: every word of every value
// must start a word in the field ("acme" matches bob@acme.com; "voice" does not match "invoice").
export const ListThreadsParams = ListInboxItemsParams.extend({
    senders: z
        .array(z.string())
        .optional()
        .describe('Only threads whose senders match every value by word prefix, e.g. "acme" matches bob@acme.com'),
    recipients: z.array(z.string()).optional().describe('Only threads whose To, Cc or Bcc addresses match every value by word prefix'),
    subject: z.array(z.string()).optional().describe("Only threads whose subject (the first message's) matches every value by word prefix"),
    includeSpam: z.boolean().optional().describe('Also return threads labeled spam, which are left out when omitted'),
    includeTrash: z.boolean().optional().describe('Also return threads labeled trash, which are left out when omitted'),
})

export const SearchInboxItemsParams = ListItemsParams.extend({
    inboxId: InboxIdSchema,
    q: z.string().describe('Words to find, all required, in the sender, recipients, subject or body; quotes and operators are literal'),
    before: BeforeSchema,
    after: AfterSchema,
})

export const GetMessageParams = z.object({
    inboxId: InboxIdSchema,
    messageId: MessageIdSchema,
})

// q bounds mirror the API's (2 to 256 characters); default page size matches list_inboxes, and the
// cap mirrors the API's MAX_SEARCH_LIMIT so an oversized ask is rejected locally with a named message.
export const SearchInboxesParams = ListItemsParams.extend({
    q: z.string().min(2).max(256).describe('Words matched by prefix against inbox addresses and display names, or a full address'),
    limit: z.number().int().positive().max(100).optional().default(10).describe('Number of items per page'),
})

// One set of tools for every allow/block list an inbox has: which list is a parameter, not a
// tool. The enums mirror the API's Direction and ListType exactly.
const ListDirectionSchema = z
    .enum(['send', 'receive', 'reply'])
    .describe(
        'Which traffic the list governs: send filters the recipients of outbound mail; receive filters the senders of new inbound mail; reply filters the senders of inbound mail that continues a thread this inbox already replied to'
    )
const ListTypeSchema = z
    .enum(['allow', 'block'])
    .describe('allow: once the list has an entry, only listed addresses pass; block: listed addresses are blocked')
// The same dot-segment guard as AppIdSchema: the SDK splices the entry into the URL path.
const ListEntryValueSchema = z
    .string()
    .min(1)
    .refine(notDotSegment, 'must be an email address or domain')
    .describe('The email address (name@example.com) or domain (example.com) the entry matches')

export const ListListEntriesParams = ListItemsParams.extend({
    inboxId: InboxIdSchema,
    direction: ListDirectionSchema,
    listType: ListTypeSchema,
})

export const GetListEntryParams = z.object({
    inboxId: InboxIdSchema,
    direction: ListDirectionSchema,
    listType: ListTypeSchema,
    entry: ListEntryValueSchema,
})

export const CreateListEntryParams = z.object({
    inboxId: InboxIdSchema,
    direction: ListDirectionSchema,
    listType: ListTypeSchema,
    entry: ListEntryValueSchema.describe('Email address (name@example.com) or domain (example.com) to add; a domain matches only itself'),
    reason: z.string().optional().describe('Your note on why the entry was added, returned when the entry is read'),
})

export const DeleteListEntryParams = GetListEntryParams

export const GetThreadParams = z.object({
    inboxId: InboxIdSchema,
    threadId: ThreadIdSchema,
})

export const UpdateThreadParams = GetThreadParams.extend({
    addLabels: z
        .array(z.string())
        .optional()
        .describe('Labels to add to every message in the thread, e.g. trash to move it to trash, or your own'),
    removeLabels: z.array(z.string()).optional().describe('Labels to remove from every message in the thread, e.g. unread to mark it read'),
})

export const GetAttachmentParams = z.object({
    inboxId: InboxIdSchema,
    threadId: ThreadIdSchema,
    attachmentId: AttachmentIdSchema,
})

const AttachmentBaseSchema = z.object({
    filename: z.string().optional().describe('File name recipients see, e.g. report.pdf'),
    contentType: z.string().optional().describe('MIME type, e.g. application/pdf; inferred when omitted'),
    contentDisposition: z
        .enum(['inline', 'attachment'])
        .optional()
        .describe('inline to show it in the HTML body, attachment to offer it as a download'),
    contentId: z.string().optional().describe('ID the HTML body references as cid:<contentId> to show it inline'),
})

// A two-variant union so the ADVERTISED JSON Schema expresses content/url
// exclusivity structurally (anyOf: requires content | requires url), not just in
// description text - description-only exclusivity kept tripping OpenAI app
// review's "Unclear Arguments" analyzer on every send/reply/forward/draft tool.
// Strict variants so an attachment carrying BOTH fields is rejected (the other
// field is an unknown key in each variant), matching the API's own refine
// ("At least one of content or url must be provided, but not both",
// SendAttachmentSchema in agentmail-api) instead of silently dropping one.
const AttachmentSchema = z
    .union([
        z.strictObject({
            ...AttachmentBaseSchema.shape,
            content: z.string().describe('Base64 encoded content'),
        }),
        z.strictObject({
            ...AttachmentBaseSchema.shape,
            url: z.url().describe('Publicly accessible URL to fetch the attachment from'),
        }),
    ])
    .describe('Attachment: provide exactly one of content (base64) or url')

// Addresses take a bare address or "Name <address>" form. Send and forward need at least one of
// to, cc or bcc; a draft needs a recipient only once it is scheduled.
const ADDRESSES = 'each a bare address or "Name <address>"'
const ToSchema = z.array(z.string()).describe(`Recipient addresses, ${ADDRESSES}`)
const CcSchema = z.array(z.string()).optional().describe('Copied addresses, visible to every recipient')
const BccSchema = z.array(z.string()).optional().describe('Blind-copied addresses, hidden from the other recipients')
const SubjectSchema = z.string().optional().describe('Subject line recipients see')
const ReplyToSchema = z.array(z.string()).optional().describe('Addresses that replies should go to instead of this inbox')
const TextSchema = z.string().optional().describe('Plain-text body; include it even with html, since no text version is generated from html')
const HtmlSchema = z.string().optional().describe('HTML body for formatted mail; inline images use cid:<contentId>')

const BaseMessageParams = z.object({
    inboxId: InboxIdSchema,
    text: TextSchema,
    html: HtmlSchema,
    labels: z
        .array(z.string())
        .optional()
        .describe('Your own labels for the message; AgentMail sets system labels such as sent'),
    attachments: z
        .array(AttachmentSchema)
        .optional()
        .describe('Attachments. Each item must specify exactly one of content (base64) or url'),
})

export const SendMessageParams = BaseMessageParams.extend({
    to: ToSchema.describe(`Recipient addresses, ${ADDRESSES}; at least one of to, cc or bcc is required`),
    cc: CcSchema,
    bcc: BccSchema,
    subject: SubjectSchema,
    replyTo: ReplyToSchema,
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
        .describe(
            "Recipients, replacing the default: the original's Reply-To, else its sender (for a message this inbox sent, that is this inbox). Cannot be combined with replyAll"
        ),
    cc: z.array(z.string()).optional().describe('Override CC recipients. Cannot be combined with replyAll'),
    bcc: z.array(z.string()).optional().describe('Override BCC recipients. Cannot be combined with replyAll'),
    replyTo: ReplyToSchema,
    // Mirrors the API's ReplyMessageSchema refine (agentmail-api schemas/message.ts),
    // predicate and error text both - reject the combination locally instead of
    // round-tripping a request the API will reject. NOTE: the MCP SDK validates
    // tools/call args against a z.object it rebuilds from the raw shape, which
    // drops root-level refines - runTool in mcp.ts re-parses with this schema so
    // the refine is enforced on that path too.
}).refine((data) => !(data.replyAll && (data.to || data.cc || data.bcc)), {
    message: 'Cannot specify to, cc, or bcc when replyAll is true',
    path: ['replyAll'],
})

export const ForwardMessageParams = SendMessageParams.extend({
    messageId: z.string().describe('ID of the message to forward, with its angle brackets; its body and all attachments are included'),
    subject: z.string().optional().describe('Subject line; "Fwd: " plus the original subject when omitted'),
})

export const UpdateMessageParams = z.object({
    inboxId: InboxIdSchema,
    messageId: MessageIdSchema,
    addLabels: z.array(z.string()).optional().describe('Labels to add to the message, e.g. unread or your own'),
    removeLabels: z.array(z.string()).optional().describe('Labels to remove from the message, e.g. unread to mark it read'),
})

export const ListMessagesParams = ListInboxItemsParams.extend({
    from: z
        .array(z.string())
        .optional()
        .describe('Only messages whose sender matches every value by word prefix, e.g. "acme" matches bob@acme.com'),
    to: z.array(z.string()).optional().describe('Only messages whose To, Cc or Bcc addresses match every value by word prefix'),
    subject: z.array(z.string()).optional().describe('Only messages whose subject matches every value by word prefix'),
    includeSpam: z.boolean().optional().describe('Also return messages labeled spam, which are left out when omitted'),
    includeTrash: z.boolean().optional().describe('Also return messages labeled trash, which are left out when omitted'),
})

// Draft schemas

// The same Date parse as before/after; a time already past sends within a minute.
const SendAtSchema = z.string().pipe(z.coerce.date()).optional()

export const CreateDraftParams = BaseMessageParams.extend({
    to: ToSchema.optional(),
    cc: CcSchema,
    bcc: BccSchema,
    subject: SubjectSchema,
    replyTo: ReplyToSchema,
    inReplyTo: z
        .string()
        .optional()
        .describe('Message ID (angle brackets included) of a message in this inbox to reply to; the draft then joins its thread'),
    sendAt: SendAtSchema.describe('When to send it, as ISO 8601 with a timezone (e.g. 2026-04-01T09:00:00Z); a past time sends within a minute'),
    clientId: z.string().optional().describe('Your idempotency key: creating again with the same clientId returns the existing draft'),
})

export const ListDraftsParams = ListInboxItemsParams

export const GetDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

export const UpdateDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
    to: ToSchema.optional(),
    cc: CcSchema,
    bcc: BccSchema,
    subject: SubjectSchema,
    text: TextSchema,
    html: HtmlSchema,
    replyTo: ReplyToSchema,
    sendAt: SendAtSchema.describe('New send time, as ISO 8601 with a timezone (e.g. 2026-04-01T09:00:00Z)'),
})

export const SendDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

export const DeleteDraftParams = z.object({
    inboxId: InboxIdSchema,
    draftId: DraftIdSchema,
})

export const NoParams = z.object({})

// Agent schemas

export const AgentAttachHumanParams = z.object({
    humanEmail: z.string().describe('Email address of the human you work for. They are emailed a 6-digit verification code'),
})

export const AgentVerifyParams = z.object({
    otpCode: z.string().describe('6-digit verification code emailed to the human attached to the organization'),
})

// App schemas

// A plain described string, not z.uuid(): the API takes an app ID or a catalog app's slug in the same
// path segment, and zod's uuid would also emit `format: "uuid"` plus a long `pattern` into every
// adapter's JSON Schema, which schema-strict hosts (Gemini's function-declaration subset) reject or
// drop. The API resolves the reference and answers a named 404 or 400.
const AppIdSchema = z
    .string()
    .min(1)
    .refine(notDotSegment, 'must be an app ID or slug')
    .describe(
        'ID of app (from list_apps or search_apps), or the slug of an app in the catalog, such as "firecrawl" (case, spaces and punctuation are ignored)'
    )

// App list params deliberately do NOT reuse ListItemsParams: its `.default(10)` is wrong for
// the accounts drill-down, which pages a filtered index where short and empty pages are normal —
// forcing 10-row reads would multiply the walk ~10x over the API's own 100 default. The `.max()`
// bounds mirror the API's own caps (100 list / 50 search) so an oversized ask is rejected locally
// with a named message instead of an opaque upstream 400.
const AppPageParams = z.object({
    limit: z.number().int().positive().max(100).optional().describe('Number of items per page'),
    pageToken: PageTokenSchema,
})

// The SDK's AppCategory is the API's vocabulary, so a category the API would 400 is refused here
// first, and an SDK upgrade carries new categories without a toolkit edit.
export const ListAppsParams = AppPageParams.extend({
    category: z
        .enum(AgentMail.AppCategory)
        .optional()
        .describe(
            'Only apps of this kind. A filtered page can hold fewer than limit apps while more remain: page until nextPageToken is absent, and reuse a pageToken only with the category it was returned for'
        ),
})

export const SearchAppsParams = z.object({
    q: z.string().min(1).max(128).describe('Name (or name prefix) to search for'),
    limit: z.number().int().positive().max(50).optional().describe('Number of apps to return'),
})

export const GetAppParams = z.object({
    appId: AppIdSchema,
})

// One account-list tool: across every app by default, narrowed to one app when appId is given
// (the per-app route is the only server-side filter the API offers).
export const ListAccountsParams = AppPageParams.extend({
    appId: AppIdSchema.optional().describe(
        'Narrow to one app (ID from list_apps or search_apps, or a catalog app slug); omit for every app'
    ),
})

export const ConnectAppParams = z.object({
    appId: AppIdSchema,
    inboxId: z
        .string()
        .optional()
        .describe('The inbox (email address or inbox client ID) to connect. Required unless the API key is scoped to one inbox'),
    acceptDisclosure: z
        .boolean()
        .optional()
        .describe(
            "Accept the app's first-use disclosure up front, so the browser sign-in skips that page. Not every app or environment supports this: the call then fails (as a 404 or 400) even though the app ID is valid — retry without acceptDisclosure"
        ),
})

// No pattern keyword on authToken, for the reason AppIdSchema has none: the API validates the
// shape and answers a named 400.
export const AuthorizeInboxParams = z.object({
    inboxId: InboxIdSchema.describe('The inbox (email address or inbox client ID) to sign in as'),
    authToken: z
        .string()
        .min(1)
        .describe('The auth token the AgentID sign-in page shows for the agent: 22 letters, digits, - or _'),
    acceptDisclosure: z
        .boolean()
        .optional()
        .describe(
            "Accept the app's first-use disclosure on the agent's behalf, so the browser finishes without a review page. Omit to leave that review to whoever holds the browser"
        ),
})

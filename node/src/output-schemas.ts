import { AgentMail } from 'agentmail'
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
//
// Every field carries a description so an agent can read a result without guessing; the
// format keyword already says a date is ISO 8601, so date descriptions say what it marks.

const isoDate = (description: string) => z.iso.datetime().describe(description)

const MetadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))

export const PaginationSchema = z.object({
    count: z.number().describe('Number of items returned'),
    limit: z.number().optional().describe('Limit of number of items returned'),
    nextPageToken: z.string().optional().describe('Pass as pageToken to get the next page; absent when there are no more results'),
})

// Stable result for tools whose SDK call returns void (deletes).
export const VoidResultSchema = z.object({
    success: z.literal(true).describe('Always true; a failed call returns an error result instead'),
})

// Internal identifiers (podId, clientId) deliberately excluded — not needed for any
// email task; flagged by OpenAI app review as undisclosed personal identifiers.
export const InboxSchema = z.object({
    inboxId: z.string().describe("Inbox ID, which is the inbox's email address; pass it as inboxId to other tools"),
    email: z.string().describe("The inbox's email address"),
    displayName: z.string().optional().describe('Sender name recipients see on mail from this inbox'),
    metadata: MetadataSchema.optional().describe('Custom metadata attached to the inbox'),
    updatedAt: isoDate('When the inbox was last updated'),
    createdAt: isoDate('When the inbox was created'),
})

export const ListInboxesResponseSchema = PaginationSchema.extend({
    inboxes: z.array(InboxSchema).describe('The inboxes on this page'),
})

const AttachmentMetaSchema = z.object({
    attachmentId: z.string().describe('Attachment ID; pass it to get_attachment with the threadId'),
    filename: z.string().optional().describe('File name as sent'),
    size: z.number().describe('Size in bytes'),
    contentType: z.string().optional().describe('MIME type, e.g. application/pdf'),
    contentDisposition: z.string().optional().describe('inline (shown in the HTML body) or attachment (a download)'),
    contentId: z.string().optional().describe('ID the HTML body uses to show an inline attachment, as cid:<contentId>'),
})

export const AttachmentResponseSchema = AttachmentMetaSchema.extend({
    downloadUrl: z.string().describe('URL to download the attachment'),
    expiresAt: isoDate('Time at which the download URL expires'),
    text: z.string().optional().describe('Extracted text (PDF/DOCX only, toolkit-added; absent when extraction was skipped or failed - see download URL)'),
})

// "Item" variants are what list/search endpoints return (a subset of the full
// get-by-id shape). The full shapes extend the item shapes with the extra fields.

export const ThreadItemSchema = z.object({
    inboxId: z.string().describe('Inbox the thread belongs to'),
    threadId: z.string().describe('Thread ID; pass it to get_thread to read the messages'),
    labels: z.array(z.string()).describe("Labels across the thread's messages, e.g. received, sent, unread"),
    timestamp: isoDate('Time of the latest message'),
    receivedTimestamp: isoDate('Time of the latest received message; absent if none').optional(),
    sentTimestamp: isoDate('Time of the latest sent message; absent if none').optional(),
    senders: z.array(z.string()).describe('From addresses across all messages, deduplicated'),
    recipients: z.array(z.string()).describe('To, Cc and Bcc addresses across all messages, deduplicated'),
    subject: z.string().optional().describe("Subject of the thread's first message"),
    preview: z.string().optional().describe("Start of the latest message's text"),
    attachments: z.array(AttachmentMetaSchema).optional().describe("Attachments across the thread's messages"),
    lastMessageId: z.string().describe('Message ID of the latest message'),
    messageCount: z.number().describe('Number of messages in the thread'),
    size: z.number().describe('Total size of its messages in bytes'),
    updatedAt: isoDate('When the thread was last updated'),
    createdAt: isoDate('When the thread was created'),
})

export const MessageItemSchema = z.object({
    inboxId: z.string().describe('Inbox the message belongs to'),
    threadId: z.string().describe('Thread the message belongs to'),
    messageId: z.string().describe('Message ID: the RFC 5322 Message-ID, angle brackets included'),
    labels: z.array(z.string()).describe('Labels on the message, e.g. received, sent, unread'),
    timestamp: isoDate("When it was sent: a received message's Date header (set by its sender), or the send time"),
    from: z.string().describe('Sender address, possibly with a display name'),
    // Optional to match what the API sends, not the SDK type: a message with no
    // To header (Bcc-only delivery, undisclosed recipients) is stored and
    // returned without `to`. Requiring it here turned every list, search,
    // thread, or get result holding such a message into an "output schema"
    // failure, since MessageSchema and ThreadSchema build on this shape.
    to: z.array(z.string()).optional().describe('Addresses in the To header'),
    cc: z.array(z.string()).optional().describe('Addresses in the Cc header'),
    bcc: z.array(z.string()).optional().describe('Bcc addresses, when known'),
    subject: z.string().optional().describe('Subject line'),
    preview: z.string().optional().describe('First 200 characters of the text body; absent for HTML-only mail'),
    attachments: z.array(AttachmentMetaSchema).optional().describe('Attachments on the message'),
    inReplyTo: z.string().optional().describe('Message ID of the message this one replies to'),
    references: z.array(z.string()).optional().describe('Message IDs of earlier messages in the conversation'),
    calendarEventId: z
        .string()
        .optional()
        .describe(
            "The calendar event this email's invitation, update, cancellation or reply changed, set a few seconds after it arrives (a dated ID for one date of a recurring event); pass it to get_event. Only an invitation this inbox received can be answered with respond_to_invitation, not a reply or cancellation. Absent on other mail"
        ),
    // Raw RFC-822 `headers` deliberately excluded: they carry personal identifiers
    // (Received-chain IPs, Return-Path) a model never needs — flagged by OpenAI app
    // review. Threading works via inReplyTo/references.
    size: z.number().describe('Size of the raw message in bytes'),
    updatedAt: isoDate('When the message was last updated'),
    createdAt: isoDate('When AgentMail stored the message'),
})

const AuthenticationVerdictSchema = z.enum(['pass', 'fail', 'none', 'neutral', 'softfail', 'temperror', 'permerror'])

export const MessageAuthenticationResultsSchema = z.object({
    spf: AuthenticationVerdictSchema.optional().describe('Recorded SPF verdict, when available'),
    dkim: AuthenticationVerdictSchema.optional().describe('Recorded DKIM verdict, when available'),
    dmarc: AuthenticationVerdictSchema.optional().describe('Recorded DMARC verdict, when available'),
    spfDomain: z.string().optional().describe('Envelope domain the SPF verdict applies to'),
    dkimDomain: z.string().optional().describe('Signing domain the DKIM verdict applies to'),
    dmarcDomain: z.string().optional().describe('From domain the DMARC verdict applies to'),
    arcSealer: z.string().optional().describe('Trusted forwarder whose sealed original verdicts are reported, when applicable'),
})

export const MessageSchema = MessageItemSchema.extend({
    authenticationResults: MessageAuthenticationResultsSchema.optional().describe(
        'AgentMail-recorded sender authentication verdicts; absent checks are unknown, and the unauthenticated label remains the acceptance decision'
    ),
    replyTo: z.array(z.string()).optional().describe('Reply-To addresses: where replies should go'),
    text: z.string().optional().describe('Plain-text body, quoted history included'),
    html: z.string().optional().describe('HTML body, quoted history included'),
    extractedText: z.string().optional().describe('Just the new content of the text body, with quoted history and trailing boilerplate removed'),
    extractedHtml: z.string().optional().describe('Just the new content of the HTML body, with quoted history and trailing boilerplate removed'),
})

export const ThreadSchema = ThreadItemSchema.extend({
    messages: z.array(MessageSchema).describe('Messages in thread, ordered by timestamp ascending'),
})

export const ListThreadsResponseSchema = PaginationSchema.extend({
    threads: z.array(ThreadItemSchema).describe('The threads on this page'),
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
    threads: z
        .array(
            ThreadItemSchema.extend({
                highlights: HighlightsSchema.optional().describe('Matched fragments per field, present when the query matched an indexed field'),
            })
        )
        .describe('The matching threads on this page, best match first'),
})

export const ListMessagesResponseSchema = PaginationSchema.extend({
    messages: z.array(MessageItemSchema).describe('The messages on this page, without bodies'),
})

export const SearchMessagesResponseSchema = PaginationSchema.extend({
    messages: z
        .array(
            MessageItemSchema.extend({
                highlights: HighlightsSchema.optional().describe('Matched fragments per field, present when the query matched an indexed field'),
            })
        )
        .describe('The matching messages on this page, best match first, without bodies'),
})

export const UpdateThreadResponseSchema = z.object({
    threadId: z.string().describe('The updated thread'),
    labels: z.array(z.string()).describe("The thread's labels after the update"),
})

export const UpdateMessageResponseSchema = z.object({
    messageId: z.string().describe('The updated message'),
    labels: z.array(z.string()).describe("The message's labels after the update"),
})

export const SendMessageResponseSchema = z.object({
    messageId: z.string().describe('Message ID of the sent message'),
    threadId: z.string().describe('Thread the sent message belongs to'),
})

const DraftSendStatusSchema = z.enum(['scheduled', 'sending', 'failed'])

export const DraftItemSchema = z.object({
    inboxId: z.string().describe('Inbox the draft belongs to'),
    draftId: z.string().describe('Draft ID; pass it to get_draft, update_draft, send_draft, or delete_draft'),
    labels: z.array(z.string()).describe('Labels on the draft, e.g. draft, scheduled, or your own'),
    to: z.array(z.string()).optional().describe('Recipient addresses'),
    cc: z.array(z.string()).optional().describe('Copied addresses'),
    bcc: z.array(z.string()).optional().describe('Blind-copied addresses'),
    subject: z.string().optional().describe('Subject line'),
    preview: z.string().optional().describe("Start of the draft's text"),
    attachments: z.array(AttachmentMetaSchema).optional().describe('Attachments on the draft'),
    inReplyTo: z.string().optional().describe('Message ID the draft replies to'),
    sendStatus: DraftSendStatusSchema.optional().describe('Progress of a scheduled send: scheduled, sending, or failed'),
    sendAt: isoDate('When the draft is scheduled to send').optional(),
    updatedAt: isoDate('When the draft was last updated'),
})

export const DraftSchema = DraftItemSchema.extend({
    replyTo: z.array(z.string()).optional().describe('Reply-To addresses: where replies should go'),
    text: z.string().optional().describe('Plain-text body'),
    html: z.string().optional().describe('HTML body'),
    references: z.array(z.string()).optional().describe('Message IDs of earlier messages in the conversation'),
    createdAt: isoDate('When the draft was created'),
})

export const ListDraftsResponseSchema = PaginationSchema.extend({
    drafts: z.array(DraftItemSchema).describe('The drafts on this page'),
})

// Agent Drive. The file's sha256 and the inbox's duplicate email stay out: nothing an agent does with a file
// needs them.
export const FileItemSchema = z.object({
    fileId: z.string().describe('File ID; pass it as fileId to get_file or delete_file'),
    inboxId: z.string().describe('Inbox whose drive holds the file'),
    path: z.string().describe("Where the file lives in the inbox's drive"),
    name: z.string().describe("The path's last segment; a download saves under this name"),
    size: z.number().describe('Size in bytes'),
    contentType: z.string().describe('MIME type'),
    status: z.enum(['pending', 'ready']).describe('ready once uploaded; only a ready file can be downloaded'),
    createdAt: isoDate('When the file was created'),
    updatedAt: isoDate('When the file last changed'),
    expiresAt: isoDate('When the file deletes itself; absent if it never expires').optional(),
})

export const FileSchema = FileItemSchema.extend({
    downloadUrl: z
        .string()
        .optional()
        .describe(
            'Link that downloads the file, no API key needed, so share it only with whoever should have the file; absent unless ready and the credential may read files'
        ),
    downloadExpiresAt: isoDate('When downloadUrl stops working, at most an hour from now; get the file again for a fresh one').optional(),
})

export const ListFilesResponseSchema = PaginationSchema.extend({
    files: z.array(FileItemSchema).describe('The files on this page, in path order; get_file returns a download link'),
})

// Calendar. The iCalendar bookkeeping (uid, sequence, resourceRevision), the duration fields and
// operationId stay out: nothing an agent does with an event needs them, and etag is the version
// it sends back.
export const CalendarSchema = z.object({
    inboxId: z.string().describe('Inbox the calendar belongs to; every inbox has one'),
    timezone: z.string().describe('Default time zone for events created without one'),
    eventCount: z.number().describe('Number of one-off and recurring events; a recurring event counts once'),
    createdAt: isoDate('When the calendar was created, with its inbox'),
    updatedAt: isoDate('When the calendar was last updated'),
    etag: z.string().describe("The calendar's current version; pass it as ifMatch to update_calendar to make the update conditional"),
})

const AttendeeSchema = z.object({
    email: z.string().describe("Attendee's email address"),
    name: z.string().optional().describe('Name shown for the attendee'),
    status: z
        .enum(AgentMail.AttendeeStatus)
        .optional()
        .describe('Their response: needs_action until they answer, then accepted, declined, or tentative'),
    role: z.enum(AgentMail.AttendeeRole).optional().describe('Whether their presence is required or optional'),
    comment: z.string().optional().describe('Note the attendee sent with their response'),
    respondedAt: isoDate('When they last responded').optional(),
})

export const CalendarEventSchema = z.object({
    eventId: z.string().describe('Event ID; pass it to get_event, update_event, delete_event, or respond_to_invitation'),
    kind: z
        .enum(AgentMail.CalendarEventKind)
        .describe('single: a one-off event; series: a recurring event; instance: one date of a recurring event, with a dated ID'),
    seriesId: z.string().optional().describe('For an instance, the UUID of the recurring event it belongs to'),
    originalStart: z.string().optional().describe('For an instance, its start as the rule generated it, before any edit'),
    isException: z.boolean().optional().describe('For an instance, true when this date was edited or moved'),
    title: z.string().describe('Title of the event'),
    description: z.string().optional().describe('Details of the event; get_agenda leaves it out, so get the event for it'),
    location: z.string().optional().describe('Place or meeting link'),
    metadata: z.unknown().optional().describe('Your own data stored on the event; get_agenda leaves it out'),
    status: z
        .enum(AgentMail.CalendarEventStatus)
        .describe('confirmed, tentative, or cancelled (still readable, but it no longer happens)'),
    allDay: z.boolean().describe('Whether it is an all-day event'),
    start: z.string().describe('Local start in timezone; for an all-day event, the first day'),
    end: z.string().describe('Local end in timezone; for an all-day event, the last day (inclusive)'),
    timezone: z.string().describe('Time zone of start and end'),
    startAt: isoDate('Start as a UTC instant'),
    endAt: isoDate('End as a UTC instant'),
    recurrence: z
        .object({
            rule: z.string().describe('RFC 5545 RRULE, stored in a normalized form'),
            exdates: z.array(z.string()).optional().describe('Original starts of skipped dates'),
            rdates: z
                .array(
                    z.union([
                        z.string(),
                        z.object({
                            start: z.string().describe('Local start of the extra date'),
                            end: z.string().optional().describe('Local end of the extra date, when given as an end'),
                            duration: z.string().optional().describe('ISO 8601 length of the extra date, when given as a duration'),
                        }),
                    ])
                )
                .optional()
                .describe('Extra dates the rule does not produce, as wall times or periods'),
            truncateBefore: z
                .string()
                .optional()
                .describe('Set when the event was ended early with a mode future delete: no date starting at or after this local time occurs'),
        })
        .optional()
        .describe('For a recurring event, how it repeats'),
    attendees: z.array(AttendeeSchema).optional().describe('Attendees and their responses; get_agenda leaves them out, so get the event for them'),
    attendeeCount: z.number().describe('Number of attendees'),
    responseStatus: z
        .enum(AgentMail.AttendeeStatus)
        .optional()
        .describe("This inbox's own answer, on invitations it received; needs_action means the invitation awaits a reply"),
    source: z
        .enum(AgentMail.CalendarEventSource)
        .describe('api: created through the API, with this inbox as organizer; email: imported from an invitation the inbox received'),
    organizerEmail: z.string().optional().describe("Organizer's email address; this inbox for an api event"),
    originMessageId: z.string().optional().describe('For an email event, the message whose invitation last created or changed it'),
    createdAt: isoDate('When the event was created'),
    updatedAt: isoDate('When the event was last updated'),
    etag: z
        .string()
        .optional()
        .describe("The event's current version; pass it as ifMatch to make a later change conditional. Absent from get_agenda items"),
})

export const ListCalendarEventsResponseSchema = PaginationSchema.extend({
    events: z
        .array(CalendarEventSchema)
        .describe('Events and dates of recurring events in the window, by start time, cancelled dates left out'),
})

export const CalendarEventMutationResponseSchema = z.object({
    event: CalendarEventSchema.describe('The event as it now stands'),
})

export const DeleteCalendarEventResponseSchema = VoidResultSchema.extend({
    deletionId: z
        .string()
        .optional()
        .describe('Present when a whole event was deleted: it disappears at once and is removed in the background'),
    event: CalendarEventSchema.optional().describe('Present when dates of a recurring event were cancelled: the cancelled date'),
})

const ScopeTypeSchema = z.enum(['organization', 'pod', 'inbox'])

export const IdentitySchema = z.object({
    scopeType: ScopeTypeSchema.describe('What the credential can reach: a whole organization, one pod, or one inbox'),
    scopeId: z.string().describe('ID of the organization, pod, or inbox the credential is scoped to'),
    organizationId: z.string().describe('Organization the credential belongs to'),
    podId: z.string().optional().describe('Pod the credential belongs to, if any'),
    inboxId: z.string().optional().describe('Inbox the credential is scoped to, if any'),
    apiKeyId: z.string().optional().describe('ID of the API key in use, when authenticated with one'),
})

export const AgentAttachHumanResponseSchema = z.object({
    humanEmail: z.string().describe('Email address of the attached human'),
    instructions: z.string().describe('Next steps for the agent, in plain text'),
})

export const AgentVerifyResponseSchema = z.object({
    verified: z.boolean().describe('Whether the organization was verified'),
})

export const LabsSchema = z.object({
    enabled: z.boolean().describe('Whether the organization is in AgentMail Labs; false both when it never joined and when an organization admin left on purpose'),
    enabledAt: z.iso.datetime().nullable().describe('When the organization joined Labs; null when it is not in Labs'),
    available: z.boolean().describe('Whether Labs is offered in this deployment (US production only, for now)'),
})

// One shape for both projections GET /apps/{id} serves: a curated catalog entry (name +
// updatedAt + display fields) and the bare identity resolved for an app the catalog does not
// list — one the caller holds an account at, or any registered app (id, maybe a name,
// nothing else). Catalog membership shows as updatedAt
// being present — the API publishes no flag for it. Display fields are app-authored.
export const AppSchema = z.object({
    appId: z.string().describe('Permanent ID of the app; pass it to get_app or connect_app'),
    slug: z
        .string()
        .optional()
        .describe(
            'Short name accepted in place of appId by get_app, list_accounts and connect_app. Present on catalog entries; store appId, the permanent ID'
        ),
    name: z.string().optional().describe('Display name of app'),
    updatedAt: isoDate(
        'Time at which the listing was last updated. Present only for curated catalog entries; absent means the app resolved as a bare identity'
    ).optional(),
    description: z.string().optional().describe("The app's own description of what it offers"),
    // Plain strings, not the input enum: a category the API adds before the next SDK release must not
    // fail the output check.
    categories: z
        .array(z.string())
        .optional()
        .describe('Kinds of app, up to 3 (such as search, scraping or payments). Omitted when the app sets none'),
    logoUrl: z.string().optional().describe("URL of the app's logo"),
    termsUrl: z.string().optional().describe("URL of the app's terms of service"),
    privacyUrl: z.string().optional().describe("URL of the app's privacy policy"),
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
    apps: z.array(CatalogAppSchema).describe('The apps on this page, most popular first'),
})

// Search's own envelope, NOT PaginationSchema: the route is unpaginated, so advertising an
// optional nextPageToken would invite a model to read its absence as "the list is complete" —
// wrong on a route that truncates silently. count and limit are always sent.
export const SearchAppsResponseSchema = z.object({
    count: z.number().describe('Number of items returned'),
    limit: z.number().describe('Limit of number of items returned'),
    apps: z.array(CatalogAppSchema).describe('Catalog apps whose names match the search'),
})

// podId and organizationId are on the wire but deliberately excluded — the same internal-identifier
// rule as InboxSchema above. accountId stays: it is the resource's own addressable id, the same
// class as inboxId. The legacy providerId / providerName aliases are on the wire too and are
// stripped: the tools speak only the app vocabulary.
export const AccountSchema = z.object({
    accountId: z.string().describe('Permanent ID of this account at the app'),
    appId: z.string().describe('App the account is at'),
    appName: z.string().optional().describe('Display name of app'),
    inboxId: z.string().describe('The inbox (email address) holding the account'),
    firstSignedInAt: isoDate('Time of first sign-in at app'),
    lastSignedInAt: isoDate('Time of most recent sign-in at app'),
    signInCount: z.number().describe('Number of sign-ins at app'),
})

// Shared by the all-apps and per-app account lists: the per-app route embeds the app, the
// all-apps one has no single app to embed.
export const ListAccountsResponseSchema = PaginationSchema.extend({
    app: AppSchema.optional().describe('The app, when the list was narrowed to one and it resolves for this caller'),
    accounts: z.array(AccountSchema).describe('The accounts on this page'),
})

export const ConnectAppResponseSchema = z.object({
    apiKeyId: z.string().describe('ID of the pending sign-in key; it turns active once the sign-in completes'),
    magicUrl: z.string().describe('Single-use sign-in URL to open in the client that will hold the sign-in'),
    expiresAt: isoDate('Time at which the magic URL stops working'),
})

export const AuthorizeInboxResponseSchema = z.object({
    apiKeyId: z.string().describe('ID of the pending sign-in key; it turns active once the browser finishes the sign-in'),
    instructions: z.string().describe("The agent's next step. Nothing further is required from the agent"),
})

// organizationId and podId are on the wire but deliberately excluded — the InboxSchema
// internal-identifier rule. readOnly stays: it tells the model an entry is an AgentMail
// suppression it cannot delete, before it tries.
export const ListEntrySchema = z.object({
    entry: z.string().describe('Email address or domain'),
    direction: z.enum(['send', 'receive', 'reply']).describe('Which traffic the list governs: send, receive, or reply'),
    listType: z.enum(['allow', 'block']).describe('Whether this is an allow or a block list'),
    entryType: z.enum(['email', 'domain']).describe('Whether the entry is an email address or a domain'),
    reason: z.string().optional().describe('Why the entry was added'),
    inboxId: z.string().optional().describe('The inbox the entry is scoped to, when inbox-scoped'),
    readOnly: z
        .boolean()
        .optional()
        .describe('True for suppressions AgentMail added itself (bounce, complaint, unsubscribe); these cannot be deleted'),
    createdAt: isoDate('When the entry was added'),
})

export const ListListEntriesResponseSchema = PaginationSchema.extend({
    entries: z.array(ListEntrySchema).describe('Ordered by entry ascending'),
})

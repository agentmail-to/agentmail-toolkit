import { type AgentMailClient } from 'agentmail'

// Representative SDK-shaped fixtures (camelCase, real Date objects for date fields -
// exactly what the installed agentmail SDK's deserializers hand back at runtime).
// Date fields deliberately stay `Date` so tests prove `normalize` converts them
// before output-schema validation, mirroring the real MCP callback path.

const NOW = new Date('2026-07-10T12:00:00.000Z')

export const inbox = () => ({
    podId: 'pod_1',
    inboxId: 'inbox_1',
    email: 'agent@agentmail.to',
    displayName: 'Agent',
    updatedAt: NOW,
    createdAt: NOW,
})

export const threadItem = () => ({
    inboxId: 'inbox_1',
    threadId: 'thread_1',
    labels: ['inbox'],
    timestamp: NOW,
    senders: ['sender@example.com'],
    recipients: ['agent@agentmail.to'],
    subject: 'Hello',
    preview: 'Hello there',
    lastMessageId: 'msg_1',
    messageCount: 1,
    size: 123,
    updatedAt: NOW,
    createdAt: NOW,
    // SDK-passthrough internals the output schemas must strip (see messageItem).
    organization_id: 'org_internal_1',
    pod_id: 'pod_internal_1',
})

export const messageItem = () => ({
    inboxId: 'inbox_1',
    threadId: 'thread_1',
    messageId: 'msg_1',
    labels: ['inbox'],
    timestamp: NOW,
    from: 'sender@example.com',
    to: ['agent@agentmail.to'],
    subject: 'Hello',
    preview: 'Hello there',
    size: 123,
    updatedAt: NOW,
    createdAt: NOW,
    // Fields the real pipeline carries but the output schemas must strip: raw RFC-822
    // headers (personal identifiers) and snake_case internals the SDK passes through
    // unrecognized (unrecognizedObjectKeys:"passthrough"). Present in the fixture so
    // every test that round-trips a message proves they never reach structuredContent.
    headers: { received: 'from mail.example.com ([203.0.113.7])' },
    organization_id: 'org_internal_1',
    pod_id: 'pod_internal_1',
})

export const message = () => ({ ...messageItem(), text: 'Hello there' })

export const thread = () => ({ ...threadItem(), messages: [message()] })

export const attachmentResponse = () => ({
    attachmentId: 'att_1',
    filename: 'doc.pdf',
    size: 4,
    contentType: 'application/pdf',
    downloadUrl: 'https://attachments.agentmail.to/att_1',
    expiresAt: NOW,
})

export const draftItem = () => ({
    inboxId: 'inbox_1',
    draftId: 'draft_1',
    labels: ['drafts'],
    to: ['someone@example.com'],
    subject: 'Draft',
    updatedAt: NOW,
    // Nested attachment carrying an undeclared debug key + item-level SDK internals -
    // both must be stripped by the output schemas.
    attachments: [{ attachmentId: 'att_d1', size: 10, debug_trace: 'x' }],
    organization_id: 'org_internal_1',
})

export const draft = () => ({ ...draftItem(), text: 'Draft body', createdAt: NOW })

export const sendResult = () => ({ messageId: 'msg_1', threadId: 'thread_1' })

export const identity = () => ({ scopeType: 'organization' as const, scopeId: 'org_1', organizationId: 'org_1' })


export const agentVerifyResult = () => ({ verified: true })

export const provider = () => ({
    providerId: '11111111-1111-4111-8111-111111111111',
    name: 'Example RP',
    updatedAt: NOW,
    description: 'An example provider',
    logoUrl: 'https://cdn.example.com/logo.png',
    termsUrl: 'https://example.com/terms',
    privacyUrl: 'https://example.com/privacy',
    // SDK-passthrough internals the output schemas must strip.
    client_id: 'client-internal-1',
    score: 42,
})

export const account = () => ({
    accountId: '44444444-4444-4444-8444-444444444444',
    providerId: '11111111-1111-4111-8111-111111111111',
    providerName: 'Example RP',
    inboxId: 'agent@agentmail.to',
    firstSignedInAt: NOW,
    lastSignedInAt: NOW,
    signInCount: 3,
    // Real (camelCase) SDK fields the output schemas must strip — tenancy
    // identifiers stay off tool results, the same rule as InboxSchema's podId.
    podId: 'pod_internal_1',
    organizationId: 'org_internal_1',
})

export const listEntry = () => ({
    entry: 'blocked@example.com',
    direction: 'send' as const,
    listType: 'block' as const,
    entryType: 'email' as const,
    reason: 'asked by the human',
    inboxId: 'inbox_1',
    createdAt: NOW,
    // Real (camelCase) SDK fields the output schema must strip — the InboxSchema podId rule —
    // plus a snake_case internal the SDK passes through unrecognized, like messageItem's.
    organizationId: 'org_internal_1',
    podId: 'pod_internal_1',
    scope_key: 'pod_internal_1#inbox_1',
})

export const connectAccepted = () => ({
    apiKeyId: '33333333-3333-4333-8333-333333333333',
    magicUrl: 'https://agentid.example/connect#token',
    expiresAt: NOW,
})

const success = () => ({ success: true as const })

// One representative success fixture per tool, keyed by canonical tool name.
export const fixtureByTool: Record<string, () => unknown> = {
    list_inboxes: () => ({ count: 1, inboxes: [inbox()] }),
    get_inbox: inbox,
    create_inbox: inbox,
    update_inbox: inbox,
    delete_inbox: success,
    list_threads: () => ({ count: 1, nextPageToken: 'tok', threads: [threadItem()] }),
    search_threads: () => ({
        count: 1,
        threads: [{ ...threadItem(), highlights: { subject: ['<em>Hello</em>'] } }],
    }),
    get_thread: thread,
    update_thread: () => ({ threadId: 'thread_1', labels: ['inbox'] }),
    delete_thread: success,
    get_attachment: attachmentResponse,
    list_messages: () => ({ count: 1, messages: [messageItem()] }),
    search_messages: () => ({
        count: 1,
        messages: [{ ...messageItem(), highlights: { text: ['<em>Hello</em> there'] } }],
    }),
    send_message: sendResult,
    reply_to_message: sendResult,
    forward_message: sendResult,
    update_message: () => ({ messageId: 'msg_1', labels: ['inbox'] }),
    create_draft: draft,
    list_drafts: () => ({ count: 1, drafts: [draftItem()] }),
    get_draft: draft,
    update_draft: draft,
    send_draft: sendResult,
    delete_draft: success,
    auth_me: identity,
    agent_verify: agentVerifyResult,
    list_providers: () => ({ count: 1, limit: 10, providers: [provider()] }),
    search_providers: () => ({ count: 1, limit: 10, providers: [provider()] }),
    get_provider: provider,
    list_accounts: () => ({ count: 1, limit: 10, accounts: [account()] }),
    connect_provider: connectAccepted,
    get_message: message,
    search_inboxes: () => ({ count: 1, inboxes: [inbox()] }),
    list_list_entries: () => ({ count: 1, limit: 10, entries: [listEntry()] }),
    get_list_entry: listEntry,
    create_list_entry: listEntry,
    delete_list_entry: success,
}

// Minimal valid arguments per tool (must satisfy each tool's paramsSchema).
export const argsByTool: Record<string, Record<string, unknown>> = {
    list_inboxes: {},
    get_inbox: { inboxId: 'inbox_1' },
    create_inbox: {},
    update_inbox: { inboxId: 'inbox_1' },
    delete_inbox: { inboxId: 'inbox_1' },
    list_threads: { inboxId: 'inbox_1' },
    search_threads: { inboxId: 'inbox_1', q: 'hello' },
    get_thread: { inboxId: 'inbox_1', threadId: 'thread_1' },
    update_thread: { inboxId: 'inbox_1', threadId: 'thread_1', addLabels: ['todo'] },
    delete_thread: { inboxId: 'inbox_1', threadId: 'thread_1' },
    get_attachment: { inboxId: 'inbox_1', threadId: 'thread_1', attachmentId: 'att_1' },
    list_messages: { inboxId: 'inbox_1' },
    search_messages: { inboxId: 'inbox_1', q: 'hello' },
    send_message: { inboxId: 'inbox_1', to: ['someone@example.com'], subject: 'Hi', text: 'Hi' },
    reply_to_message: { inboxId: 'inbox_1', messageId: 'msg_1', text: 'Hi' },
    forward_message: { inboxId: 'inbox_1', messageId: 'msg_1', to: ['someone@example.com'] },
    update_message: { inboxId: 'inbox_1', messageId: 'msg_1', addLabels: ['todo'] },
    create_draft: { inboxId: 'inbox_1', to: ['someone@example.com'], subject: 'Hi', text: 'Hi' },
    list_drafts: { inboxId: 'inbox_1' },
    get_draft: { inboxId: 'inbox_1', draftId: 'draft_1' },
    update_draft: { inboxId: 'inbox_1', draftId: 'draft_1', subject: 'Hi' },
    send_draft: { inboxId: 'inbox_1', draftId: 'draft_1' },
    delete_draft: { inboxId: 'inbox_1', draftId: 'draft_1' },
    auth_me: {},
    agent_verify: { otpCode: '123456' },
    list_providers: {},
    search_providers: { q: 'example' },
    get_provider: { providerId: '11111111-1111-4111-8111-111111111111' },
    list_accounts: {},
    connect_provider: { providerId: '11111111-1111-4111-8111-111111111111', inboxId: 'agent@agentmail.to' },
    get_message: { inboxId: 'inbox_1', messageId: 'msg_1' },
    search_inboxes: { q: 'agent' },
    list_list_entries: { inboxId: 'inbox_1', direction: 'send', listType: 'block' },
    get_list_entry: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'blocked@example.com' },
    create_list_entry: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'blocked@example.com' },
    delete_list_entry: { inboxId: 'inbox_1', direction: 'send', listType: 'block', entry: 'blocked@example.com' },
}

// A fake AgentMailClient whose every method resolves with the matching fixture.
// Void SDK methods (deletes) resolve undefined, like the real SDK.
export function mockClient(overrides?: Record<string, unknown>): AgentMailClient {
    const f = fixtureByTool
    const client = {
        inboxes: {
            list: async () => f.list_inboxes(),
            search: async () => f.search_inboxes(),
            get: async () => f.get_inbox(),
            create: async () => f.create_inbox(),
            update: async () => f.update_inbox(),
            delete: async () => undefined,
            threads: {
                list: async () => f.list_threads(),
                search: async () => f.search_threads(),
                get: async () => f.get_thread(),
                update: async () => f.update_thread(),
                delete: async () => undefined,
                getAttachment: async () => f.get_attachment(),
            },
            messages: {
                get: async () => f.get_message(),
                list: async () => f.list_messages(),
                search: async () => f.search_messages(),
                send: async () => f.send_message(),
                reply: async () => f.reply_to_message(),
                forward: async () => f.forward_message(),
                update: async () => f.update_message(),
            },
            lists: {
                list: async () => f.list_list_entries(),
                get: async () => f.get_list_entry(),
                create: async () => f.create_list_entry(),
                delete: async () => undefined,
            },
            drafts: {
                create: async () => f.create_draft(),
                list: async () => f.list_drafts(),
                get: async () => f.get_draft(),
                update: async () => f.update_draft(),
                send: async () => f.send_draft(),
                delete: async () => undefined,
            },
        },
        auth: {
            me: async () => f.auth_me(),
        },
        agent: {
            verify: async () => f.agent_verify(),
        },
        providers: {
            list: async () => f.list_providers(),
            search: async () => f.search_providers(),
            get: async () => f.get_provider(),
            listAccounts: async () => ({ provider: provider(), count: 1, accounts: [account()] }),
            connect: async () => f.connect_provider(),
        },
        accounts: {
            list: async () => f.list_accounts(),
        },
        ...overrides,
    }
    return client as unknown as AgentMailClient
}

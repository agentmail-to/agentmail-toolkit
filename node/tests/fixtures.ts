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
})

export const draft = () => ({ ...draftItem(), text: 'Draft body', createdAt: NOW })

export const sendResult = () => ({ messageId: 'msg_1', threadId: 'thread_1' })

export const identity = () => ({ scopeType: 'organization' as const, scopeId: 'org_1', organizationId: 'org_1' })

const success = () => ({ success: true as const })

// One representative success fixture per tool, keyed by canonical tool name.
export const fixtureByTool: Record<string, () => unknown> = {
    list_inboxes: () => ({ count: 1, inboxes: [inbox()] }),
    get_inbox: inbox,
    create_inbox: inbox,
    update_inbox: inbox,
    delete_inbox: success,
    list_threads: () => ({ count: 1, nextPageToken: 'tok', threads: [threadItem()] }),
    search_threads: () => ({ count: 1, threads: [threadItem()] }),
    get_thread: thread,
    update_thread: () => ({ threadId: 'thread_1', labels: ['inbox'] }),
    delete_thread: success,
    get_attachment: attachmentResponse,
    list_messages: () => ({ count: 1, messages: [messageItem()] }),
    search_messages: () => ({ count: 1, messages: [messageItem()] }),
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
}

// A fake AgentMailClient whose every method resolves with the matching fixture.
// Void SDK methods (deletes) resolve undefined, like the real SDK.
export function mockClient(overrides?: Record<string, unknown>): AgentMailClient {
    const f = fixtureByTool
    const client = {
        inboxes: {
            list: async () => f.list_inboxes(),
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
                list: async () => f.list_messages(),
                search: async () => f.search_messages(),
                send: async () => f.send_message(),
                reply: async () => f.reply_to_message(),
                forward: async () => f.forward_message(),
                update: async () => f.update_message(),
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
        ...overrides,
    }
    return client as unknown as AgentMailClient
}

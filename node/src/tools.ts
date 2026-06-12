import { z } from 'zod'
import { AgentMailClient } from 'agentmail'
import { type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

import {
    ListItemsParams,
    ListThreadsParams,
    SearchInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    UpdateInboxParams,
    GetThreadParams,
    UpdateThreadParams,
    GetAttachmentParams,
    ListMessagesParams,
    SendMessageParams,
    ReplyToMessageParams,
    UpdateMessageParams,
    ForwardMessageParams,
    CreateDraftParams,
    ListDraftsParams,
    GetDraftParams,
    UpdateDraftParams,
    SendDraftParams,
    DeleteDraftParams,
    AuthMeParams,
} from './schemas.js'
import {
    type Args,
    listInboxes,
    getInbox,
    createInbox,
    updateInbox,
    deleteInbox,
    listThreads,
    searchThreads,
    getThread,
    updateThread,
    deleteThread,
    getAttachment,
    listMessages,
    searchMessages,
    sendMessage,
    replyToMessage,
    updateMessage,
    forwardMessage,
    createDraft,
    listDrafts,
    getDraft,
    updateDraft,
    sendDraft,
    deleteDraft,
    authMe,
} from './functions.js'
export interface Tool {
    name: string
    description: string
    paramsSchema: z.ZodObject<any>
    func: (client: AgentMailClient, args: Args) => Promise<any>
    annotations?: ToolAnnotations
}

export const tools: Tool[] = [
    {
        name: 'list_inboxes',
        description: 'List email inboxes, paginated.',
        paramsSchema: ListItemsParams,
        func: listInboxes,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'get_inbox',
        description: 'Get an inbox by ID.',
        paramsSchema: GetInboxParams,
        func: getInbox,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'create_inbox',
        description: 'Create a new email inbox. Optionally specify username, domain, display name, and metadata.',
        paramsSchema: CreateInboxParams,
        func: createInbox,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
        },
    },
    {
        name: 'update_inbox',
        description: "Update an inbox's display name or metadata. Metadata keys are merged; set a key to null to remove it, or set metadata to null to clear all.",
        paramsSchema: UpdateInboxParams,
        func: updateInbox,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'delete_inbox',
        description: 'Delete an inbox by ID.',
        paramsSchema: GetInboxParams,
        func: deleteInbox,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'list_threads',
        description: 'List email threads in an inbox. Filter by labels, sender, recipient, subject, or before/after datetime, paginated.',
        paramsSchema: ListThreadsParams,
        func: listThreads,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'search_threads',
        description: 'Search threads in an inbox with a full-text query, ranked by relevance. Matches senders, recipients, subject, and message body. Spam and trash are excluded.',
        paramsSchema: SearchInboxItemsParams,
        func: searchThreads,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'get_thread',
        description: 'Get a thread by ID, including its messages.',
        paramsSchema: GetThreadParams,
        func: getThread,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'get_attachment',
        description: 'Get an attachment from a thread. Returns metadata and a download URL, plus extracted text for PDF and DOCX files.',
        paramsSchema: GetAttachmentParams,
        func: getAttachment,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'update_thread',
        description: "Update a thread's labels (add or remove). System labels cannot be modified.",
        paramsSchema: UpdateThreadParams,
        func: updateThread,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'delete_thread',
        description: 'Delete a thread from an inbox.',
        paramsSchema: GetThreadParams,
        func: deleteThread,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: false,
        },
    },
    {
        name: 'list_messages',
        description: 'List messages in an inbox. Filter by labels, sender, recipient, subject, or before/after datetime, paginated.',
        paramsSchema: ListMessagesParams,
        func: listMessages,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'search_messages',
        description: 'Search messages in an inbox with a full-text query, ranked by relevance. Matches sender, recipients, subject, and message body. Spam and trash are excluded.',
        paramsSchema: SearchInboxItemsParams,
        func: searchMessages,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'send_message',
        description: 'Send an email from an inbox to one or more recipients.',
        paramsSchema: SendMessageParams,
        func: sendMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
    {
        name: 'reply_to_message',
        description: 'Reply to a message in its thread. Set replyAll to include all original recipients.',
        paramsSchema: ReplyToMessageParams,
        func: replyToMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
    {
        name: 'forward_message',
        description: 'Forward a message to new recipients.',
        paramsSchema: ForwardMessageParams,
        func: forwardMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
    {
        name: 'update_message',
        description: "Update a message's labels (add or remove).",
        paramsSchema: UpdateMessageParams,
        func: updateMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'create_draft',
        description: 'Create a draft email. Use sendAt (ISO 8601 datetime) to schedule it for later sending.',
        paramsSchema: CreateDraftParams,
        func: createDraft,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: false,
        },
    },
    {
        name: 'list_drafts',
        description: 'List drafts in inbox. Filter by labels (e.g. "scheduled") to find scheduled drafts.',
        paramsSchema: ListDraftsParams,
        func: listDrafts,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'get_draft',
        description: 'Get a draft by ID, including its content, status, and scheduled send time.',
        paramsSchema: GetDraftParams,
        func: getDraft,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'update_draft',
        description: 'Update a draft. Use sendAt to reschedule a scheduled draft.',
        paramsSchema: UpdateDraftParams,
        func: updateDraft,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'send_draft',
        description: 'Send a draft immediately. The draft is converted to a sent message and deleted.',
        paramsSchema: SendDraftParams,
        func: sendDraft,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
    {
        name: 'delete_draft',
        description: 'Delete a draft. Also used to cancel a scheduled send.',
        paramsSchema: DeleteDraftParams,
        func: deleteDraft,
        annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'auth_me',
        description: 'Get the identity and scope of the authenticated credential, including organization, pod, and inbox IDs.',
        paramsSchema: AuthMeParams,
        func: authMe,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
]

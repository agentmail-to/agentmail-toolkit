import { z } from 'zod'
import { AgentMailClient } from 'agentmail'
import { type ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

import {
    ListItemsParams,
    ListInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    GetThreadParams,
    GetAttachmentParams,
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
} from './schemas.js'
import {
    type Args,
    listInboxes,
    getInbox,
    createInbox,
    deleteInbox,
    listThreads,
    getThread,
    getAttachment,
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
        description: 'List inboxes',
        paramsSchema: ListItemsParams,
        func: listInboxes,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'get_inbox',
        description: 'Get inbox',
        paramsSchema: GetInboxParams,
        func: getInbox,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'create_inbox',
        description: 'Create inbox',
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
        name: 'delete_inbox',
        description: 'Delete inbox',
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
        description: 'List threads in inbox',
        paramsSchema: ListInboxItemsParams,
        func: listThreads,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'get_thread',
        description: 'Get thread',
        paramsSchema: GetThreadParams,
        func: getThread,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'get_attachment',
        description: 'Get attachment',
        paramsSchema: GetAttachmentParams,
        func: getAttachment,
        annotations: {
            readOnlyHint: true,
            openWorldHint: true,
        },
    },
    {
        name: 'send_message',
        description: 'Send message',
        paramsSchema: SendMessageParams,
        func: sendMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
    {
        name: 'reply_to_message',
        description: 'Reply to message',
        paramsSchema: ReplyToMessageParams,
        func: replyToMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
    {
        name: 'forward_message',
        description: 'Forward message',
        paramsSchema: ForwardMessageParams,
        func: forwardMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true,
        },
    },
    {
        name: 'update_message',
        description: 'Update message',
        paramsSchema: UpdateMessageParams,
        func: updateMessage,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'create_draft',
        description: 'Create a draft email. Use send_at (ISO 8601 datetime) to schedule it for later sending.',
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
        description: 'Get draft',
        paramsSchema: GetDraftParams,
        func: getDraft,
        annotations: {
            readOnlyHint: true,
            openWorldHint: false,
        },
    },
    {
        name: 'update_draft',
        description: 'Update a draft. Use send_at to reschedule a scheduled draft.',
        paramsSchema: UpdateDraftParams,
        func: updateDraft,
        annotations: {
            readOnlyHint: false,
            destructiveHint: false,
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
            destructiveHint: false,
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
]

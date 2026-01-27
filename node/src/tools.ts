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
]

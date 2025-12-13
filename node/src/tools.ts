import { z } from 'zod'
import { AgentMailClient } from 'agentmail'

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
} from './functions.js'
export interface Tool {
    name: string
    description: string
    paramsSchema: z.ZodObject<any>
    func: (client: AgentMailClient, args: Args) => Promise<any>
}

export const tools: Tool[] = [
    {
        name: 'list_inboxes',
        description: 'List inboxes',
        paramsSchema: ListItemsParams,
        func: listInboxes,
    },
    {
        name: 'get_inbox',
        description: 'Get inbox',
        paramsSchema: GetInboxParams,
        func: getInbox,
    },
    {
        name: 'create_inbox',
        description: 'Create inbox',
        paramsSchema: CreateInboxParams,
        func: createInbox,
    },
    {
        name: 'delete_inbox',
        description: 'Delete inbox',
        paramsSchema: GetInboxParams,
        func: deleteInbox,
    },
    {
        name: 'list_threads',
        description: 'List threads in inbox',
        paramsSchema: ListInboxItemsParams,
        func: listThreads,
    },
    {
        name: 'get_thread',
        description: 'Get thread',
        paramsSchema: GetThreadParams,
        func: getThread,
    },
    {
        name: 'get_attachment',
        description: 'Get attachment',
        paramsSchema: GetAttachmentParams,
        func: getAttachment,
    },
    {
        name: 'send_message',
        description: 'Send message',
        paramsSchema: SendMessageParams,
        func: sendMessage,
    },
    {
        name: 'reply_to_message',
        description: 'Reply to message',
        paramsSchema: ReplyToMessageParams,
        func: replyToMessage,
    },
    {
        name: 'update_message',
        description: 'Update message',
        paramsSchema: UpdateMessageParams,
        func: updateMessage,
    },
]

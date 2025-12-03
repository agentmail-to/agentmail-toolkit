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
    params_schema: z.ZodObject<any>
    func: (client: AgentMailClient, args: Args) => Promise<any>
}

export const tools: Tool[] = [
    {
        name: 'list_inboxes',
        description: 'List inboxes',
        params_schema: ListItemsParams,
        func: listInboxes,
    },
    {
        name: 'get_inbox',
        description: 'Get inbox',
        params_schema: GetInboxParams,
        func: getInbox,
    },
    {
        name: 'create_inbox',
        description: 'Create inbox',
        params_schema: CreateInboxParams,
        func: createInbox,
    },
    {
        name: 'delete_inbox',
        description: 'Delete inbox',
        params_schema: GetInboxParams,
        func: deleteInbox,
    },
    {
        name: 'list_threads',
        description: 'List threads in inbox',
        params_schema: ListInboxItemsParams,
        func: listThreads,
    },
    {
        name: 'get_thread',
        description: 'Get thread',
        params_schema: GetThreadParams,
        func: getThread,
    },
    {
        name: 'get_attachment',
        description: 'Get attachment',
        params_schema: GetAttachmentParams,
        func: getAttachment,
    },
    {
        name: 'send_message',
        description: 'Send message',
        params_schema: SendMessageParams,
        func: sendMessage,
    },
    {
        name: 'reply_to_message',
        description: 'Reply to message',
        params_schema: ReplyToMessageParams,
        func: replyToMessage,
    },
    {
        name: 'update_message',
        description: 'Update message',
        params_schema: UpdateMessageParams,
        func: updateMessage,
    },
]

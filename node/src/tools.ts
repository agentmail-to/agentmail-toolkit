import { AnyZodObject } from 'zod'

import {
    ListItemsParams,
    GetInboxParams,
    CreateInboxParams,
    ListThreadsParams,
    GetThreadParams,
    ListMessagesParams,
    GetMessageParams,
    SendMessageParams,
    ReplyToMessageParams,
} from './schemas'

export interface Tool {
    name: string
    method: string
    description: string
    schema: AnyZodObject
}

export const tools: Tool[] = [
    {
        name: 'list_inboxes',
        method: 'inboxes.list',
        description: 'List inboxes',
        schema: ListItemsParams,
    },
    {
        name: 'get_inbox',
        method: 'inboxes.get',
        description: 'Get inbox',
        schema: GetInboxParams,
    },
    {
        name: 'create_inbox',
        method: 'inboxes.create',
        description: 'Create inbox. Use default username, domain, and display name unless otherwise specified.',
        schema: CreateInboxParams,
    },
    {
        name: 'list_threads',
        method: 'inboxes.threads.list',
        description: 'List threads in inbox',
        schema: ListThreadsParams,
    },
    {
        name: 'get_thread',
        method: 'inboxes.threads.get',
        description: 'Get thread',
        schema: GetThreadParams,
    },
    {
        name: 'list_messages',
        method: 'inboxes.messages.list',
        description: 'List messages in inbox',
        schema: ListMessagesParams,
    },
    {
        name: 'get_message',
        method: 'inboxes.messages.get',
        description: 'Get message',
        schema: GetMessageParams,
    },
    {
        name: 'send_message',
        method: 'inboxes.messages.send',
        description: 'Send message',
        schema: SendMessageParams,
    },
    {
        name: 'reply_to_message',
        method: 'inboxes.messages.reply',
        description: 'Reply to message',
        schema: ReplyToMessageParams,
    },
]

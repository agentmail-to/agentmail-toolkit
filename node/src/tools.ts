import { ZodTypeAny } from 'zod'

import {
    ListItemsParams,
    GetInboxParams,
    CreateInboxParams,
    ListThreadsParams,
    GetThreadParams,
    ListMessagesParams,
    GetMessageParams,
    GetAttachmentParams,
    SendMessageParams,
    ReplyToMessageParams,
} from './schemas'

export type Tool = {
    name: string
    method: string
    description: string
    schema: ZodTypeAny
}

export const tools: Tool[] = [
    {
        name: 'list_inboxes',
        method: 'inboxes.list',
        description: 'List all inboxes',
        schema: ListItemsParams,
    },
    {
        name: 'get_inbox',
        method: 'inboxes.get',
        description: 'Get an inbox by ID',
        schema: GetInboxParams,
    },
    {
        name: 'create_inbox',
        method: 'inboxes.create',
        description: 'Create a new inbox',
        schema: CreateInboxParams,
    },
    {
        name: 'list_threads',
        method: 'threads.list',
        description: 'List all threads',
        schema: ListThreadsParams,
    },
    {
        name: 'get_thread',
        method: 'threads.get',
        description: 'Get a thread by ID',
        schema: GetThreadParams,
    },
    {
        name: 'list_messages',
        method: 'messages.list',
        description: 'List all messages',
        schema: ListMessagesParams,
    },
    {
        name: 'get_message',
        method: 'messages.get',
        description: 'Get a message by ID',
        schema: GetMessageParams,
    },
    {
        name: 'get_attachment',
        method: 'attachments.get',
        description: 'Get an attachment by ID',
        schema: GetAttachmentParams,
    },
    {
        name: 'send_message',
        method: 'messages.send',
        description: 'Send a message',
        schema: SendMessageParams,
    },
    {
        name: 'reply_to_message',
        method: 'messages.reply',
        description: 'Reply to a message',
        schema: ReplyToMessageParams,
    },
]

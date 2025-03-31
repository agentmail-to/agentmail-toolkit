import { z } from 'zod'

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
    methodName: string
    description: string
    paramsSchema: z.ZodObject<any>
}

export const tools: Tool[] = [
    {
        name: 'list_inboxes',
        methodName: 'inboxes.list',
        description: 'List all inboxes',
        paramsSchema: ListItemsParams,
    },
    {
        name: 'get_inbox',
        methodName: 'inboxes.get',
        description: 'Get an inbox by ID',
        paramsSchema: GetInboxParams,
    },
    {
        name: 'create_inbox',
        methodName: 'inboxes.create',
        description: 'Create a new inbox',
        paramsSchema: CreateInboxParams,
    },
    {
        name: 'list_threads',
        methodName: 'threads.list',
        description: 'List all threads',
        paramsSchema: ListThreadsParams,
    },
    {
        name: 'get_thread',
        methodName: 'threads.get',
        description: 'Get a thread by ID',
        paramsSchema: GetThreadParams,
    },
    {
        name: 'list_messages',
        methodName: 'messages.list',
        description: 'List all messages',
        paramsSchema: ListMessagesParams,
    },
    {
        name: 'get_message',
        methodName: 'messages.get',
        description: 'Get a message by ID',
        paramsSchema: GetMessageParams,
    },
    {
        name: 'get_attachment',
        methodName: 'attachments.get',
        description: 'Get an attachment by ID',
        paramsSchema: GetAttachmentParams,
    },
    {
        name: 'send_message',
        methodName: 'messages.send',
        description: 'Send a message',
        paramsSchema: SendMessageParams,
    },
    {
        name: 'reply_to_message',
        methodName: 'messages.reply',
        description: 'Reply to a message',
        paramsSchema: ReplyToMessageParams,
    },
]

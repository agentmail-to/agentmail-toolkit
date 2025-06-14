import { AnyZodObject } from 'zod'

import {
    ListItemsParams,
    ListInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    ListThreadsParams,
    GetThreadParams,
    ListMessagesParams,
    GetMessageParams,
    SendMessageParams,
    ReplyToMessageParams,
    UpdateMessageParams,
    ListDraftsParams,
    GetDraftParams,
    CreateDraftParams,
    SendDraftParams,
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
        description: 'Create inbox',
        schema: CreateInboxParams,
    },
    {
        name: 'list_threads',
        method: 'inboxes.threads.list',
        description: 'List threads in inbox',
        schema: ListThreadsParams,
    },
    {
        name: 'list_all_threads',
        method: 'threads.list',
        description: 'List threads in all inboxes',
        schema: ListInboxItemsParams,
    },
    {
        name: 'get_thread',
        method: 'threads.get',
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
    {
        name: 'update_message',
        method: 'inboxes.messages.update',
        description: 'Update message',
        schema: UpdateMessageParams,
    },
    {
        name: 'list_drafts',
        method: 'inboxes.drafts.list',
        description: 'List drafts in inbox',
        schema: ListDraftsParams,
    },
    {
        name: 'list_all_drafts',
        method: 'drafts.list',
        description: 'List drafts in all inboxes',
        schema: ListInboxItemsParams,
    },
    {
        name: 'get_draft',
        method: 'drafts.get',
        description: 'Get draft',
        schema: GetDraftParams,
    },
    {
        name: 'create_draft',
        method: 'inboxes.drafts.create',
        description: 'Create draft',
        schema: CreateDraftParams,
    },
    {
        name: 'send_draft',
        method: 'inboxes.drafts.send',
        description: 'Send draft',
        schema: SendDraftParams,
    },
]

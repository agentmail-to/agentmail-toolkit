import { AnyZodObject } from 'zod'

import {
    ListItemsParams,
    ListInboxItemsParams,
    GetInboxParams,
    CreateInboxParams,
    ListThreadsParams,
    GetThreadParams,
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
    params_schema: AnyZodObject
}

export const tools: Tool[] = [
    {
        name: 'list_inboxes',
        method: 'inboxes.list',
        description: 'List inboxes',
        params_schema: ListItemsParams,
    },
    {
        name: 'get_inbox',
        method: 'inboxes.get',
        description: 'Get inbox',
        params_schema: GetInboxParams,
    },
    {
        name: 'create_inbox',
        method: 'inboxes.create',
        description: 'Create inbox',
        params_schema: CreateInboxParams,
    },
    {
        name: 'list_threads',
        method: 'inboxes.threads.list',
        description: 'List threads in inbox',
        params_schema: ListThreadsParams,
    },
    {
        name: 'list_all_threads',
        method: 'threads.list',
        description: 'List threads in all inboxes',
        params_schema: ListInboxItemsParams,
    },
    {
        name: 'get_thread',
        method: 'threads.get',
        description: 'Get thread',
        params_schema: GetThreadParams,
    },
    {
        name: 'send_message',
        method: 'inboxes.messages.send',
        description: 'Send message',
        params_schema: SendMessageParams,
    },
    {
        name: 'reply_to_message',
        method: 'inboxes.messages.reply',
        description: 'Reply to message',
        params_schema: ReplyToMessageParams,
    },
    {
        name: 'update_message',
        method: 'inboxes.messages.update',
        description: 'Update message',
        params_schema: UpdateMessageParams,
    },
    {
        name: 'list_drafts',
        method: 'inboxes.drafts.list',
        description: 'List drafts in inbox',
        params_schema: ListDraftsParams,
    },
    {
        name: 'list_all_drafts',
        method: 'drafts.list',
        description: 'List drafts in all inboxes',
        params_schema: ListInboxItemsParams,
    },
    {
        name: 'get_draft',
        method: 'drafts.get',
        description: 'Get draft',
        params_schema: GetDraftParams,
    },
    {
        name: 'create_draft',
        method: 'inboxes.drafts.create',
        description: 'Create draft',
        params_schema: CreateDraftParams,
    },
    {
        name: 'send_draft',
        method: 'inboxes.drafts.send',
        description: 'Send draft',
        params_schema: SendDraftParams,
    },
]

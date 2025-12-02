import { z } from 'zod'

const InboxIdSchema = z.string().describe('ID of inbox')
const ThreadIdSchema = z.string().describe('ID of thread')
const MessageIdSchema = z.string().describe('ID of message')
const AttachmentIdSchema = z.string().describe('ID of attachment')

export const ListItemsParams = z.object({
    limit: z.number().optional().default(10).describe('Max number of items to return'),
    page_token: z.string().optional().describe('Page token for pagination'),
})

export const GetInboxParams = z.object({
    inbox_id: InboxIdSchema,
})

export const CreateInboxParams = z.object({
    username: z.string().optional().describe('Username'),
    domain: z.string().optional().describe('Domain'),
    display_name: z.string().optional().describe('Display name'),
})

export const ListInboxItemsParams = ListItemsParams.extend({
    inbox_id: InboxIdSchema,
    labels: z.array(z.string()).optional().describe('Labels to filter items by'),
    before: z.string().optional().describe('Filter items before datetime'),
    after: z.string().optional().describe('Filter items after datetime'),
})

export const GetThreadParams = z.object({
    inbox_id: InboxIdSchema,
    thread_id: ThreadIdSchema,
})

export const GetAttachmentParams = z.object({
    inbox_id: InboxIdSchema,
    thread_id: ThreadIdSchema,
    attachment_id: AttachmentIdSchema,
})

const BaseMessageParams = z.object({
    inbox_id: InboxIdSchema,
    text: z.string().optional().describe('Plain text body'),
    html: z.string().optional().describe('HTML body'),
    labels: z.array(z.string()).optional().describe('Labels'),
})

export const SendMessageParams = BaseMessageParams.extend({
    to: z.array(z.string()).describe('Recipients'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    bcc: z.array(z.string()).optional().describe('BCC recipients'),
    subject: z.string().optional().describe('Subject'),
})

export const ReplyToMessageParams = BaseMessageParams.extend({
    message_id: MessageIdSchema,
})

export const UpdateMessageParams = z.object({
    inbox_id: InboxIdSchema,
    message_id: MessageIdSchema,
    add_labels: z.array(z.string()).optional().describe('Labels to add'),
    remove_labels: z.array(z.string()).optional().describe('Labels to remove'),
})

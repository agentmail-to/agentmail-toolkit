import { z } from 'zod'

export const ListItemsParams = z.object({
    limit: z.number().optional().describe('Max number of items to return'),
    page_token: z.string().optional().describe('Page token for pagination'),
})

export const ListInboxItemsParams = ListItemsParams.extend({
    labels: z.array(z.string()).optional().describe('Labels to filter items by'),
    ascending: z.boolean().optional().describe('Sort items in ascending order'),
})

export const GetInboxParams = z.object({
    inbox_id: z.string().describe('ID of inbox to get'),
})

export const CreateInboxParams = z.object({
    username: z.string().optional().describe('Username of inbox to create'),
    domain: z.string().optional().describe('Domain of inbox to create'),
    display_name: z.string().optional().describe('Display name of inbox to create'),
})

export const ListThreadsParams = ListInboxItemsParams.extend({
    inbox_id: z.string().describe('ID of inbox to list threads from'),
})

export const GetThreadParams = z.object({
    thread_id: z.string().describe('ID of thread to get'),
})

export const ListMessagesParams = ListInboxItemsParams.extend({
    inbox_id: z.string().describe('ID of inbox to list messages from'),
})

export const GetMessageParams = z.object({
    inbox_id: z.string().describe('ID of inbox to get message from'),
    message_id: z.string().describe('ID of message to get'),
})

export const SendMessageParams = z.object({
    inbox_id: z.string().describe('ID of inbox to send message from'),
    to: z.array(z.string()).describe('Recipients of message'),
    cc: z.array(z.string()).optional().describe('CC recipients of message'),
    bcc: z.array(z.string()).optional().describe('BCC recipients of message'),
    subject: z.string().optional().describe('Subject of message'),
    text: z.string().optional().describe('Plain text body of message'),
    html: z.string().optional().describe('HTML body of message'),
    labels: z.array(z.string()).optional().describe('Labels to add to message'),
})

export const ReplyToMessageParams = z.object({
    inbox_id: z.string().describe('ID of inbox to reply to message from'),
    message_id: z.string().describe('ID of message to reply to'),
    text: z.string().optional().describe('Plain text body of reply'),
    html: z.string().optional().describe('HTML body of reply'),
    labels: z.array(z.string()).optional().describe('Labels to add to reply'),
})

export const UpdateMessageParams = z.object({
    inbox_id: z.string().describe('ID of inbox to update message from'),
    message_id: z.string().describe('ID of message to update'),
    add_labels: z.array(z.string()).optional().describe('Labels to add to message'),
    remove_labels: z.array(z.string()).optional().describe('Labels to remove from message'),
})

export const ListDraftsParams = ListInboxItemsParams.extend({
    inbox_id: z.string().describe('ID of inbox to list drafts from'),
})

export const GetDraftParams = z.object({
    inbox_id: z.string().describe('ID of inbox to get draft from'),
    draft_id: z.string().describe('ID of draft to get'),
})

export const CreateDraftParams = z.object({
    inbox_id: z.string().describe('ID of inbox to create draft from'),
    to: z.array(z.string()).describe('Recipients of draft'),
    cc: z.array(z.string()).optional().describe('CC recipients of draft'),
    bcc: z.array(z.string()).optional().describe('BCC recipients of draft'),
    subject: z.string().optional().describe('Subject of draft'),
    text: z.string().optional().describe('Plain text body of draft'),
    html: z.string().optional().describe('HTML body of draft'),
    labels: z.array(z.string()).optional().describe('Labels to add to draft'),
})

export const SendDraftParams = z.object({
    inbox_id: z.string().describe('ID of inbox to send draft from'),
    draft_id: z.string().describe('ID of draft to send'),
    add_labels: z.array(z.string()).optional().describe('Labels to add to sent message'),
    remove_labels: z.array(z.string()).optional().describe('Labels to remove from sent message'),
})

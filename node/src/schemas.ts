import { z } from 'zod'

export const ListItemsParams = z.object({
    limit: z.number().optional().describe('Max number of items to return'),
    page_token: z.string().optional().describe('Page token for pagination'),
})

export const GetInboxParams = z.object({
    inbox_id: z.string().describe('ID of inbox to get'),
})

export const CreateInboxParams = z.object({
    username: z.string().optional().describe('Username of inbox to create'),
    domain: z.string().optional().describe('Domain of inbox to create'),
    display_name: z.string().optional().describe('Display name of inbox to create'),
})

export const ListThreadsParams = ListItemsParams.extend({
    inbox_id: z.string().describe('ID of inbox to list threads from'),
    labels: z.array(z.string()).optional().describe('Labels to filter threads by'),
})

export const GetThreadParams = z.object({
    inbox_id: z.string().describe('ID of inbox to get thread from'),
    thread_id: z.string().describe('ID of thread to get'),
})

export const ListMessagesParams = ListItemsParams.extend({
    inbox_id: z.string().describe('ID of inbox to list messages from'),
    labels: z.array(z.string()).optional().describe('Labels to filter messages by'),
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
})

export const ReplyToMessageParams = z.object({
    inbox_id: z.string().describe('ID of inbox to reply to message from'),
    message_id: z.string().describe('ID of message to reply to'),
    text: z.string().optional().describe('Plain text body of reply'),
    html: z.string().optional().describe('HTML body of reply'),
})

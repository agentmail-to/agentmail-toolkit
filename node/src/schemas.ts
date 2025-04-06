import { z } from 'zod'

export const ListItemsParams = z.object({
    limit: z.number().optional().describe('The maximum number of items to return'),
    lastKey: z.string().optional().describe('The last key to use for pagination'),
})

export const GetInboxParams = z.object({
    inboxId: z.string().describe('The ID of the inbox to get'),
})

export const CreateInboxParams = z.object({
    username: z.string().optional().describe('The username of the inbox to create'),
    domain: z.string().optional().describe('The domain of the inbox to create'),
    displayName: z.string().optional().describe('The display name of the inbox to create'),
})

export const ListThreadsParams = ListItemsParams.extend({
    inboxId: z.string().describe('The ID of the inbox to list threads for'),
    labels: z.array(z.string()).optional().describe('The labels to filter threads by'),
})

export const GetThreadParams = z.object({
    inboxId: z.string().describe('The ID of the inbox to get the thread for'),
    threadId: z.string().describe('The ID of the thread to get'),
})

export const ListMessagesParams = ListItemsParams.extend({
    inboxId: z.string().describe('The ID of the inbox to list messages for'),
    labels: z.array(z.string()).optional().describe('The labels to filter messages by'),
})

export const GetMessageParams = z.object({
    inboxId: z.string().describe('The ID of the inbox to get the message for'),
    messageId: z.string().describe('The ID of the message to get'),
})

export const GetAttachmentParams = z.object({
    inboxId: z.string().describe('The ID of the inbox to get the attachment for'),
    messageId: z.string().describe('The ID of the message to get the attachment for'),
    attachmentId: z.string().describe('The ID of the attachment to get'),
})

export const SendMessageParams = z.object({
    inboxId: z.string().describe('The ID of the inbox to send the message from'),
    to: z.array(z.string()).describe('The list of recipients'),
    cc: z.array(z.string()).optional().describe('The list of CC recipients'),
    bcc: z.array(z.string()).optional().describe('The list of BCC recipients'),
    subject: z.string().optional().describe('The subject of the message'),
    text: z.string().optional().describe('The plain text body of the message'),
    html: z.string().optional().describe('The HTML body of the message'),
})

export const ReplyToMessageParams = z.object({
    inboxId: z.string().describe('The inbox ID of the inbox to reply to the message from'),
    messageId: z.string().describe('The message ID of the message you wish to reply to'),
    text: z.string().optional().describe('The plain text body of the reply'),
    html: z.string().optional().describe('The HTML body of the reply'),
})

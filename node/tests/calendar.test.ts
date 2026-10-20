import { describe, expect, it } from 'vitest'
import type { AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { tools } from '../src/tools.js'
import { calendar, calendarEvent, calendarMutation, mockClient } from './fixtures.js'

// Driven the way an MCP host drives them, with the SDK's calendar client stubbed at the method
// boundary so every argument a tool hands the SDK is observable.

type Call = { method: string; args: unknown[] }

async function connect(calls: Call[], overrides: Record<string, unknown> = {}) {
    const record = (method: string, result: unknown) => async (...args: unknown[]) => {
        calls.push({ method, args })
        return result
    }
    const base = mockClient() as unknown as { inboxes: Record<string, unknown> }
    const client = mockClient({
        inboxes: {
            ...base.inboxes,
            calendar: {
                getAgenda: record('getAgenda', { count: 0, limit: 50, events: [] }),
                getEvent: record('getEvent', calendarEvent()),
                createEvent: record('createEvent', calendarMutation()),
                updateEvent: record('updateEvent', calendarMutation()),
                deleteEvent: record('deleteEvent', { deletionId: 'del_1' }),
                respondToEvent: record('respondToEvent', calendarMutation()),
                get: record('get', calendar()),
                update: record('update', calendar()),
                ...overrides,
            },
        },
    }) as AgentMailClient
    const server = new McpServer({ name: 'agentmail-test', version: '0.0.0' })
    for (const tool of new AgentMailToolkit(client).getTools()) server.registerTool(tool.name, tool, tool.callback)
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const mcpClient = new Client({ name: 'test-client', version: '0.0.0' })
    await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)])
    return mcpClient
}

const INBOX = 'agent@agentmail.to'
const EVENT = '3f8a2c1e-6b4d-4e9f-a7c2-5d1b8e0f9a36'
const DATED = `${EVENT}_t20261015T140000`

describe('calendar tools', () => {
    it('reads the agenda for a window given with an offset, sent to the SDK as instants', async () => {
        const calls: Call[] = []
        const client = await connect(calls)

        const result = await client.callTool({
            name: 'get_agenda',
            arguments: { inboxId: INBOX, after: '2026-10-20T00:00:00-04:00', before: '2026-10-21T00:00:00-04:00', consistency: 'primary' },
        })

        expect(result.isError).toBeFalsy()
        expect(calls).toEqual([
            {
                method: 'getAgenda',
                args: [INBOX, { after: new Date('2026-10-20T04:00:00.000Z'), before: new Date('2026-10-21T04:00:00.000Z'), consistency: 'primary' }],
            },
        ])
    })

    it("refuses an agenda window without a timezone rather than reading it in the server's", async () => {
        const calls: Call[] = []
        const client = await connect(calls)

        const result = await client.callTool({ name: 'get_agenda', arguments: { inboxId: INBOX, after: '2026-10-20T00:00:00' } })

        expect(result.isError).toBe(true)
        expect(calls).toEqual([])
    })

    it('creates an event with the body the SDK takes, and returns it without the iCalendar bookkeeping', async () => {
        const calls: Call[] = []
        const client = await connect(calls)
        const body = {
            title: 'Intro call with Acme',
            start: '2026-10-15T14:00:00',
            end: '2026-10-15T14:30:00',
            timezone: 'america/new_york',
            attendees: [{ email: 'jane@acme.com', name: 'Jane Doe' }],
            sendInvites: true,
            clientId: 'intro-acme',
        }

        const result = await client.callTool({ name: 'create_event', arguments: { inboxId: INBOX, ...body } })

        expect(calls).toEqual([{ method: 'createEvent', args: [INBOX, body] }])
        const { event } = result.structuredContent as { event: Record<string, unknown> }
        expect(event).toMatchObject({ eventId: EVENT, startAt: '2026-10-15T18:00:00.000Z', etag: '"rv-0"' })
        for (const key of ['uid', 'sequence', 'resourceRevision', 'durationMode', 'durationValue']) expect(event).not.toHaveProperty(key)
        expect(result.structuredContent).not.toHaveProperty('operationId')
    })

    it('updates one date of a recurring event conditionally, keeping ifMatch and mode out of the body', async () => {
        const calls: Call[] = []
        const client = await connect(calls)

        await client.callTool({
            name: 'update_event',
            arguments: { inboxId: INBOX, eventId: DATED, mode: 'future', ifMatch: '"occ-1"', location: null, sendInvites: true },
        })

        expect(calls).toEqual([{ method: 'updateEvent', args: [INBOX, DATED, { mode: 'future', ifMatch: '"occ-1"', location: null, sendInvites: true }] }])
    })

    it('sends back everything get_event returned when its attendees, recurrence and metadata go to update_event', async () => {
        const calls: Call[] = []
        const series = {
            ...calendarEvent(),
            kind: 'series' as const,
            recurrence: {
                rule: 'FREQ=WEEKLY;BYDAY=TH',
                exdates: ['2026-10-22T14:00:00'],
                rdates: ['2026-10-30T14:00:00', { start: '2026-11-03T09:00:00', duration: 'PT1H' }],
            },
            attendees: [
                { email: 'jane@acme.com', status: 'declined' as const, role: 'required' as const, comment: 'Out that week.', respondedAt: new Date('2026-10-10T12:00:00.000Z') },
            ],
            metadata: { crm: { dealId: 'D-1042' }, tags: ['vip'] },
        }
        const client = await connect(calls, { getEvent: async () => series })

        const read = await client.callTool({ name: 'get_event', arguments: { inboxId: INBOX, eventId: EVENT } })
        const { attendees, recurrence, metadata } = read.structuredContent as { attendees: unknown[]; recurrence: unknown; metadata: object }
        const result = await client.callTool({
            name: 'update_event',
            arguments: { inboxId: INBOX, eventId: EVENT, attendees: [...attendees, { email: 'bob@acme.com' }], recurrence, metadata: { ...metadata, followUp: true } },
        })

        expect(result.isError).toBeFalsy()
        expect(calls).toEqual([
            {
                method: 'updateEvent',
                args: [
                    INBOX,
                    EVENT,
                    { attendees: [...series.attendees, { email: 'bob@acme.com' }], recurrence: series.recurrence, metadata: { ...series.metadata, followUp: true } },
                ],
            },
        ])
    })

    it('reports a delete as a success carrying the deletion ID', async () => {
        const calls: Call[] = []
        const client = await connect(calls)

        const result = await client.callTool({ name: 'delete_event', arguments: { inboxId: INBOX, eventId: EVENT, sendInvites: true } })

        expect(calls).toEqual([{ method: 'deleteEvent', args: [INBOX, EVENT, { sendInvites: true }] }])
        expect(result.structuredContent).toEqual({ success: true, deletionId: 'del_1' })
    })

    it('answers an invitation through the respond route', async () => {
        const calls: Call[] = []
        const client = await connect(calls)

        await client.callTool({
            name: 'respond_to_invitation',
            arguments: { inboxId: INBOX, eventId: EVENT, status: 'declined', comment: 'Out that week.', sendReply: false },
        })

        expect(calls).toEqual([{ method: 'respondToEvent', args: [INBOX, EVENT, { status: 'declined', comment: 'Out that week.', sendReply: false }] }])
    })

    it("sets the calendar's default time zone", async () => {
        const calls: Call[] = []
        const client = await connect(calls)

        await client.callTool({ name: 'update_calendar', arguments: { inboxId: INBOX, timezone: 'Europe/London', ifMatch: '"rv-0"' } })

        expect(calls).toEqual([{ method: 'update', args: [INBOX, { timezone: 'Europe/London', ifMatch: '"rv-0"' }] }])
    })

    it("keeps a message's calendarEventId so an agent can go from an invitation email to its event", async () => {
        const client = await connect([])

        const result = await client.callTool({ name: 'get_message', arguments: { inboxId: INBOX, messageId: 'msg_1' } })

        expect(result.structuredContent).toMatchObject({ calendarEventId: EVENT })
    })

    it('says where Calendar runs on every calendar tool, and no longer places it in Labs', () => {
        const calendarTools = ['get_agenda', 'get_event', 'create_event', 'update_event', 'delete_event', 'respond_to_invitation', 'get_calendar', 'update_calendar']
        for (const name of calendarTools) {
            expect(tools.find((tool) => tool.name === name)?.description).toContain("Calendar isn't available in this region yet")
        }
        for (const name of ['get_labs', 'join_labs']) {
            expect(tools.find((tool) => tool.name === name)?.description).not.toMatch(/calendar first/i)
        }
    })
})

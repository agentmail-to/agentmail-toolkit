import { describe, it, expect } from 'vitest'

import { ListMessagesParams, ListThreadsParams } from '../src/schemas.js'

// zod strips unknown keys on parse, so before these params were declared the
// toolkit silently dropped includeBlocked / includeUnauthenticated before they
// reached the SDK — agents could not opt into blocked or unauthenticated mail.
// See agentmail-to/agentmail-mcp#38.
describe('list params expose blocked / unauthenticated filters', () => {
    it('ListMessagesParams forwards includeBlocked and includeUnauthenticated', () => {
        const parsed = ListMessagesParams.parse({
            inboxId: 'inbox_123',
            includeBlocked: true,
            includeUnauthenticated: true,
        })

        expect(parsed.includeBlocked).toBe(true)
        expect(parsed.includeUnauthenticated).toBe(true)
    })

    it('ListThreadsParams forwards includeBlocked and includeUnauthenticated', () => {
        const parsed = ListThreadsParams.parse({
            inboxId: 'inbox_123',
            includeBlocked: true,
            includeUnauthenticated: true,
        })

        expect(parsed.includeBlocked).toBe(true)
        expect(parsed.includeUnauthenticated).toBe(true)
    })

    it('leaves the filters undefined when not provided', () => {
        const parsed = ListMessagesParams.parse({ inboxId: 'inbox_123' })

        expect(parsed.includeBlocked).toBeUndefined()
        expect(parsed.includeUnauthenticated).toBeUndefined()
    })
})

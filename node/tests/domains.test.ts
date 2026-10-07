import { describe, it, expect } from 'vitest'
import { AgentMailError, type AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { toJSONSchema } from 'zod'

import { AgentMailToolkit } from '../src/mcp.js'
import { tools } from '../src/tools.js'
import { CreateDomainParams, GetDomainParams, ListItemsParams } from '../src/schemas.js'
import { createDomain, getDomain, listDomains } from '../src/functions.js'
import { mockClient, domain, domainItem, domainRecord } from './fixtures.js'

// The domain tools, driven the way an MCP host drives them: a real client/server pair over an
// in-memory transport, with the SDK stubbed at the method boundary so every argument the tool hands
// the SDK, and every field it hands back to the model, is observable.

async function connect(client: AgentMailClient) {
    const server = new McpServer({ name: 'agentmail-test', version: '0.0.0' })
    for (const tool of new AgentMailToolkit(client).getTools()) {
        server.registerTool(tool.name, tool, tool.callback)
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const mcpClient = new Client({ name: 'test-client', version: '0.0.0' })
    await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)])
    await mcpClient.listTools()
    return mcpClient
}

type Call = { method: string; args: unknown[] }
type DomainsOverrides = Partial<Record<'list' | 'get' | 'create', (...args: unknown[]) => Promise<unknown>>>

function domainsClient(calls: Call[], overrides: DomainsOverrides = {}): AgentMailClient {
    const record =
        (method: string, result: () => unknown) =>
        async (...args: unknown[]) => {
            calls.push({ method, args })
            return result()
        }
    return mockClient({
        domains: {
            list: record('domains.list', () => ({ count: 1, domains: [domainItem()] })),
            get: record('domains.get', domain),
            create: record('domains.create', domain),
            ...overrides,
        },
    })
}

const text = (result: { [key: string]: unknown }) => (result.content as Array<{ text: string }>)[0]!.text
const INTERNAL_KEYS = ['podId', 'clientId', 'organization_id', 'pod_id', 'organizationId']

describe('catalog: the domain read tools', () => {
    const names = tools.map((t) => t.name)
    const byName = (name: string) => tools.find((t) => t.name === name)!

    it('sit with the inbox tools, after delete_inbox and before the thread tools', () => {
        expect(names.slice(names.indexOf('delete_inbox') + 1, names.indexOf('delete_inbox') + 4)).toEqual(['list_domains', 'get_domain', 'create_domain'])
        expect(names.indexOf('list_threads')).toBe(names.indexOf('create_domain') + 1)
    })

    it.each(['list_domains', 'get_domain'])('%s is a read: read-only, idempotent, not destructive, closed world', (name) => {
        expect(byName(name).annotations).toEqual({
            title: byName(name).title,
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
        })
    })

    it('names the permission each read needs, and that inbox-scoped keys cannot use domains', () => {
        expect(byName('list_domains').description).toContain('domain_read')
        expect(byName('get_domain').description).toContain('domain_read')
        expect(byName('get_domain').description).toContain('inbox-scoped API keys cannot access domains')
    })

    it('points list_domains at get_domain for status and records, which the list does not carry', () => {
        expect(byName('list_domains').description).toContain('get_domain')
    })
})

describe('GetDomainParams', () => {
    it('accepts a domain ID', () => {
        expect(GetDomainParams.parse({ domainId: 'example.com' })).toEqual({ domainId: 'example.com' })
    })

    it.each([
        ['an empty ID', ''],
        ['a "." segment', '.'],
        ['a ".." segment', '..'],
    ])('rejects %s before any request', (_case, domainId) => {
        expect(GetDomainParams.safeParse({ domainId }).success).toBe(false)
    })

    it('rejects a missing ID', () => {
        expect(GetDomainParams.safeParse({}).success).toBe(false)
    })

    it('advertises the ID as a plain described string, with no format or pattern for strict hosts to reject', () => {
        const schema = toJSONSchema(GetDomainParams) as { properties?: { domainId?: Record<string, unknown> } }
        const domainId = schema.properties!.domainId!
        expect(domainId.type).toBe('string')
        expect(domainId).not.toHaveProperty('format')
        expect(domainId).not.toHaveProperty('pattern')
        expect(domainId.description).toMatch(/list_domains or create_domain/)
    })
})

describe('list_domains', () => {
    it('defaults to ten per page and hands the page controls to the SDK as they are', async () => {
        const calls: Call[] = []
        await listDomains(domainsClient(calls), ListItemsParams.parse({}))
        expect(calls).toEqual([{ method: 'domains.list', args: [{ limit: 10 }] }])
    })

    it('passes an explicit limit and page token through MCP', async () => {
        const calls: Call[] = []
        const client = await connect(domainsClient(calls))
        const result = await client.callTool({ name: 'list_domains', arguments: { limit: 3, pageToken: 'next-page' } })

        expect(result.isError ?? false).toBe(false)
        expect(calls).toEqual([{ method: 'domains.list', args: [{ limit: 3, pageToken: 'next-page' }] }])
    })

    it('returns each domain with its flags and dates, and the paging fields', async () => {
        const client = await connect(
            domainsClient([], {
                list: async () => ({
                    count: 2,
                    limit: 2,
                    nextPageToken: 'tok',
                    domains: [domainItem(), { ...domainItem(), domainId: 'mail.example.com', domain: 'mail.example.com' }],
                }),
            })
        )
        const result = await client.callTool({ name: 'list_domains', arguments: { limit: 2 } })
        const structured = result.structuredContent as { count: number; limit: number; nextPageToken: string; domains: Record<string, unknown>[] }

        expect(structured).toMatchObject({ count: 2, limit: 2, nextPageToken: 'tok' })
        expect(structured.domains).toHaveLength(2)
        expect(structured.domains[1]).toEqual({
            domainId: 'mail.example.com',
            domain: 'mail.example.com',
            feedbackEnabled: true,
            subdomainsEnabled: false,
            trackingEnabled: false,
            updatedAt: '2026-07-10T12:00:00.000Z',
            createdAt: '2026-07-10T12:00:00.000Z',
        })
    })

    it('strips pod, client and organization identifiers from every row', async () => {
        const client = await connect(domainsClient([]))
        const result = await client.callTool({ name: 'list_domains', arguments: {} })
        const [row] = (result.structuredContent as { domains: Record<string, unknown>[] }).domains

        for (const key of INTERNAL_KEYS) expect(row).not.toHaveProperty(key)
        expect(text(result)).not.toContain('pod_1')
        expect(text(result)).not.toContain('client-domain-1')
        expect(text(result)).not.toContain('org_internal_1')
        expect(text(result)).not.toContain('pod_internal_1')
    })

    it('returns an empty page as an empty list, not an error', async () => {
        const client = await connect(domainsClient([], { list: async () => ({ count: 0, domains: [] }) }))
        const result = await client.callTool({ name: 'list_domains', arguments: {} })

        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toEqual({ count: 0, domains: [] })
    })
})

describe('get_domain', () => {
    it('asks the SDK for exactly that domain, with nothing else', async () => {
        const calls: Call[] = []
        await getDomain(domainsClient(calls), GetDomainParams.parse({ domainId: 'example.com' }))
        expect(calls).toEqual([{ method: 'domains.get', args: ['example.com'] }])
    })

    it('returns the status and every record with its own status, through MCP', async () => {
        const calls: Call[] = []
        const client = await connect(domainsClient(calls))
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'example.com' } })
        const structured = result.structuredContent as Record<string, unknown>

        expect(calls).toEqual([{ method: 'domains.get', args: ['example.com'] }])
        expect(structured).toMatchObject({ domainId: 'example.com', domain: 'example.com', status: 'NOT_STARTED' })
        expect(structured.records).toEqual([
            { type: 'MX', name: 'example.com', value: 'inbound-smtp.us-east-1.amazonaws.com', status: 'MISSING', priority: 10 },
            { type: 'TXT', name: 'agentmail._domainkey.example.com', value: 'v=DKIM1; k=rsa; p=KEY', status: 'MISSING' },
        ])
    })

    it("carries the domain's reason and each record's reason, which drive the agent's next step", async () => {
        const client = await connect(
            domainsClient([], {
                get: async () => ({
                    ...domain(),
                    status: 'INVALID',
                    reason: 'records_missing',
                    records: [{ ...domainRecord(), status: 'INVALID', reason: 'value_mismatch' }],
                }),
            })
        )
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'example.com' } })
        const structured = result.structuredContent as { status: string; reason: string; records: Array<Record<string, unknown>> }

        expect(structured.status).toBe('INVALID')
        expect(structured.reason).toBe('records_missing')
        expect(structured.records[0]).toMatchObject({ status: 'INVALID', reason: 'value_mismatch' })
    })

    it('strips pod, client and organization identifiers, at the top and inside each record', async () => {
        const client = await connect(
            domainsClient([], { get: async () => ({ ...domain(), records: [{ ...domainRecord(), organization_id: 'org_internal_1', check_debug: 'x' }] }) })
        )
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'example.com' } })
        const structured = result.structuredContent as Record<string, unknown> & { records: Record<string, unknown>[] }

        for (const key of INTERNAL_KEYS) expect(structured).not.toHaveProperty(key)
        expect(structured.records[0]).not.toHaveProperty('organization_id')
        expect(structured.records[0]).not.toHaveProperty('check_debug')
        expect(text(result)).not.toContain('org_internal_1')
    })

    it('turns the SDK dates into ISO strings', async () => {
        const client = await connect(domainsClient([]))
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'example.com' } })

        expect(result.structuredContent).toMatchObject({ createdAt: '2026-07-10T12:00:00.000Z', updatedAt: '2026-07-10T12:00:00.000Z' })
    })

    it('passes a status or record value it has not seen before through to the agent', async () => {
        // The statuses are API vocabulary that can grow; a new value must not fail the whole result.
        const client = await connect(
            domainsClient([], { get: async () => ({ ...domain(), status: 'QUARANTINED', records: [{ ...domainRecord(), type: 'CAA', status: 'STALE' }] }) })
        )
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'example.com' } })

        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toMatchObject({ status: 'QUARANTINED', records: [{ type: 'CAA', status: 'STALE' }] })
    })

    it('refuses a result without records rather than handing the agent a domain it cannot act on', async () => {
        const { records: _records, ...withoutRecords } = domain()
        const client = await connect(domainsClient([], { get: async () => withoutRecords }))
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'example.com' } })

        expect(result.isError).toBe(true)
        expect(text(result)).toContain('did not match its declared output schema')
    })

    it('surfaces a 404 for a domain the credential cannot see', async () => {
        const client = await connect(
            domainsClient([], {
                get: async () => {
                    throw new AgentMailError({ statusCode: 404, body: { name: 'NotFoundError', message: 'Domain not found' } })
                },
            })
        )
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'nobody.example' } })

        expect(result.isError).toBe(true)
        expect(text(result)).toContain('404')
    })

    it('surfaces the 403 an inbox-scoped key gets', async () => {
        const client = await connect(
            domainsClient([], {
                get: async () => {
                    throw new AgentMailError({ statusCode: 403, body: { name: 'ForbiddenError', message: 'Forbidden' } })
                },
            })
        )
        const result = await client.callTool({ name: 'get_domain', arguments: { domainId: 'example.com' } })

        expect(result.isError).toBe(true)
        expect(text(result)).toContain('403')
    })

    it('rejects a "." or ".." ID before any request is made', async () => {
        const calls: Call[] = []
        const client = await connect(domainsClient(calls))

        for (const domainId of ['.', '..']) {
            const result = await client.callTool({ name: 'get_domain', arguments: { domainId } })
            expect(result.isError).toBe(true)
        }
        expect(calls).toEqual([])
    })

    it('behaves the same through invoke with a per-call client', async () => {
        const calls: Call[] = []
        const result = await new AgentMailToolkit(mockClient()).invoke('get_domain', domainsClient(calls), { domainId: 'example.com' })

        expect(calls).toEqual([{ method: 'domains.get', args: ['example.com'] }])
        expect(result.isError ?? false).toBe(false)
        expect(result.structuredContent).toMatchObject({ domainId: 'example.com', status: 'NOT_STARTED' })
        expect(result.structuredContent).not.toHaveProperty('clientId')
    })
})

describe('create_domain', () => {
    const tool = tools.find((t) => t.name === 'create_domain')!

    describe('catalog entry', () => {
        it('creates: not read-only, not idempotent, not destructive, closed world', () => {
            expect(tool.annotations).toEqual({
                title: 'Create Domain',
                readOnlyHint: false,
                destructiveHint: false,
                idempotentHint: false,
                openWorldHint: false,
            })
        })

        it('names the permission it needs', () => {
            expect(tool.description).toContain('domain_create')
        })

        it('tells the agent what the 422 means and to offer a subdomain first', () => {
            expect(tool.description).toContain('422')
            expect(tool.description).toContain('Google Workspace or Microsoft 365')
            expect(tool.description).toMatch(/subdomain/)
        })

        it('says the MX record takes the mail from any current provider, and offers no override', () => {
            expect(tool.description).toMatch(/adding its MX record moves mail away from any provider the domain uses today/)
            expect(tool.description).not.toContain('allowConflictingProvider')
        })

        it('points at get_domain to follow verification', () => {
            expect(tool.description).toContain('get_domain')
        })

        it('returns the full domain, records included', () => {
            expect(tool.outputSchema.shape).toHaveProperty('records')
            expect(tool.outputSchema.shape).toHaveProperty('status')
        })
    })

    describe('CreateDomainParams', () => {
        it('needs only the domain name', () => {
            expect(CreateDomainParams.parse({ domain: 'example.com' })).toEqual({ domain: 'example.com' })
        })

        it.each([
            ['a missing domain', {}],
            ['an empty domain', { domain: '' }],
            ['a number', { domain: 42 }],
        ])('rejects %s', (_case, args) => {
            expect(CreateDomainParams.safeParse(args).success).toBe(false)
        })

        it.each(['feedbackEnabled', 'subdomainsEnabled', 'trackingEnabled'])('takes %s only as a real boolean, never a string', (flag) => {
            expect(CreateDomainParams.safeParse({ domain: 'example.com', [flag]: true }).success).toBe(true)
            expect(CreateDomainParams.safeParse({ domain: 'example.com', [flag]: false }).success).toBe(true)
            expect(CreateDomainParams.safeParse({ domain: 'example.com', [flag]: 'true' }).success).toBe(false)
        })

        it('drops fields this tool does not offer, so they never reach the API', () => {
            const parsed = CreateDomainParams.parse({
                domain: 'example.com',
                allowConflictingProvider: true,
                clientId: 'c-1',
                inboundEnabled: false,
                dkimSelector: 'sel',
            })
            expect(parsed).toEqual({ domain: 'example.com' })
        })

        it('advertises exactly the domain and the three flags', () => {
            const schema = toJSONSchema(CreateDomainParams) as { properties?: Record<string, unknown> }
            expect(Object.keys(schema.properties!).sort()).toEqual(['domain', 'feedbackEnabled', 'subdomainsEnabled', 'trackingEnabled'])
        })

        it('advertises domain as the one required field, with no format or pattern', () => {
            const schema = toJSONSchema(CreateDomainParams) as { required?: string[]; properties?: Record<string, Record<string, unknown>> }
            expect(schema.required).toEqual(['domain'])
            expect(schema.properties!.domain).not.toHaveProperty('format')
            expect(schema.properties!.domain).not.toHaveProperty('pattern')
        })

        it('states each default, so the agent knows what leaving a flag out does', () => {
            const schema = toJSONSchema(CreateDomainParams) as { properties?: Record<string, { description?: string }> }
            expect(schema.properties!.feedbackEnabled!.description).toMatch(/Default true/)
            expect(schema.properties!.subdomainsEnabled!.description).toMatch(/Default false/)
            expect(schema.properties!.trackingEnabled!.description).toMatch(/Default false/)
        })
    })

    describe('the request', () => {
        it('sends only the domain when no flag is set, so the API defaults apply', async () => {
            const calls: Call[] = []
            await createDomain(domainsClient(calls), CreateDomainParams.parse({ domain: 'example.com' }))
            expect(calls).toEqual([{ method: 'domains.create', args: [{ domain: 'example.com' }] }])
        })

        it('sends every flag the agent sets, false included', async () => {
            const calls: Call[] = []
            const client = await connect(domainsClient(calls))
            const result = await client.callTool({
                name: 'create_domain',
                arguments: { domain: 'example.com', feedbackEnabled: false, subdomainsEnabled: true, trackingEnabled: true },
            })

            expect(result.isError ?? false).toBe(false)
            expect(calls).toEqual([
                {
                    method: 'domains.create',
                    args: [{ domain: 'example.com', feedbackEnabled: false, subdomainsEnabled: true, trackingEnabled: true }],
                },
            ])
        })

        it('never sends allowConflictingProvider, even when a host passes it', async () => {
            const calls: Call[] = []
            const client = await connect(domainsClient(calls))
            await client.callTool({ name: 'create_domain', arguments: { domain: 'example.com', allowConflictingProvider: true } })

            expect(calls).toEqual([{ method: 'domains.create', args: [{ domain: 'example.com' }] }])
        })

        it('passes the name as typed and leaves normalizing it to the API', async () => {
            const calls: Call[] = []
            const client = await connect(domainsClient(calls))
            await client.callTool({ name: 'create_domain', arguments: { domain: 'Mail.Example.COM' } })

            expect(calls).toEqual([{ method: 'domains.create', args: [{ domain: 'Mail.Example.COM' }] }])
        })

        it('does not send an unknown argument a host passes through', async () => {
            const calls: Call[] = []
            await new AgentMailToolkit(mockClient()).invoke('create_domain', domainsClient(calls), { domain: 'example.com', podId: 'pod_other' })

            expect(calls).toEqual([{ method: 'domains.create', args: [{ domain: 'example.com' }] }])
        })
    })

    describe('the result', () => {
        it('returns the new domain with its status and the records to add', async () => {
            const client = await connect(domainsClient([]))
            const result = await client.callTool({ name: 'create_domain', arguments: { domain: 'example.com' } })
            const structured = result.structuredContent as { status: string; records: unknown[] }

            expect(result.isError ?? false).toBe(false)
            expect(structured.status).toBe('NOT_STARTED')
            expect(structured.records).toHaveLength(2)
            expect(structured).toMatchObject({ domainId: 'example.com', domain: 'example.com', createdAt: '2026-07-10T12:00:00.000Z' })
        })

        it('strips pod, client and organization identifiers', async () => {
            const client = await connect(domainsClient([]))
            const result = await client.callTool({ name: 'create_domain', arguments: { domain: 'example.com' } })

            for (const key of INTERNAL_KEYS) expect(result.structuredContent).not.toHaveProperty(key)
            expect(text(result)).not.toContain('pod_1')
            expect(text(result)).not.toContain('client-domain-1')
            expect(text(result)).not.toContain('org_internal_1')
        })

        it('returns the extra records a flag adds', async () => {
            const wildcard = { type: 'MX', name: '*.example.com', value: 'inbound-smtp.us-east-1.amazonaws.com', status: 'MISSING', priority: 10 }
            const client = await connect(
                domainsClient([], { create: async () => ({ ...domain(), subdomainsEnabled: true, records: [...domain().records, wildcard] }) })
            )
            const result = await client.callTool({ name: 'create_domain', arguments: { domain: 'example.com', subdomainsEnabled: true } })
            const structured = result.structuredContent as { subdomainsEnabled: boolean; records: unknown[] }

            expect(structured.subdomainsEnabled).toBe(true)
            expect(structured.records).toContainEqual(wildcard)
        })
    })

    describe('errors', () => {
        const failing = (statusCode: number, body: Record<string, unknown>) => {
            const calls: Call[] = []
            const client = domainsClient(calls, {
                create: async (...args: unknown[]) => {
                    calls.push({ method: 'domains.create', args })
                    throw new AgentMailError({ statusCode, body })
                },
            })
            return { calls, client }
        }

        it('hands the agent the provider the 422 names, and makes one request only', async () => {
            const { calls, client } = failing(422, {
                name: 'UnprocessableEntityError',
                message:
                    'Domain "example.com" is configured with Google Workspace. Domains with existing email providers cannot be used simultaneously with AgentMail. Please use a dedicated domain or subdomain.',
            })
            const result = await (await connect(client)).callTool({ name: 'create_domain', arguments: { domain: 'example.com' } })

            expect(result.isError).toBe(true)
            expect(text(result)).toContain('Google Workspace')
            expect(text(result)).toContain('HTTP 422')
            expect(calls).toHaveLength(1)
        })

        it('reports a domain the organization already has', async () => {
            const { client } = failing(409, {
                name: 'AlreadyExistsError',
                message: 'Domain already exists',
                fix: 'A domain with these details already exists. Fetch or update the existing resource instead of creating a duplicate.',
            })
            const result = await (await connect(client)).callTool({ name: 'create_domain', arguments: { domain: 'example.com' } })

            expect(result.isError).toBe(true)
            expect(text(result)).toContain('already exists')
            expect(text(result)).toContain('Fetch or update the existing resource')
        })

        it("passes on the API's own remedy when the plan's domain limit is reached", async () => {
            const { client } = failing(403, {
                name: 'LimitExceededError',
                message: 'Domain limit exceeded',
                fix: "Your plan's domain limit is 3. Delete an existing domain, or upgrade at https://console.agentmail.to/dashboard/upgrade to raise it.",
            })
            const result = await (await connect(client)).callTool({ name: 'create_domain', arguments: { domain: 'example.com' } })

            expect(text(result)).toContain("Your plan's domain limit is 3")
            expect(text(result)).not.toContain('lacks permission')
        })

        it('says the credential lacks permission on a bare 403', async () => {
            const { client } = failing(403, { name: 'ForbiddenError', message: 'Forbidden' })
            const result = await (await connect(client)).callTool({ name: 'create_domain', arguments: { domain: 'example.com' } })

            expect(result.isError).toBe(true)
            expect(text(result)).toContain('lacks permission')
        })

        it('makes no request for arguments that fail validation', async () => {
            const calls: Call[] = []
            const client = await connect(domainsClient(calls))
            const result = await client.callTool({ name: 'create_domain', arguments: { domain: '', trackingEnabled: 'yes' } })

            expect(result.isError).toBe(true)
            expect(calls).toEqual([])
        })
    })
})

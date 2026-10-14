import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentMailClient } from 'agentmail'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

import { AgentMailToolkit } from '../src/mcp.js'
import { UploadFileParams } from '../src/schemas.js'
import { uploadFile } from '../src/functions.js'
import { file, mockClient } from './fixtures.js'

// sha256('hello world'), base64: what the API takes as `sha256`.
const HELLO_SHA256 = 'uU0nuZNNPgilLlLX2n2r+sSE7+N6U4DukIj3rOLvzek='
const upload = {
    method: 'PUT',
    url: 'https://file-bucket.s3.us-east-1.amazonaws.com/files/6f1c2f4e?X-Amz-Signature=abc',
    headers: { 'Content-Length': '11', 'If-None-Match': '*', 'x-amz-tagging': 'upload-state=pending' },
    expiresAt: new Date('2026-07-10T13:00:00.000Z'),
}

// A client whose create returns a pending file with an upload, recording every SDK call.
const pendingClient = () => {
    const calls: { method: string; args: unknown[] }[] = []
    const client = {
        inboxes: {
            files: {
                create: async (...args: unknown[]) => {
                    calls.push({ method: 'create', args })
                    return { ...file(), status: 'pending', downloadUrl: undefined, upload }
                },
                complete: async (...args: unknown[]) => {
                    calls.push({ method: 'complete', args })
                    return file()
                },
            },
        },
    } as unknown as AgentMailClient
    return { client, calls }
}

const parse = (args: Record<string, unknown>) => UploadFileParams.parse({ inboxId: 'inbox_1', path: 'reports/q3.txt', ...args })

afterEach(() => vi.unstubAllGlobals())

describe('upload_file', () => {
    it("creates the file with the content's size and SHA-256, PUTs exactly the signed headers, then completes it", async () => {
        const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { client, calls } = pendingClient()

        const result = await uploadFile(client, parse({ content: 'hello world' }))

        expect(calls[0]).toEqual({
            method: 'create',
            args: [
                'inbox_1',
                {
                    path: 'reports/q3.txt',
                    size: 11,
                    sha256: HELLO_SHA256,
                    contentType: 'text/plain; charset=utf-8',
                    expiresAt: undefined,
                },
            ],
        })
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe(upload.url)
        expect(init).toMatchObject({ method: 'PUT', headers: upload.headers, redirect: 'error' })
        expect(new TextDecoder().decode(init.body as Uint8Array)).toBe('hello world')
        expect(calls[1]).toEqual({ method: 'complete', args: ['inbox_1', file().fileId] })
        expect(result).toEqual(file())
    })

    it('decodes base64 content, leaves the content type to the API, and passes the expiry as a Date', async () => {
        const fetchMock = vi.fn(async () => new Response(null, { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)
        const { client, calls } = pendingClient()

        await uploadFile(client, parse({ content: btoa('hello world'), encoding: 'base64', expiresAt: '2026-11-01T00:00:00+02:00' }))

        expect(calls[0].args[1]).toEqual({
            path: 'reports/q3.txt',
            size: 11,
            sha256: HELLO_SHA256,
            contentType: undefined,
            expiresAt: new Date('2026-10-31T22:00:00.000Z'),
        })
    })

    it('refuses content that is not base64, before any call', async () => {
        const { client, calls } = pendingClient()
        await expect(uploadFile(client, parse({ content: 'not base64!', encoding: 'base64' }))).rejects.toThrow('content is not valid base64')
        expect(calls).toEqual([])
    })

    it('fails without completing when the PUT is refused', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(null, { status: 403 }))
        )
        const { client, calls } = pendingClient()

        await expect(uploadFile(client, parse({ content: 'hello world' }))).rejects.toThrow("failed to upload the file's bytes: HTTP 403")
        expect(calls.map(({ method }) => method)).toEqual(['create'])
    })

    it('returns a file the API already has ready, as on an identical retry, with no PUT', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)

        const result = await uploadFile(mockClient(), parse({ content: 'hello world' }))

        expect(result).toEqual(file())
        expect(fetchMock).not.toHaveBeenCalled()
    })
})

describe('get_file', () => {
    it("returns the file without the API's sha256 or the inbox's duplicate email", async () => {
        const server = new McpServer({ name: 'agentmail-test', version: '0.0.0' })
        for (const tool of new AgentMailToolkit(mockClient()).getTools()) server.registerTool(tool.name, tool, tool.callback)
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
        const mcpClient = new Client({ name: 'test-client', version: '0.0.0' })
        await Promise.all([mcpClient.connect(clientTransport), server.connect(serverTransport)])

        const result = await mcpClient.callTool({
            name: 'get_file',
            arguments: { inboxId: 'inbox@agentmail.to', fileId: file().fileId },
        })

        expect(result.isError).toBeFalsy()
        expect(result.structuredContent).toMatchObject({ fileId: file().fileId, downloadUrl: file().downloadUrl })
        expect(result.structuredContent).not.toHaveProperty('sha256')
        expect(result.structuredContent).not.toHaveProperty('email')
    })
})

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { AgentMailClient } from 'agentmail'

import { Wrapper } from './wrapper'
import { tools } from './tools'

export class AgentMailMcpServer extends McpServer {
    private wrapper: Wrapper

    constructor(client?: AgentMailClient) {
        super({
            name: 'AgentMail',
            version: '0.1.0',
        })

        this.wrapper = new Wrapper(client)

        for (const tool of tools) {
            this.tool(tool.name, tool.description, tool.schema.shape, async (args: unknown) => ({
                content: [
                    {
                        type: 'text' as const,
                        text: await this.wrapper.callMethodAndStringify(tool.method, args),
                    },
                ],
            }))
        }
    }
}

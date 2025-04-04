import { type StructuredTool, tool as langchainTool } from '@langchain/core/tools'
import { AgentMailClient } from 'agentmail'

import { ListToolkit } from './toolkit'
import { type Tool } from './tools'

export class AgentMailToolkit extends ListToolkit<StructuredTool> {
    constructor(client?: AgentMailClient) {
        super(client)
    }

    protected buildTool(tool: Tool): StructuredTool {
        return langchainTool((args) => this.callMethodAndStringify(tool.method, args), {
            name: tool.name,
            description: tool.description,
            schema: tool.schema,
        })
    }
}

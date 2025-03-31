import { type StructuredTool, tool as langchainTool } from '@langchain/core/tools'
import { AgentMailClient } from 'agentmail'

import { Toolkit } from './toolkit'
import { type Tool } from './tools'

export class AgentMailToolkit extends Toolkit<StructuredTool> {
    constructor(client?: AgentMailClient) {
        super(client)
    }

    protected buildTool(tool: Tool): StructuredTool {
        return langchainTool(
            async (args) => {
                const result = await this.callMethod(tool.methodName, args)
                return result.toString()
            },
            {
                name: tool.name,
                description: tool.description,
                schema: tool.paramsSchema,
            }
        )
    }

    public getTools() {
        return Object.values(this.tools)
    }
}

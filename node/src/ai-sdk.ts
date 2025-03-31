import { type Tool as AiSdkTool } from 'ai'
import { AgentMailClient } from 'agentmail'

import { Toolkit } from './toolkit'
import { type Tool } from './tools'

export class AgentMailToolkit extends Toolkit<AiSdkTool> {
    constructor(client?: AgentMailClient) {
        super(client)
    }

    protected buildTool(tool: Tool): AiSdkTool {
        return {
            description: tool.description,
            parameters: tool.paramsSchema,
            execute: (args) => this.callMethod(tool.methodName, args),
        }
    }

    public getTools() {
        return this.tools
    }
}

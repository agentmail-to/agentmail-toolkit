import { type Tool as AiSdkTool } from 'ai'
import { AgentMailClient } from 'agentmail'

import { MapToolkit } from './toolkit'
import { type Tool } from './tools'

export class AgentMailToolkit extends MapToolkit<AiSdkTool> {
    constructor(client?: AgentMailClient) {
        super(client)
    }

    protected buildTool(tool: Tool): AiSdkTool {
        return {
            description: tool.description,
            parameters: tool.schema,
            execute: (args) => this.callMethod(tool.method, args),
        }
    }
}

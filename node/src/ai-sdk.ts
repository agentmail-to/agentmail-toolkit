import { type Tool as AiSdkTool } from 'ai'

import { MapToolkit } from './toolkit'
import { type Tool } from './tools'

export class AgentMailToolkit extends MapToolkit<AiSdkTool> {
    protected buildTool(tool: Tool): AiSdkTool {
        return {
            description: tool.description,
            parameters: tool.schema,
            execute: async (args) => (await this.safeCall(tool.method, args)).result,
        }
    }
}

import { type Tool as AiSdkTool } from 'ai'

import { MapToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { safeFunc } from './util.js'

export class AgentMailToolkit extends MapToolkit<AiSdkTool> {
    protected buildTool(tool: Tool): AiSdkTool {
        return {
            description: tool.description,
            inputSchema: tool.paramsSchema,
            execute: async (args) => (await safeFunc(tool.func, this.client, args)).result,
        }
    }
}

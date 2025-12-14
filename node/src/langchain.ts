import { type StructuredTool, tool as langchainTool } from 'langchain'

import { ListToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { safeFunc } from './util.js'

export class AgentMailToolkit extends ListToolkit<StructuredTool> {
    protected buildTool(tool: Tool): StructuredTool {
        return langchainTool(async (args) => JSON.stringify((await safeFunc(tool.func, this.client, args)).result, null, 2), {
            name: tool.name,
            description: tool.description,
            schema: tool.paramsSchema,
        })
    }
}

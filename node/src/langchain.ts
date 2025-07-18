import { type StructuredTool, tool as langchainTool } from '@langchain/core/tools'

import { ListToolkit } from './toolkit'
import { type Tool } from './tools'

export class AgentMailToolkit extends ListToolkit<StructuredTool> {
    protected buildTool(tool: Tool): StructuredTool {
        return langchainTool(async (args) => JSON.stringify((await this.safeCall(tool.method, args)).result, null, 2), {
            name: tool.name,
            description: tool.description,
            schema: tool.params_schema,
        })
    }
}

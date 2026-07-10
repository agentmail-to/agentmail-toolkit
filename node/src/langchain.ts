import { type StructuredTool, tool as langchainTool } from 'langchain'

import { ListToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { errorMessage } from './util.js'

export class AgentMailToolkit extends ListToolkit<StructuredTool> {
    protected buildTool(tool: Tool): StructuredTool {
        return langchainTool(
            async (args: Record<string, any>) => {
                try {
                    return JSON.stringify(await tool.func(this.client, args), null, 2)
                } catch (err) {
                    // The installed @langchain/core (1.1.x) has no `ToolException` class -
                    // that's a langchain-python construct, not JS. The framework-native
                    // mechanism here is to let the tool function's promise reject:
                    // DynamicStructuredTool.call() propagates the rejection rather than
                    // swallowing it, so the calling agent/executor sees a real failure
                    // instead of an error string dressed up as a successful result.
                    throw new Error(errorMessage(err))
                }
            },
            {
                name: tool.name,
                description: tool.description,
                schema: tool.paramsSchema,
            }
        )
    }
}

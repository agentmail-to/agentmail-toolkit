import { type Tool as AiSdkTool } from 'ai'

import { MapToolkit } from './toolkit.js'
import { type Tool } from './tools.js'
import { errorMessage, normalize } from './util.js'

export class AgentMailToolkit extends MapToolkit<AiSdkTool> {
    protected buildTool(tool: Tool): AiSdkTool {
        return {
            description: tool.description,
            inputSchema: tool.paramsSchema,
            outputSchema: tool.outputSchema,
            execute: async (args) => {
                try {
                    return normalize(await tool.func(this.client, args))
                } catch (err) {
                    // Throw (rather than swallowing into a string return value) so the
                    // `ai` SDK produces its native `tool-error` content part, which the
                    // model can structurally distinguish from a successful result -
                    // instead of a failed call looking like an ordinary successful call
                    // that happens to return a string. Message is the same concise,
                    // bounded text the MCP binding surfaces, not the SDK's raw dump.
                    throw new Error(errorMessage(err))
                }
            },
        }
    }
}

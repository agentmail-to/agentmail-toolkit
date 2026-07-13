import { z } from 'zod'

import { ListToolkit } from './toolkit.js'
import { type Tool as BaseTool } from './tools.js'
import { errorMessage } from './util.js'

type Tool = {
    name: string
    description: string
    paramsSchema: z.ZodObject
    outputSchema: z.ZodObject
    func: (args: Record<string, unknown>) => Promise<unknown>
}

export class AgentMailToolkit extends ListToolkit<Tool> {
    protected buildTool(tool: BaseTool) {
        return {
            name: tool.name,
            description: tool.description,
            paramsSchema: tool.paramsSchema,
            outputSchema: tool.outputSchema,
            func: async (args: z.infer<typeof tool.paramsSchema>) => {
                try {
                    return await tool.func(this.client, args)
                } catch (err) {
                    // This is the toolkit's bare/generic entry point - no framework of its
                    // own to interpret an isError flag - so a thrown Error, carrying the
                    // same concise, bounded message the other adapters surface (never the
                    // SDK's raw unbounded dump), is the only structural failure signal a
                    // caller can rely on.
                    throw new Error(errorMessage(err))
                }
            },
        }
    }
}

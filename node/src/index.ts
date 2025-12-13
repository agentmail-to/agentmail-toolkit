import { z } from 'zod'

import { ListToolkit } from './toolkit.js'
import { type Tool as BaseTool } from './tools.js'

type Tool = {
    name: string
    description: string
    paramsSchema: z.ZodObject<any>
    func: (args: any) => Promise<any>
}

export class AgentMailToolkit extends ListToolkit<Tool> {
    protected buildTool(tool: BaseTool) {
        return {
            name: tool.name,
            description: tool.description,
            paramsSchema: tool.paramsSchema,
            func: (args: z.infer<typeof tool.paramsSchema>) => tool.func(this.client, args),
        }
    }
}

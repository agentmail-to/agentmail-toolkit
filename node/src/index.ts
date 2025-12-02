import { z } from 'zod'

import { ListToolkit } from './toolkit.js'
import { type Tool as BaseTool } from './tools.js'

type Tool = {
    name: string
    description: string
    params_schema: z.AnyZodObject
    func: (args: any) => Promise<any>
}

export class AgentMailToolkit extends ListToolkit<Tool> {
    protected buildTool(tool: BaseTool) {
        return {
            name: tool.name,
            description: tool.description,
            params_schema: tool.params_schema,
            func: (args: z.infer<typeof tool.params_schema>) => tool.func(this.client, args),
        }
    }
}

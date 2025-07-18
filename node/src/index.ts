import { z } from 'zod'

import { ListToolkit } from './toolkit'
import { type Tool as BaseTool } from './tools'

type Tool = {
    name: string
    description: string
    params_schema: z.AnyZodObject
    fn: (args: any) => Promise<any>
}

export class AgentMailToolkit extends ListToolkit<Tool> {
    protected buildTool(tool: BaseTool) {
        return {
            name: tool.name,
            description: tool.description,
            params_schema: tool.params_schema,
            fn: (args: z.infer<typeof tool.params_schema>) => this.call(tool.method, args),
        }
    }
}

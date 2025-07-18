import { z } from 'zod'

import { ListToolkit } from './toolkit'
import { type Tool as BaseTool } from './tools'

type Tool = {
    name: string
    description: string
    schema: z.AnyZodObject
    fn: (args: any) => Promise<any>
}

export class AgentMailToolkit extends ListToolkit<Tool> {
    protected buildTool(tool: BaseTool) {
        return {
            name: tool.name,
            description: tool.description,
            schema: tool.schema,
            fn: (args: z.infer<typeof tool.schema>) => this.call(tool.method, args),
        }
    }
}

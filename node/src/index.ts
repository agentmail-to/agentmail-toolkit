import { z } from 'zod'

import { ListToolkit } from './toolkit.js'
import { type Tool as BaseTool } from './tools.js'
import { safeFunc } from './util.js'

type Tool = {
    name: string
    description: string
    paramsSchema: z.ZodObject<any>
    // Error contract: `func` never throws. On success, `isError` is false and `result`
    // is the tool's raw SDK return value. On failure, `isError` is true and `result` is
    // a concise error message string (see util.ts `safeFunc`/`errorMessage`), with
    // `statusCode`/`body` set when the failure was an AgentMail API error.
    func: (args: any) => Promise<{ isError: boolean; result: unknown; statusCode?: number; body?: unknown }>
}

export class AgentMailToolkit extends ListToolkit<Tool> {
    protected buildTool(tool: BaseTool) {
        return {
            name: tool.name,
            description: tool.description,
            paramsSchema: tool.paramsSchema,
            func: (args: z.infer<typeof tool.paramsSchema>) => safeFunc(tool.func, this.client, args),
        }
    }
}

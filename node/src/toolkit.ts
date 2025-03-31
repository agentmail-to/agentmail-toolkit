import { AgentMailClient } from 'agentmail'
import { type Tool, tools } from './tools'

export abstract class Toolkit<T> {
    protected readonly tools: Record<string, T> = {}

    constructor(private readonly client?: AgentMailClient) {
        if (!this.client) this.client = new AgentMailClient()

        this.tools = tools.reduce(
            (acc, tool) => {
                acc[tool.name] = this.buildTool(tool)
                return acc
            },
            {} as Record<string, T>
        )
    }

    protected abstract buildTool(tool: Tool): T

    // public getTools() {
    //     return this.tools
    // }

    public async callMethod(methodName: string, args: unknown) {
        const parts = methodName.split('.')
        const methodKey = parts.pop()

        if (!methodKey) throw new Error('Method name empty')

        let parent: any = this.client
        for (const part of parts) parent = parent[part]

        return await parent[methodKey].call(parent, args)
    }
}

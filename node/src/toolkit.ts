import { AgentMailClient } from 'agentmail'

import { Wrapper } from './wrapper'
import { type Tool, tools } from './tools'

export abstract class ListToolkit<T> extends Wrapper {
    protected readonly tools: T[] = []

    constructor(client?: AgentMailClient) {
        super(client)

        this.tools = tools.map((tool) => this.buildTool(tool))
    }

    protected abstract buildTool(tool: Tool): T

    public getTools() {
        return this.tools
    }
}

export abstract class MapToolkit<T> extends Wrapper {
    protected readonly tools: Record<string, T> = {}

    constructor(client?: AgentMailClient) {
        super(client)

        this.tools = tools.reduce(
            (acc, tool) => {
                acc[tool.name] = this.buildTool(tool)
                return acc
            },
            {} as Record<string, T>
        )
    }

    protected abstract buildTool(tool: Tool): T

    public getTools() {
        return this.tools
    }
}

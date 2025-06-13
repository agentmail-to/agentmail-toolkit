import { AgentMailClient } from 'agentmail'

import { Wrapper } from './wrapper'
import { type Tool, tools } from './tools'

export abstract class BaseToolkit<T> extends Wrapper {
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
}

export abstract class ListToolkit<T> extends BaseToolkit<T> {
    public getTools(names?: string[]) {
        if (!names) return Object.values(this.tools)

        return names.reduce((acc, name) => {
            if (name in this.tools) acc.push(this.tools[name])
            return acc
        }, [] as T[])
    }
}

export abstract class MapToolkit<T> extends BaseToolkit<T> {
    public getTools(names?: string[]) {
        if (!names) return this.tools

        return names.reduce(
            (acc, name) => {
                if (name in this.tools) acc[name] = this.tools[name]
                return acc
            },
            {} as Record<string, T>
        )
    }
}

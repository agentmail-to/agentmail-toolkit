import { AgentMailClient } from 'agentmail'

export class Wrapper {
    constructor(private readonly client = new AgentMailClient()) {}

    public async call(method: string, args: any) {
        const parts = method.split('.')
        const methodKey = parts.pop()

        if (!methodKey) throw new Error('Method name empty')

        let parent: any = this.client
        for (const part of parts) parent = parent[part]

        const { inboxId, ...options } = args

        if (inboxId) return await parent[methodKey].call(parent, inboxId, options)
        else return await parent[methodKey].call(parent, options)
    }

    public async safeCall(method: string, args: any) {
        try {
            return { isError: false, result: await this.call(method, args) }
        } catch (error) {
            if (error instanceof Error) return { isError: true, result: error.message }
            else return { isError: true, result: 'Unknown error' }
        }
    }
}

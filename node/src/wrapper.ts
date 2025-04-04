import { AgentMailClient } from 'agentmail'

export class Wrapper {
    constructor(private readonly client?: AgentMailClient) {
        if (!this.client) this.client = new AgentMailClient()
    }

    public async callMethod(method: string, args: unknown) {
        const parts = method.split('.')
        const methodKey = parts.pop()

        if (!methodKey) throw new Error('Method name empty')

        let parent: any = this.client
        for (const part of parts) parent = parent[part]

        return await parent[methodKey].call(parent, args)
    }

    public async callMethodAndStringify(method: string, args: unknown) {
        try {
            const result = await this.callMethod(method, args)
            return JSON.stringify(result, null, 2)
        } catch (error) {
            return JSON.stringify(error, null, 2)
        }
    }
}

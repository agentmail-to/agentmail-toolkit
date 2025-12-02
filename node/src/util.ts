import { AgentMailClient } from 'agentmail'

export const safeFunc = async <T>(
    func: (client: AgentMailClient, args: Record<string, any>) => Promise<T>,
    client: AgentMailClient,
    args: Record<string, any>
) => {
    try {
        return { isError: false, result: await func(client, args) }
    } catch (error) {
        if (error instanceof Error) return { isError: true, result: error.message }
        else return { isError: true, result: 'Unknown error' }
    }
}
